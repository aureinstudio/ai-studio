# ai-studio

> KEG 자체 AI 교육 플랫폼 — Aurein AX × KEG 통합 베타 앱

## 목적

KEG 교육 그룹의 AI 교육 솔루션 3종 (Studio · Cast · Tutor) 베타 운영을 위한 웹 애플리케이션. 1차 PoC(P3 Max Tutor)에서 검증된 29 에이전트 + 통합 인터페이스(CAE)를 단일 플랫폼으로 노출한다.

- **버전:** v0.1.0 (Landing only — 2026-05-09)
- **스택:** Next.js 16 · TypeScript · Tailwind CSS · App Router
- **배포:** Vercel — **🌐 https://ai-studio-drab-nine.vercel.app/**
- **모노레포 구조:** `apps/web/` (Next.js)
- **저장소:** https://github.com/aureinstudio/ai-studio

## 빠른 시작

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

## 디렉토리

```
ai-studio/
├── apps/
│   └── web/              # Next.js 15 frontend
└── README.md
```

## 다음 단계 (Roadmap)

- [x] v0.1.0 — Landing page + Vercel 배포
- [ ] v0.2.0 — Tutor 채팅 UI (tutor-02→04→08 라이브)
- [ ] v0.3.0 — PoC Dashboard (H1~H5 + WBS + 리스크)
- [ ] v0.4.0 — 에이전트 명세 익스플로러 (29 명세 + 22 프롬프트)
- [ ] v1.0 — 통합 베타 (3 솔루션 + Meta Orchestrator UI)

## 연관 문서

- [부모 프로젝트 가이드](../../CLAUDE.md)
- [통합 인터페이스 명세](../../05-agents/specs/INTEGRATION.md)
- [PoC 실행 계획](../../02-execution/milestones.md)

## License

KEG · Aurein AX 내부 자산. 외부 배포 금지.

---

*Powered by Aurein AX*
