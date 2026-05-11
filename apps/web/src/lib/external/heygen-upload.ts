/**
 * HeyGen Talking Photo 업로드 (사진 → talking_photo_id).
 *
 * 1. POST https://upload.heygen.com/v1/talking_photo
 *    Header: X-Api-Key + Content-Type (image/jpeg|png)
 *    Body: 원본 이미지 바이트
 * 2. Response: { code: 100, data: { talking_photo_id: "..." } }
 *
 * 생성된 talking_photo_id는 영구 — 사용자 HeyGen 계정에 저장.
 * 영상 생성 시 character.talking_photo_id 로 사용.
 */

const UPLOAD_API = "https://upload.heygen.com/v1/talking_photo";

export type UploadTalkingPhotoResult = {
  talking_photo_id: string;
};

export async function uploadTalkingPhoto(
  imageBuffer: ArrayBuffer | Buffer,
  contentType: "image/jpeg" | "image/png",
): Promise<UploadTalkingPhotoResult> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  // fetch body는 Uint8Array 호환. Buffer 그대로 넘기면 타입 오류
  const body = Buffer.isBuffer(imageBuffer)
    ? new Uint8Array(imageBuffer)
    : new Uint8Array(imageBuffer);

  const res = await fetch(UPLOAD_API, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": contentType,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HeyGen talking_photo upload ${res.status}: ${txt.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    code: number;
    data?: { talking_photo_id: string };
    message?: string;
  };

  if (json.code !== 100 || !json.data?.talking_photo_id) {
    throw new Error(
      `HeyGen upload response error: code=${json.code} message=${json.message ?? "unknown"}`,
    );
  }

  return { talking_photo_id: json.data.talking_photo_id };
}
