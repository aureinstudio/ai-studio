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

// 본부장 직접 확인 (2026-05-11): 동양인 avatar ✓
const VERIFIED_ASIAN_FEMALE = "b81ecd3f96274a89b7fedfdefae05bbe";
const VERIFIED_ASIAN_MALE = "be2f01d03e3440b096f58f4845b5a06a";

export const AVATAR_PRESETS: AvatarPreset[] = [
  // 여성
  {
    preset_id: "f-20s",
    heygen_avatar_id: VERIFIED_ASIAN_FEMALE,
    gender: "female",
    age_group: "20s",
    label: "여성 · 20대",
    description: "신입 강사·튜터 톤. 친근하고 명료한 음성에 어울림.",
    verified: true,
  },
  {
    preset_id: "f-30s",
    heygen_avatar_id: VERIFIED_ASIAN_FEMALE,
    gender: "female",
    age_group: "30s",
    label: "여성 · 30대",
    description: "전문 강사 톤. 자격증·실무 과정에 적합.",
    verified: true,
  },
  {
    preset_id: "f-40s",
    heygen_avatar_id: VERIFIED_ASIAN_FEMALE,
    gender: "female",
    age_group: "40s",
    label: "여성 · 40대",
    description: "시니어 강사 톤. 심화 과정·이론 강의에 적합.",
    verified: true,
  },
  {
    preset_id: "f-50s",
    heygen_avatar_id: VERIFIED_ASIAN_FEMALE,
    gender: "female",
    age_group: "50s",
    label: "여성 · 50대",
    description: "권위 있는 톤. 전문가 인터뷰·심화 과정에 적합.",
    verified: true,
  },
  // 남성 (본부장 검증 ✓ — 동일 ID, 본부장이 추가 연령대 ID 제공하면 분기)
  {
    preset_id: "m-20s",
    heygen_avatar_id: VERIFIED_ASIAN_MALE,
    gender: "male",
    age_group: "20s",
    label: "남성 · 20대",
    description: "신입 강사·튜터 톤. 친근하고 명료한 음성에 어울림.",
    verified: true,
  },
  {
    preset_id: "m-30s",
    heygen_avatar_id: VERIFIED_ASIAN_MALE,
    gender: "male",
    age_group: "30s",
    label: "남성 · 30대",
    description: "전문 강사 톤. 자격증·실무 과정에 적합.",
    verified: true,
  },
  {
    preset_id: "m-40s",
    heygen_avatar_id: VERIFIED_ASIAN_MALE,
    gender: "male",
    age_group: "40s",
    label: "남성 · 40대",
    description: "시니어 강사 톤. 심화 과정·이론 강의에 적합.",
    verified: true,
  },
  {
    preset_id: "m-50s",
    heygen_avatar_id: VERIFIED_ASIAN_MALE,
    gender: "male",
    age_group: "50s",
    label: "남성 · 50대",
    description: "권위 있는 톤. 전문가 인터뷰·심화 과정에 적합.",
    verified: true,
  },
];

/**
 * preset_id → heygen_avatar_id.
 * 알려지지 않은 preset_id면 검증된 첫 번째 avatar 반환.
 */
export function resolveAvatarId(presetId: string | undefined): string {
  if (!presetId) return VERIFIED_ASIAN_FEMALE;
  const preset = AVATAR_PRESETS.find((p) => p.preset_id === presetId);
  return preset?.heygen_avatar_id ?? VERIFIED_ASIAN_FEMALE;
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
