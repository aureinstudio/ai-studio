"""ai-studio Python SDK client."""
from __future__ import annotations

import time
from typing import Any, Literal, Optional, TypedDict

import httpx

DEFAULT_BASE_URL = "https://ai-studio-drab-nine.vercel.app/api/v1"


class AiStudioError(Exception):
    """API error with status code and machine-readable code."""

    def __init__(self, status: int, code: str, message: str, detail: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.detail = detail


class StudioJob(TypedDict, total=False):
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    topic: str
    level: str
    length: str
    course_category: str
    content: Optional[dict]
    cost_usd: Optional[float]
    error: Optional[str]
    created_at: str
    completed_at: Optional[str]


class TutorAnswer(TypedDict):
    answer: str
    usage: dict


class Analytics(TypedDict):
    period_days: int
    students: int
    instructors: int
    studio_jobs: int
    studio_jobs_completed: int
    cast_jobs: int
    tutor_conversations: int
    total_cost_usd: float


class _StudioAPI:
    def __init__(self, http: httpx.Client):
        self._http = http

    def create(
        self,
        topic: str,
        level: str = "intermediate",
        length: str = "medium",
        course_category: str = "certification",
        model: Optional[str] = None,
    ) -> StudioJob:
        """Create a Studio job. Returns immediately with job_id."""
        body = {"topic": topic, "level": level, "length": length, "course_category": course_category}
        if model:
            body["model"] = model
        return _request(self._http, "POST", "/studio/jobs", json=body)

    def get(self, job_id: str) -> StudioJob:
        return _request(self._http, "GET", f"/studio/jobs/{job_id}")

    def wait(
        self,
        job_id: str,
        poll_interval_s: float = 10.0,
        timeout_s: float = 600.0,
    ) -> StudioJob:
        """Poll until completed or failed. Raises AiStudioError on timeout."""
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            job = self.get(job_id)
            if job["status"] in ("completed", "failed"):
                return job
            time.sleep(poll_interval_s)
        raise AiStudioError(408, "timeout", f"Studio job {job_id} did not complete within {timeout_s}s")


class _TutorAPI:
    def __init__(self, http: httpx.Client):
        self._http = http

    def ask(self, message: str, course_topic: Optional[str] = None) -> TutorAnswer:
        body: dict[str, Any] = {"message": message}
        if course_topic:
            body["course_topic"] = course_topic
        return _request(self._http, "POST", "/tutor/ask", json=body)


class _AnalyticsAPI:
    def __init__(self, http: httpx.Client):
        self._http = http

    def get(self, days: int = 30) -> Analytics:
        return _request(self._http, "GET", f"/analytics?days={days}")


class AiStudio:
    """Main SDK entry point.

    Example:
        client = AiStudio(api_key=os.environ["AI_STUDIO_API_KEY"])
        job = client.studio.create(topic="React Hooks intro")
        result = client.studio.wait(job["job_id"])
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 60.0,
    ):
        if not api_key:
            raise ValueError("api_key is required")
        self._http = httpx.Client(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "ai-studio-sdk-python/0.1.0",
            },
            timeout=timeout,
        )
        self.studio = _StudioAPI(self._http)
        self.tutor = _TutorAPI(self._http)
        self.analytics = _AnalyticsAPI(self._http)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "AiStudio":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


def _request(http: httpx.Client, method: str, path: str, json: Optional[dict] = None) -> Any:
    resp = http.request(method, path, json=json)
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}
    if resp.is_error:
        err_code = data.get("error", "http_error") if isinstance(data, dict) else "http_error"
        err_msg = data.get("message", f"HTTP {resp.status_code}") if isinstance(data, dict) else f"HTTP {resp.status_code}"
        raise AiStudioError(resp.status_code, err_code, err_msg, data)
    return data
