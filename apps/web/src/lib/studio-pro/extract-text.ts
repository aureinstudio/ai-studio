/**
 * 강사 자료 텍스트 추출.
 * - .md / .txt : UTF-8 디코드
 * - .pdf       : pdf-parse
 * - .pptx      : officeparser (zip + xml parse)
 *
 * 실패 시 fallback 메시지를 던지지 않고 빈 문자열 반환 → 호출측이 길이 검증.
 */

export type SourceType = "md" | "txt" | "pdf" | "pptx";

export function detectSourceType(filename: string): SourceType | null {
  const l = filename.toLowerCase();
  if (l.endsWith(".md")) return "md";
  if (l.endsWith(".txt")) return "txt";
  if (l.endsWith(".pdf")) return "pdf";
  if (l.endsWith(".pptx")) return "pptx";
  return null;
}

export async function extractText(bytes: Uint8Array, type: SourceType): Promise<string> {
  switch (type) {
    case "md":
    case "txt":
      return new TextDecoder("utf-8").decode(bytes).trim();

    case "pdf": {
      const mod = await import("pdf-parse");
      // pdf-parse v2.x default export — runtime shape varies
      const fn = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default
        ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const buf = Buffer.from(bytes);
      const res = await fn(buf);
      return (res?.text ?? "").trim();
    }

    case "pptx": {
      const mod = await import("officeparser");
      // officeparser exports parseOfficeAsync(buffer) → string
      const parser = mod as { parseOfficeAsync?: (b: Buffer) => Promise<string>; default?: { parseOfficeAsync?: (b: Buffer) => Promise<string> } };
      const fn = parser.parseOfficeAsync ?? parser.default?.parseOfficeAsync;
      if (!fn) throw new Error("officeparser.parseOfficeAsync not available");
      const buf = Buffer.from(bytes);
      const text = await fn(buf);
      return (text ?? "").trim();
    }
  }
}
