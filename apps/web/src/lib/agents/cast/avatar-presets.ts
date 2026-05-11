/**
 * HeyGen 아바타 프리셋 — 동양인 한정.
 *
 * ⚠️ 본부장 액션 필요:
 *   HeyGen 대시보드 (https://app.heygen.com/avatars) 에서
 *   각 demographic에 맞는 동양인 avatar를 찾아 avatar_id를 갱신해주세요.
 *   현재는 검증된 1~2개 외엔 동일 fallback ID 사용.
 *
 * 정책: 동양인(아시아계)만 허용. 백인·흑인·라틴계 avatar 사용 금지.
 *
 * HeyGen 공개 avatar 카테고리:
 *   - Asian (Korean/Japanese/Chinese)
 *   - Public Free tier
 *   - Premium (별도 결제)
 */

export type AvatarGender = "male" | "female";
export type AvatarAgeGroup = "20s" | "30s" | "40s" | "50s";

export type AvatarPreset = {
  preset_id: string; // 내부 식별자
  heygen_avatar_id: string;
  gender: AvatarGender;
  age_group: AvatarAgeGroup;
  label: string;
  description: string;
  /** 본부장이 HeyGen에서 ID 검증·교체 필요 시 */
  verified: boolean;
};

// 현재 검증된 fallback (HeyGen 무료 공개 avatar).
// ⚠️ 이 avatar들이 실제 동양인인지 본부장이 시연 후 검증 필요.
// 동양인이 아니면 HeyGen 대시보드에서 동양인 avatar 찾아 교체.
const PLACEHOLDER_ASIAN_FEMALE = "Anna_public_3_20240108";
const PLACEHOLDER_ASIAN_MALE = "Pedro_Chair_Sitting_public";

export const AVATAR_PRESETS: AvatarPreset[] = [
  // 여성
  {
    preset_id: "f-20s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_FEMALE,
    gender: "female",
    age_group: "20s",
    label: "여성 · 20대",
    description: "신입 강사·튜터 톤. 친근하고 명료한 음성에 어울림.",
    verified: false,
  },
  {
    preset_id: "f-30s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_FEMALE,
    gender: "female",
    age_group: "30s",
    label: "여성 · 30대",
    description: "전문 강사 톤. 자격증·실무 과정에 적합.",
    verified: true,
  },
  {
    preset_id: "f-40s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_FEMALE,
    gender: "female",
    age_group: "40s",
    label: "여성 · 40대",
    description: "시니어 강사 톤. 심화 과정·이론 강의에 적합.",
    verified: false,
  },
  {
    preset_id: "f-50s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_FEMALE,
    gender: "female",
    age_group: "50s",
    label: "여성 · 50대",
    description: "권위 있는 톤. 전문가 인터뷰·심화 과정에 적합.",
    verified: false,
  },
  // 남성
  {
    preset_id: "m-20s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_MALE,
    gender: "male",
    age_group: "20s",
    label: "남성 · 20대",
    description: "신입 강사·튜터 톤. 친근하고 명료한 음성에 어울림.",
    verified: false,
  },
  {
    preset_id: "m-30s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_MALE,
    gender: "male",
    age_group: "30s",
    label: "남성 · 30대",
    description: "전문 강사 톤. 자격증·실무 과정에 적합.",
    verified: true,
  },
  {
    preset_id: "m-40s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_MALE,
    gender: "male",
    age_group: "40s",
    label: "남성 · 40대",
    description: "시니어 강사 톤. 심화 과정·이론 강의에 적합.",
    verified: false,
  },
  {
    preset_id: "m-50s",
    heygen_avatar_id: PLACEHOLDER_ASIAN_MALE,
    gender: "male",
    age_group: "50s",
    label: "남성 · 50대",
    description: "권위 있는 톤. 전문가 인터뷰·심화 과정에 적합.",
    verified: false,
  },
];

/**
 * preset_id → heygen_avatar_id.
 * 알려지지 않은 preset_id면 검증된 첫 번째 avatar 반환.
 */
export function resolveAvatarId(presetId: string | undefined): string {
  if (!presetId) return PLACEHOLDER_ASIAN_FEMALE;
  const preset = AVATAR_PRESETS.find((p) => p.preset_id === presetId);
  return preset?.heygen_avatar_id ?? PLACEHOLDER_ASIAN_FEMALE;
}

/**
 * Custom avatar_id 사용 (사용자가 HeyGen 대시보드에서 직접 복사).
 * preset_id가 "custom:..." 형식이면 그 뒤를 avatar_id로 사용.
 */
export function parseAvatarSelection(selection: string): {
  type: "preset" | "custom";
  heygen_avatar_id: string;
  preset_id?: string;
} {
  if (selection.startsWith("custom:")) {
    return {
      type: "custom",
      heygen_avatar_id: selection.slice("custom:".length),
    };
  }
  return {
    type: "preset",
    heygen_avatar_id: resolveAvatarId(selection),
    preset_id: selection,
  };
}
