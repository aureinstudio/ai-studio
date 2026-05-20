/**
 * 강사 자료 텍스트 추출.
 * - .md / .txt : UTF-8 디코드
 * - .pdf       : unpdf (serverless 친화, pdfjs 브라우저 의존성 회피)
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
      const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await unpdfExtract(pdf, { mergePages: true });
      return (text ?? "").trim();
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
