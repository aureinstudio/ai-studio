/**
 * ai-studio TypeScript SDK
 *
 * @example
 * ```ts
 * import { AiStudio } from "@ai-studio/sdk";
 *
 * const client = new AiStudio({ apiKey: process.env.AI_STUDIO_API_KEY! });
 *
 * const job = await client.studio.create({ topic: "React Hooks 입문" });
 * const result = await client.studio.wait(job.job_id);
 * console.log(result.content);
 * ```
 */

export type AiStudioOptions = {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
};

export type StudioCreateInput = {
  topic: string;
  level?: "beginner" | "intermediate" | "advanced";
  length?: "short" | "medium" | "long";
  course_category?: "certification" | "professional" | "language" | "hobby" | "academic";
  model?: string;
};

export type StudioJob = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  topic: string;
  level: string;
  length: string;
  course_category: string;
  content?: Record<string, unknown> | null;
  cost_usd?: number | null;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type TutorAskInput = {
  message: string;
  course_topic?: string;
};

export type TutorAnswer = {
  answer: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
};

export type Analytics = {
  period_days: number;
  students: number;
  instructors: number;
  studio_jobs: number;
  studio_jobs_completed: number;
  cast_jobs: number;
  tutor_conversations: number;
  total_cost_usd: number;
};

export class AiStudioError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "AiStudioError";
  }
}

class HttpClient {
  constructor(
    private apiKey: string,
    private baseURL: string,
    private timeout: number,
  ) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "ai-studio-sdk-js/0.1.0",
      },
      signal: AbortSignal.timeout(this.timeout),
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(url, init);
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const err = json as { error?: string; message?: string };
      throw new AiStudioError(
        res.status,
        err?.error ?? "http_error",
        err?.message ?? `HTTP ${res.status}`,
        json,
      );
    }
    return json as T;
  }
}

class StudioAPI {
  constructor(private http: HttpClient) {}

  /** Studio 작업 생성 (비동기). job_id 즉시 반환. */
  create(input: StudioCreateInput): Promise<StudioJob> {
    return this.http.request<StudioJob>("POST", "/studio/jobs", input);
  }

  /** 작업 상태 단일 조회. */
  get(jobId: string): Promise<StudioJob> {
    return this.http.request<StudioJob>("GET", `/studio/jobs/${jobId}`);
  }

  /**
   * 완료까지 폴링. 기본 10초마다 확인, 최대 10분.
   */
  async wait(
    jobId: string,
    opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<StudioJob> {
    const pollInterval = opts.pollIntervalMs ?? 10_000;
    const timeoutMs = opts.timeoutMs ?? 600_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const job = await this.get(jobId);
      if (job.status === "completed" || job.status === "failed") return job;
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new AiStudioError(408, "timeout", `Studio job ${jobId} did not complete within ${timeoutMs}ms`);
  }
}

class TutorAPI {
  constructor(private http: HttpClient) {}

  ask(input: TutorAskInput): Promise<TutorAnswer> {
    return this.http.request<TutorAnswer>("POST", "/tutor/ask", input);
  }
}

class AnalyticsAPI {
  constructor(private http: HttpClient) {}

  get(opts: { days?: number } = {}): Promise<Analytics> {
    const days = opts.days ?? 30;
    return this.http.request<Analytics>("GET", `/analytics?days=${days}`);
  }
}

export class AiStudio {
  readonly studio: StudioAPI;
  readonly tutor: TutorAPI;
  readonly analytics: AnalyticsAPI;

  constructor(opts: AiStudioOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required");
    const http = new HttpClient(
      opts.apiKey,
      opts.baseURL ?? "https://ai-studio-drab-nine.vercel.app/api/v1",
      opts.timeout ?? 60_000,
    );
    this.studio = new StudioAPI(http);
    this.tutor = new TutorAPI(http);
    this.analytics = new AnalyticsAPI(http);
  }
}
