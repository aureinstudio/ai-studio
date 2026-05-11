import { Agent, parseJsonSafely } from "../base";

export type SlideInputMeta = {
  slide_number: number;
  title: string;
  content_blocks: string[];
  visual_suggestions: string;
  speaker_notes: string;
};

export type SlideAnalyzerInput = {
  topic: string;
  slides: SlideInputMeta[];
  is_certification?: boolean;
};

export type SlideMetadata = {
  slide_number: number;
  core_message: string;
  estimated_speak_time_seconds: number;
  visual_complexity: "low" | "medium" | "high";
  speaker_emphasis_points: string[];
  transition_type: "smooth" | "dramatic";
};

export type SlideAnalyzerOutput = {
  slide_metadata: SlideMetadata[];
  total_estimated_duration: number;
  recommended_pacing: "natural" | "slow" | "fast";
};

/**
 * Cast Agent #01 — 슬라이드 분석 (TEAM 1).
 * Studio가 생성한 슬라이드 → 영상 변환용 메타데이터 추출.
 */
export class SlideAnalyzer extends Agent<SlideAnalyzerInput, SlideAnalyzerOutput> {
  readonly id = "cast-01";
  readonly name = "슬라이드 분석";
  readonly role = "영상 변환용 메타데이터 추출";

  protected buildSystemPrompt(input: SlideAnalyzerInput): string {
    return `당신은 슬라이드 분석 에이전트입니다.
역할: PPTX 슬라이드 구조를 분석하여 영상 변환에 필요한 메타데이터를 추출합니다.

주제: ${input.topic}
${input.is_certification ? "✓ 자격증 과정 — pacing=slow 우선" : ""}

다음 JSON 구조로만 출력하세요. 마크다운 fence 금지:
{
  "slide_metadata": [
    {
      "slide_number": 1,
      "core_message": "슬라이드 핵심 메시지 1문장",
      "estimated_speak_time_seconds": 30,
      "visual_complexity": "low|medium|high",
      "speaker_emphasis_points": ["강조할 부분 1", "강조할 부분 2"],
      "transition_type": "smooth|dramatic"
    }
  ],
  "total_estimated_duration": 1800,
  "recommended_pacing": "natural|slow|fast"
}

제약:
- 각 슬라이드의 estimated_speak_time_seconds는 30~90초 사이
- visual_complexity가 "high"면 estimated_speak_time을 1.5배 권장
- 자격증 과정은 recommended_pacing="slow" 권장
- speaker_emphasis_points는 슬라이드당 2~4개 (한국어)
- total_estimated_duration은 slide_metadata의 estimated_speak_time 합계
- core_message는 60자 이내, 명확하게
- 한국어 출력`;
  }

  protected buildUserMessage(input: SlideAnalyzerInput): string {
    return `다음 슬라이드를 분석하여 영상 변환 메타데이터를 작성해주세요.

=== 슬라이드 목록 (${input.slides.length}장) ===
${JSON.stringify(input.slides, null, 2)}`;
  }

  protected parseOutput(rawText: string): SlideAnalyzerOutput {
    return parseJsonSafely<SlideAnalyzerOutput>(rawText);
  }
}
