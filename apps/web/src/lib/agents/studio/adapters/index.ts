/**
 * 과정 카테고리별 어댑테이션 — Studio·Tutor·Cast 에이전트가 공통 참조.
 *
 * 5개 카테고리 각각의 출제 경향·평가 방식·학습 동기가 다름.
 * 단순 복제 안 됨 → 각 에이전트 system prompt에 카테고리별 guidance 주입.
 *
 * 사용:
 *   const adapter = getAdapter(course_category);
 *   const prompt = `${baseSystemPrompt}\n\n${adapter.studio_guidance}`;
 */

export type CourseCategory =
  | "certification"
  | "professional"
  | "language"
  | "hobby"
  | "academic";

export type AdaptationProfile = {
  content_style: "practical" | "theoretical" | "case-based" | "balanced";
  assessment_type: "exam" | "portfolio" | "peer-review" | "self-assessment";
  learning_pace: "self-paced" | "cohort" | "scheduled";
  completion_criteria: "exam_pass" | "portfolio_complete" | "hours_logged";
  language_priority: string[];
  tone: "professional" | "casual" | "encouraging" | "rigorous";
};

export type Adapter = {
  category: CourseCategory;
  label: string;
  profile: AdaptationProfile;
  /** Studio 에이전트(특히 #02 환경조사·#07 시각·#12 종합)에 주입 */
  studio_guidance: string;
  /** Tutor 응답 생성(#04) 톤 */
  tutor_tone: string;
  /** Cast 영상 페이싱·톤 */
  cast_pacing: "slow" | "medium" | "fast";
  cast_tone: string;
};

export const ADAPTERS: Record<CourseCategory, Adapter> = {
  certification: {
    category: "certification",
    label: "자격증",
    profile: {
      content_style: "practical",
      assessment_type: "exam",
      learning_pace: "self-paced",
      completion_criteria: "exam_pass",
      language_priority: ["ko"],
      tone: "rigorous",
    },
    studio_guidance: `[자격증 어댑터]
- 출제 경향 핵심: 최근 3~5년 실제 시험 빈출 항목 반영
- 표현: 시험에서 자주 쓰이는 정확한 용어 사용
- 구조: 정의 → 핵심 원리 → 출제 사례 → 함정 포인트 → 요약
- 평가: 객관식·단답형 가정. 답안 명확성·근거 출처 중요
- 톤: 차분·정확. 격려보다 정보 우선`,
    tutor_tone: "차분·정확. 시험 출제 가능성 명시. 함정 포인트 짚기. 격려는 절제.",
    cast_pacing: "slow",
    cast_tone: "차분·신중한 강의 톤. 핵심 용어는 천천히 강조.",
  },
  professional: {
    category: "professional",
    label: "직무 교육",
    profile: {
      content_style: "case-based",
      assessment_type: "portfolio",
      learning_pace: "self-paced",
      completion_criteria: "portfolio_complete",
      language_priority: ["ko", "en"],
      tone: "professional",
    },
    studio_guidance: `[직무 교육 어댑터]
- 핵심: 실무 적용 가능성·최신 트렌드·툴/프레임워크 구체성
- 구조: 문제 정의 → 실무 사례 → 적용 방법 → 변형·예외 → 자기 점검 체크리스트
- 평가: 포트폴리오 산출물 중심. 결과물 품질 기준 명시
- 톤: 동료 전문가가 설명하듯. 추상 이론 최소화
- 영어 용어 그대로 사용(번역 강제 금지): "워크플로우", "백로그" 등
- 도구·도식: 실제 화면 캡쳐·다이어그램 권장`,
    tutor_tone: "실무 동료 톤. 구체 예시·툴 이름·trade-off 언급. 추상 답변 회피.",
    cast_pacing: "medium",
    cast_tone: "전문가가 실무 팁 공유하는 톤. 실제 사례 인용 활발.",
  },
  language: {
    category: "language",
    label: "언어",
    profile: {
      content_style: "balanced",
      assessment_type: "peer-review",
      learning_pace: "self-paced",
      completion_criteria: "hours_logged",
      language_priority: ["target", "ko"],
      tone: "encouraging",
    },
    studio_guidance: `[언어 어댑터]
- 핵심: 문법·회화·청해 균형. 단순 암기 회피
- 구조: 핵심 표현 → 발음 표기 → 예문 3개 → 변형 연습 → 문화 노트
- 발음: IPA 또는 한글 음차 함께 표기 (예: hello [hɛˈloʊ] = 헬로우)
- 예문: 일상적 상황. 직역 어색하면 자연스러운 한국어 의역 병기
- 문화 노트: 어휘·표현의 사용 맥락·뉘앙스 짧게 언급
- 평가: 자가 발화 녹음·동료 피드백 권장
- 톤: 격려·실수 환영. "이 단계에서 흔한 오류는…"`,
    tutor_tone: "친근한 언어 교사 톤. 발음 표기 병기. 자연스러운 예문 추가 풍부.",
    cast_pacing: "medium",
    cast_tone: "또렷한 발음·천천히. 학생 따라하기 좋게 짧은 휴지.",
  },
  hobby: {
    category: "hobby",
    label: "취미",
    profile: {
      content_style: "practical",
      assessment_type: "self-assessment",
      learning_pace: "self-paced",
      completion_criteria: "hours_logged",
      language_priority: ["ko"],
      tone: "encouraging",
    },
    studio_guidance: `[취미 어댑터]
- 핵심: 단계별 실습·"오늘 할 수 있는 1가지" 명확
- 구조: 결과 미리보기 → 준비물 → 단계 1~5 → 흔한 실수 → 다음 도전
- 시각 중요: 사진·동영상·도식 풍부 권장
- 평가: 자가 작품 사진/영상 업로드 → 자율 피드백
- 톤: 친근·격려·창의 자극. "처음엔 누구나 그래요"
- 진입 장벽 낮추기: 비싼 도구·전문 용어 최소화`,
    tutor_tone: "친근한 친구가 알려주듯. 격려 풍부. 실패 가능성 미리 안내.",
    cast_pacing: "fast",
    cast_tone: "밝고 빠른 페이스. 실습 결과 흥미 자극.",
  },
  academic: {
    category: "academic",
    label: "학술",
    profile: {
      content_style: "theoretical",
      assessment_type: "exam",
      learning_pace: "cohort",
      completion_criteria: "exam_pass",
      language_priority: ["ko"],
      tone: "rigorous",
    },
    studio_guidance: `[학술 어댑터]
- 핵심: 정의·정리·증명 단계별 엄밀
- 구조: 전제 → 정의 → 정리 → 증명 → 연습문제 → 심화 옵션
- 표기: 수식·기호 정확. LaTeX 수준 표기 권장 (예: $\\int_a^b f(x) dx$)
- 연습문제: 난이도 단계 표시 (기본→응용→심화)
- 톤: 학문적·정밀. 비유는 보조 수단으로만
- 시험 대비: 수능·내신 출제 빈도 메타데이터 활용`,
    tutor_tone: "정밀·단계적. 증명 가능한 진술만. 비유는 마지막에 보조.",
    cast_pacing: "slow",
    cast_tone: "강의실 톤. 칠판 필기처럼 한 단계씩.",
  },
};

export function getAdapter(category: CourseCategory | string | null | undefined): Adapter {
  if (!category) return ADAPTERS.certification;
  if (category in ADAPTERS) return ADAPTERS[category as CourseCategory];
  return ADAPTERS.certification;
}

/**
 * 카테고리 메타데이터 — UI select에서 사용.
 */
export const CATEGORY_OPTIONS: { value: CourseCategory; label: string; example: string }[] = [
  { value: "certification", label: "자격증", example: "조리기능사, 정보처리기사" },
  { value: "professional", label: "직무 교육", example: "포토샵, 엑셀, 마케팅" },
  { value: "language", label: "언어", example: "토익, 일본어 회화" },
  { value: "hobby", label: "취미", example: "요리, 사진, 캘리그라피" },
  { value: "academic", label: "학술", example: "수능 수학, 고등 물리" },
];
