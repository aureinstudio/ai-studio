import PptxGenJS from "pptxgenjs";
import type {
  CuratorOutput,
  PlannerOutput,
  InfographicOutput,
  PlanningContent,
  SlideMeta,
} from "@/components/StudioJobResult";

export type PptxExportInput = {
  topic: string;
  level?: string;
  curator: CuratorOutput;
  planner: PlannerOutput;
  planning?: PlanningContent;
  infographics?: InfographicOutput;
};

/**
 * Studio 콘텐츠 → 실제 .pptx 파일 생성.
 * pptxgenjs로 서버 사이드 렌더링. 외부 API 비용 0.
 *
 * 슬라이드 구성:
 *   1. 표지 (주제 + 학습 목표)
 *   2~N. 본문 슬라이드 (#07 Visual Planner 결과 기반)
 *   N+1. 정리 (학습 목표 재확인)
 *
 * 인포그래픽 명세는 슬라이드 하단 노트 영역에 텍스트로 삽입.
 */
export async function generatePptx(input: PptxExportInput): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // 메타데이터
  pptx.title = input.topic;
  pptx.author = "KEG AI Studio";
  pptx.company = "KEG · Aurein Studio";
  pptx.subject = input.curator.chapter_title;

  // 16:9 widescreen
  pptx.layout = "LAYOUT_WIDE";
  pptx.defineSlideMaster({
    title: "KEG_MASTER",
    background: { color: "FFFFFF" },
    objects: [
      {
        rect: {
          x: 0,
          y: 7.0,
          w: 13.33,
          h: 0.5,
          fill: { color: "F4F4F5" },
        },
      },
      {
        text: {
          text: "KEG · AI Studio",
          options: {
            x: 0.3,
            y: 7.1,
            w: 6,
            h: 0.3,
            fontSize: 10,
            color: "71717A",
            fontFace: "맑은 고딕",
          },
        },
      },
    ],
  });

  const infMap = new Map(
    (input.infographics?.infographics ?? []).map((i) => [i.slide_number, i]),
  );

  // ─── 1. 표지 ─────────────────────────────────────
  const cover = pptx.addSlide({ masterName: "KEG_MASTER" });
  cover.addText(input.topic, {
    x: 0.5,
    y: 2.3,
    w: 12.3,
    h: 1.5,
    fontSize: 44,
    bold: true,
    color: "18181B",
    fontFace: "맑은 고딕",
    align: "center",
    valign: "middle",
  });
  cover.addText(input.curator.chapter_title, {
    x: 0.5,
    y: 3.8,
    w: 12.3,
    h: 0.8,
    fontSize: 24,
    color: "52525B",
    fontFace: "맑은 고딕",
    align: "center",
  });
  if (input.level) {
    cover.addText(`수준: ${levelLabel(input.level)}`, {
      x: 0.5,
      y: 4.8,
      w: 12.3,
      h: 0.4,
      fontSize: 16,
      color: "71717A",
      fontFace: "맑은 고딕",
      align: "center",
    });
  }
  // 표지 노트
  cover.addNotes(
    `주제: ${input.topic}\n` +
      `학습 목표:\n${input.curator.learning_objectives.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}`,
  );

  // ─── 2. 학습 목표 슬라이드 ───────────────────────
  const objectivesSlide = pptx.addSlide({ masterName: "KEG_MASTER" });
  objectivesSlide.addText("학습 목표", {
    x: 0.5,
    y: 0.4,
    w: 12.3,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: "18181B",
    fontFace: "맑은 고딕",
  });
  objectivesSlide.addText(
    input.curator.learning_objectives.map((obj, i) => ({
      text: `${i + 1}. ${obj}`,
      options: { bullet: false, breakLine: true },
    })),
    {
      x: 0.8,
      y: 1.5,
      w: 11.7,
      h: 5,
      fontSize: 22,
      color: "27272A",
      fontFace: "맑은 고딕",
      lineSpacingMultiple: 1.4,
    },
  );

  // ─── 3. 본문 슬라이드 (#07 Visual Planner 결과) ─────
  for (const slide of input.planner.slides) {
    addContentSlide(pptx, slide, infMap.get(slide.slide_number));
  }

  // ─── 4. 정리 슬라이드 ─────────────────────────────
  const closingSlide = pptx.addSlide({ masterName: "KEG_MASTER" });
  closingSlide.addText("정리", {
    x: 0.5,
    y: 0.4,
    w: 12.3,
    h: 0.7,
    fontSize: 32,
    bold: true,
    color: "18181B",
    fontFace: "맑은 고딕",
  });
  closingSlide.addText(
    [
      { text: "오늘 학습한 내용\n", options: { fontSize: 22, bold: true, color: "18181B" } },
      ...input.curator.learning_objectives.map((obj, i) => ({
        text: `  ✓ ${obj}\n`,
        options: { fontSize: 18, color: "27272A" },
      })),
    ],
    {
      x: 0.8,
      y: 1.5,
      w: 11.7,
      h: 5,
      fontFace: "맑은 고딕",
      lineSpacingMultiple: 1.4,
    },
  );

  // 노드 환경에서 Buffer로 출력
  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}

function addContentSlide(
  pptx: PptxGenJS,
  slide: SlideMeta,
  infographic: InfographicOutput["infographics"][0] | undefined,
) {
  const s = pptx.addSlide({ masterName: "KEG_MASTER" });

  // 슬라이드 번호 (좌상단)
  s.addText(`Slide ${String(slide.slide_number).padStart(2, "0")}`, {
    x: 0.5,
    y: 0.3,
    w: 2,
    h: 0.3,
    fontSize: 11,
    color: "A1A1AA",
    fontFace: "맑은 고딕",
  });

  // 제목
  s.addText(slide.title, {
    x: 0.5,
    y: 0.7,
    w: 12.3,
    h: 0.9,
    fontSize: 30,
    bold: true,
    color: "18181B",
    fontFace: "맑은 고딕",
  });

  // 본문 (content_blocks을 글머리 기호로)
  s.addText(
    slide.content_blocks.map((block) => ({
      text: block,
      options: { bullet: { type: "bullet", code: "25CF" }, breakLine: true },
    })),
    {
      x: 0.8,
      y: 1.8,
      w: 11.7,
      h: 4.8,
      fontSize: 18,
      color: "27272A",
      fontFace: "맑은 고딕",
      lineSpacingMultiple: 1.35,
      paraSpaceAfter: 6,
    },
  );

  // 시각 제안 (하단 hint)
  if (slide.visual_suggestions) {
    s.addText(`💡 시각 제안: ${slide.visual_suggestions}`, {
      x: 0.5,
      y: 6.4,
      w: 12.3,
      h: 0.4,
      fontSize: 11,
      italic: true,
      color: "71717A",
      fontFace: "맑은 고딕",
    });
  }

  // 노트 영역 — 발표자 노트 + 인포그래픽 명세
  const noteParts: string[] = [slide.speaker_notes];
  if (infographic && infographic.type !== "none") {
    noteParts.push(
      "",
      `━━━ 인포그래픽 (${infographic.type}) ━━━`,
      `제목: ${infographic.title}`,
      `레이아웃: ${infographic.layout_description}`,
      `요소: ${infographic.elements.join(", ")}`,
      `강조 색상: ${infographic.color_emphasis.join(", ")}`,
    );
  }
  s.addNotes(noteParts.join("\n"));
}

function levelLabel(level: string): string {
  return level === "beginner" ? "초급" : level === "intermediate" ? "중급" : level === "advanced" ? "고급" : level;
}
