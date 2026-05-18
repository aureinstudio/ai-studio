"""
시연 사용설명서 PPT 자동 생성.

실행:
  python scripts/build-manual-pptx.py

산출물:
  docs/manual/ai-studio-user-manual.pptx
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

ROOT = Path(__file__).resolve().parents[3]  # ai-studio-app
SCREENS = ROOT / "docs" / "manual" / "screens"
OUT = ROOT / "docs" / "manual" / "ai-studio-user-manual.pptx"

NAVY = RGBColor(0x0F, 0x17, 0x2A)
GRAY = RGBColor(0x64, 0x74, 0x8B)
LIGHT = RGBColor(0xF1, 0xF5, 0xF9)
ACCENT = RGBColor(0x2D, 0x6A, 0xFF)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height

BLANK = prs.slide_layouts[6]


def add_textbox(slide, x, y, w, h, text, size=18, bold=False, color=NAVY, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = "맑은 고딕"
    return tb


def add_band(slide, color, x, y, w, h):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def add_header(slide, title, subtitle=None):
    add_band(slide, NAVY, 0, 0, SW, Inches(0.55))
    add_textbox(slide, Inches(0.4), Inches(0.1), Inches(10), Inches(0.4),
                title, size=18, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    if subtitle:
        add_textbox(slide, SW - Inches(4.4), Inches(0.13), Inches(4), Inches(0.4),
                    subtitle, size=11, color=RGBColor(0xCB, 0xD5, 0xE1), align=PP_ALIGN.RIGHT)


def add_footer(slide, num, total):
    add_textbox(slide, Inches(0.4), SH - Inches(0.4), Inches(8), Inches(0.3),
                "ai-studio v2.3.0 · 시연 사용설명서", size=9, color=GRAY)
    add_textbox(slide, SW - Inches(1.4), SH - Inches(0.4), Inches(1), Inches(0.3),
                f"{num} / {total}", size=9, color=GRAY, align=PP_ALIGN.RIGHT)


# 1. 표지
def slide_cover():
    s = prs.slides.add_slide(BLANK)
    add_band(s, NAVY, 0, 0, SW, SH)
    add_band(s, ACCENT, 0, Inches(3.4), SW, Inches(0.08))
    add_textbox(s, Inches(0.8), Inches(2.0), Inches(10), Inches(0.6),
                "AI-STUDIO", size=14, bold=True, color=RGBColor(0x60, 0xA5, 0xFA))
    add_textbox(s, Inches(0.8), Inches(2.6), Inches(11), Inches(1.2),
                "시연 사용설명서", size=54, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    add_textbox(s, Inches(0.8), Inches(4.0), Inches(11), Inches(0.6),
                "v2.3.0 · 강사 · 수강생 · 운영자 시연 가이드",
                size=22, color=RGBColor(0xCB, 0xD5, 0xE1))
    add_textbox(s, Inches(0.8), Inches(6.6), Inches(11), Inches(0.4),
                "KEG · Korean Education Group   |   작성: 2026-05-18",
                size=12, color=RGBColor(0x94, 0xA3, 0xB8))


# 2. 데모 계정
def slide_accounts():
    s = prs.slides.add_slide(BLANK)
    add_header(s, "1. 데모 계정")
    add_textbox(s, Inches(0.5), Inches(0.9), Inches(12), Inches(0.5),
                "공통 비밀번호: rlarudtn2!  ·  로그인 후 role 기반 자동 라우팅",
                size=14, color=GRAY)

    rows = [
        ("역할", "이메일", "진입 화면", True, RGBColor(0xE2, 0xE8, 0xF0)),
        ("수강생 (user)", "demo-student@ai-studio.kr", "/dashboard", False, RGBColor(0xFF, 0xFF, 0xFF)),
        ("강사 (instructor)", "demo-instructor@ai-studio.kr", "/instructor/dashboard", False, LIGHT),
        ("운영자 (operations)", "demo-ops@ai-studio.kr", "/operations/dashboard", False, RGBColor(0xFF, 0xFF, 0xFF)),
    ]
    y = Inches(1.7)
    for role, email, path, header, bg in rows:
        add_band(s, bg, Inches(0.5), y, Inches(12.3), Inches(0.7))
        add_textbox(s, Inches(0.7), y + Inches(0.18), Inches(3.2), Inches(0.5),
                    role, size=14, bold=header, color=NAVY)
        add_textbox(s, Inches(4.0), y + Inches(0.18), Inches(5.2), Inches(0.5),
                    email, size=13, bold=header, color=NAVY)
        add_textbox(s, Inches(9.3), y + Inches(0.18), Inches(3.3), Inches(0.5),
                    path, size=13, bold=header, color=ACCENT if not header else NAVY)
        y += Inches(0.7)

    add_textbox(s, Inches(0.5), Inches(5.2), Inches(12.3), Inches(0.4),
                "로그인 화면에서 → 비밀번호로 로그인 토글 후 사용",
                size=12, color=GRAY)
    add_textbox(s, Inches(0.5), Inches(5.7), Inches(12.3), Inches(1.5),
                "주의: 시연용 약한 비밀번호. 시연 종료 즉시\n"
                "  npx tsx scripts/seed-demo-users.ts --cleanup\n"
                "으로 삭제 권장.",
                size=12, color=RGBColor(0xB4, 0x53, 0x09))


# 3. 시연 시나리오
def slide_scenario():
    s = prs.slides.add_slide(BLANK)
    add_header(s, "2. 시연 시나리오 (15분)")
    rows = [
        ("분", "화면", "보여줄 포인트", True, RGBColor(0xE2, 0xE8, 0xF0)),
        ("0-1", "메인 + 로그인", "원클릭 SSO·매직링크 둘 다 제공", False, RGBColor(0xFF, 0xFF, 0xFF)),
        ("1-4", "강사 → Studio", "주제 한 줄 → 13개 에이전트가 책 한 권 5분에 생성", False, LIGHT),
        ("4-6", "강사 → Cast", "PPT 1장 → 영상까지 7개 에이전트 자동", False, RGBColor(0xFF, 0xFF, 0xFF)),
        ("6-9", "수강생 → AI 튜터", "이해도 자동 측정 → 운영자에 자동 알림", False, LIGHT),
        ("9-11", "수강생 → 코스/프로필", "수료증·동의 철회까지 학습자가 자기 데이터 통제", False, RGBColor(0xFF, 0xFF, 0xFF)),
        ("11-13", "운영자 → 티켓/KPI", "고객 성공 자동화 + 데이터 기반 결정", False, LIGHT),
        ("13-15", "통합 슈퍼 어드민", "Phase 4 게이트·G4-C 결정 화면 (본부장 계정)", False, RGBColor(0xFF, 0xFF, 0xFF)),
    ]
    y = Inches(1.0)
    for tm, scr, note, header, bg in rows:
        add_band(s, bg, Inches(0.5), y, Inches(12.3), Inches(0.65))
        add_textbox(s, Inches(0.7), y + Inches(0.15), Inches(1.2), Inches(0.5),
                    tm, size=13, bold=True, color=ACCENT if not header else NAVY)
        add_textbox(s, Inches(2.0), y + Inches(0.15), Inches(3.5), Inches(0.5),
                    scr, size=13, bold=header, color=NAVY)
        add_textbox(s, Inches(5.6), y + Inches(0.15), Inches(7.0), Inches(0.5),
                    note, size=12, bold=header, color=NAVY)
        y += Inches(0.65)


# 4. 페이지 슬라이드 (캡쳐 + 설명) — overview 문장 + bullets
PAGES = [
    # (section, title, overview, bullets[], image_path)
    ("공통", "메인 (/)",
     "비로그인 사용자가 처음 마주하는 진입점. 5초 안에 ai-studio의 가치 제안을 전달하고 3대 솔루션으로 안내합니다.",
     ["3대 솔루션(Studio·Cast·Tutor) 카드 소개", "히어로 + CTA → 로그인/회원가입", "다크 모드 토글 (전체 공통)"],
     SCREENS / "common" / "01-home.png"),
    ("공통", "로그인 (/login)",
     "Supabase Auth 기반 로그인. 매직 링크가 기본이며, 시연·관리자 편의를 위해 비밀번호 로그인도 토글로 제공합니다.",
     ["기본 매직 링크 모드 → Resend 1회용 메일", "하단 토글 → 비밀번호 로그인", "IP brute-force 방어 15분/5회", "role 기반 자동 라우팅"],
     SCREENS / "common" / "02-login.png"),
    ("공통", "회원가입 (/signup)",
     "신규 사용자 가입. 가입 즉시 트리거가 profiles 행을 만들고, 약관·개인정보 동의 이력은 consent_log에 영구 보관됩니다.",
     ["이메일·비밀번호(8자+)·이름·약관 동의", "가입 즉시 profiles 행 자동 생성 (트리거)", "데모는 email_confirm 자동 처리"],
     SCREENS / "common" / "03-signup.png"),
    ("공통", "요금제 (/pricing)",
     "B2C·B2B 양쪽을 모두 커버하는 4단 플랜. Stripe Checkout으로 카드·해외결제까지 1클릭 처리합니다.",
     ["Free / Starter / Pro / Enterprise 4단", "Stripe 연동 — 구독 시 Checkout Session", "데모는 Stripe Test mode"],
     SCREENS / "common" / "04-pricing.png"),
    ("공통", "블로그 (/blog)",
     "SEO·콘텐츠 마케팅 채널. 제품 업데이트·교육 인사이트·고객 사례를 발행해 검색 유입을 만듭니다.",
     ["발행된 blog_posts 카드 리스트", "카테고리 필터 (제품/인사이트/케이스)", "SEO 채널 — /admin/marketing에서 작성"],
     SCREENS / "common" / "05-blog.png"),

    ("수강생", "대시보드 (/dashboard)",
     "수강생이 로그인 후 가장 먼저 보는 화면. 지금 이어서 학습할 코스, 이번 주 목표, 새 알림을 한 페이지에서 처리합니다.",
     ["진행 중 코스 + 이번 주 학습 목표", "강사 메시지 / 수료 임박 알림", "이력 기반 추천 코스", "Server Component + cache()"],
     SCREENS / "student" / "10-dashboard.png"),
    ("수강생", "AI 튜터 (/tutor)",
     "9개 에이전트가 협업하는 1:1 대화 학습. 학생의 이해도를 실시간으로 측정해 임계치 미만이면 운영자에게 자동 알립니다.",
     ["9개 에이전트 4팀 (Intent→RAG→Answer→Eval)", "코스 자료 인용 출처 표시", "이해도 자동 측정 → admin_alerts", "<50% 시 운영자 알림 자동"],
     SCREENS / "student" / "11-tutor.png"),
    ("수강생", "수강 가능 코스 (/courses)",
     "SME 평가를 통과한 코스 카탈로그. 카테고리 필터로 좁힌 뒤 1클릭 수강 신청으로 student_enrollments에 등록됩니다.",
     ["카테고리 필터 (자격증/직무/언어/취미/학술)", "studio_jobs is_sample=true 노출", "신청 → student_enrollments 행 생성"],
     SCREENS / "student" / "12-courses.png"),
    ("수강생", "학습 샘플 (/samples)",
     "신규 사용자가 결제 없이 체험할 수 있는 무료 콘텐츠. 샘플 → 유료 전환율은 사업의 핵심 퍼널 지표입니다.",
     ["SME 3축 평가 통과 콘텐츠", "정확성·완전성·일관성 점수 표시", "샘플 → 유료 전환 퍼널의 핵심"],
     SCREENS / "student" / "13-samples.png"),
    ("수강생", "문의 (/support)",
     "수강생이 직접 문의를 등록하는 창구. 제출 즉시 운영자에게 이메일이 발송되고, 본인 티켓만 RLS로 보호됩니다.",
     ["카테고리 4종 (기술/콘텐츠/결제/기타)", "제출 → support_tickets 행 + 운영자 이메일", "본인 티켓만 조회 (RLS)"],
     SCREENS / "student" / "14-support.png"),
    ("수강생", "온보딩 (/onboarding)",
     "가입 직후 5단계로 진행되는 첫 경험. 학습 목표·관심사·동의를 한 번에 수집해 이후 추천·알림에 활용합니다.",
     ["5단계 (목표·관심·시간·알림·약관)", "consent_log에 동의 이력 기록", "미완료 시 대시보드 진입 차단"],
     SCREENS / "student" / "15-onboarding.png"),

    ("강사", "강사 대시보드 (/instructor/dashboard)",
     "강사 본인의 강의·학생·수익을 한눈에. 운영자 알림·SME 검수 대기·인센티브 정산을 동시에 확인합니다.",
     ["상단 KPI 4종 (강의·수강·매출·NPS)", "콘텐츠 제안·SME 검수·인센티브 알림", "최근 7일 학생 대화 요약"],
     SCREENS / "instructor" / "20-dashboard.png"),
    ("강사", "Studio (/studio)",
     "13개 에이전트 4팀이 협업해 주제 한 줄을 책·슬라이드·퀴즈로 변환. 모든 단계 비용·로그·평가가 자동 기록됩니다.",
     ["13개 에이전트 4팀 — Book·Slide·Quiz 생성", "TEAM 1~4 입력검증·생성·조정·SME평가", "모든 호출 비용 cost_log 기록", "실패 시 agent_logs에 단계별 에러"],
     SCREENS / "instructor" / "21-studio.png"),
    ("강사", "Cast (/cast)",
     "PPT 한 장에서 영상까지 7개 에이전트가 자동 처리. 슬라이드 10장 기준 3-5분, 슬라이드당 약 $0.30 비용입니다.",
     ["7개 에이전트 4팀 PPT → 영상 파이프라인", "TTS · HeyGen · Whisper 자막", "슬라이드 10장 기준 3-5분 / $0.30/슬라이드", "산출물: 영상·자막·이미지 패키지"],
     SCREENS / "instructor" / "22-cast.png"),
    ("강사", "Studio Pro (/studio-pro)",
     "강사 본인 자료를 RAG로 학습시켜 강사 고유 스타일을 보존한 콘텐츠를 생성. 음성·말투까지 1회 등록으로 모든 작업에 자동 적용됩니다.",
     ["강사 자료(PDF/PPT/음성) RAG 인덱싱", "강사 스타일(말투·구조) 분석", "본인 음성 1회 등록 → Cast에 자동 적용", "Phase 4 핵심 차별화 기능"],
     SCREENS / "instructor" / "23-studio-pro.png"),
    ("강사", "강사 자산 (/instructor/assets)",
     "사진·음성·문서를 한곳에서 관리. 자산이 어느 코스·Cast 작업에 쓰였는지 역추적이 가능합니다.",
     ["사진·음성·PDF/PPT 통합 관리", "자산별 사용 위치 표시 (코스/Cast)", "메타데이터 편집 + 미리보기"],
     SCREENS / "instructor" / "24-assets.png"),
    ("강사", "콘텐츠 제안 (/instructor/proposals)",
     "강사가 신규 코스 주제를 직접 제안하는 채널. 관리자 승인 시 Studio 큐로 자동 이관됩니다.",
     ["신규 코스 주제 제안 → 관리자 승인", "draft / submitted / approved / rejected", "승인 시 Studio 큐 자동 추가"],
     SCREENS / "instructor" / "25-proposals.png"),
    ("강사", "강사 NPS (/instructor/nps)",
     "분기별 강사 NPS를 추적해 학습자 만족도를 정량 관리. 30점 미만이면 자동으로 코칭 트리거가 발동합니다.",
     ["분기별 NPS (Promoter% − Detractor%)", "학습자 자유 의견 모음", "NPS < 30 → 강사 코칭 트리거"],
     SCREENS / "instructor" / "26-nps.png"),
    ("강사", "강사 교육 (/instructor/training)",
     "신규 강사 온보딩 + 기존 강사 역량 강화 프로그램. 4 모듈 완료 시 Verified Instructor 배지가 부여됩니다.",
     ["4 모듈 (사용법·품질·케어·고급)", "instructor_training_progress 기록", "전체 완료 = Verified Instructor 배지"],
     SCREENS / "instructor" / "27-training.png"),
    ("강사", "주간 리포트 (/instructor/weekly-report)",
     "매주 월요일 아침에 자동 생성·발송되는 강사용 KPI 리포트. 본인 페이스와 정산 예상액을 한 페이지로 점검합니다.",
     ["시청 시간·신규 등록·이해도·신고", "인센티브 정산 예상액", "월요일 06:00 자동 메일 발송"],
     SCREENS / "instructor" / "28-weekly-report.png"),

    ("운영자", "운영팀 대시보드 (/operations/dashboard)",
     "운영자가 하루를 시작하는 화면. 처리해야 할 큐(베타·CS·위험·인시던트)와 비용·활성도를 한 페이지에 모았습니다.",
     ["KPI 4종 (베타·CS·위험알림·인시던트)", "비용: 오늘/월/예산 진행률", "학생 활성도 + 자주 쓰는 페이지 6종"],
     SCREENS / "operations" / "30-dashboard.png"),
    ("운영자", "위험 학습자 (/admin/at-risk-students)",
     "이탈 위험이 있는 학습자를 자동으로 선별해 케어 메시지로 회복을 시도합니다. 발송 효과는 care_messages_log로 추적합니다.",
     ["기준: 7일 로그인 없음 / 이해도<50% / 과제미제출", "위험 점수 0-100", "케어 메시지 발송 → care_messages_log"],
     SCREENS / "operations" / "31-at-risk.png"),
    ("운영자", "이메일 로그 (/admin/email-log)",
     "시스템이 보낸 모든 이메일(인증·알림·케어·청구)을 단일 큐로 추적. 실패 항목은 1클릭 재발송이 가능합니다.",
     ["전체 시스템 이메일 통합 추적", "상태별 필터 + 실패 재발송", "Resend ID 저장 → 대시보드 역추적"],
     SCREENS / "operations" / "32-email-log.png"),
    ("운영자", "모니터링 (/admin/monitoring)",
     "시스템 헬스·트래픽·비용을 실시간 통합 모니터링. 가장 비싼 작업 Top 10을 보고 비용 폭주를 조기에 발견합니다.",
     ["DB·Storage·Stripe·Resend 헬스", "트래픽·에러율·상위 비용 작업", "/api/admin/db-check 마이그레이션 검증"],
     SCREENS / "operations" / "33-monitoring.png"),
    ("운영자", "콘텐츠 조치 (/admin/remediation)",
     "학습자 신고를 검토하고 조치하는 작업 큐. 24시간 SLA를 추적하고 반복 신고된 콘텐츠는 자동 우선순위로 올립니다.",
     ["신고 → 검토 → 조치 → 통보 흐름", "SLA 24h 추적", "반복 신고 콘텐츠 자동 강조"],
     SCREENS / "operations" / "34-remediation.png"),
    ("운영자", "런북 (/admin/runbook)",
     "장애·CS·비용·삭제 요청에 대한 표준 대응 절차. 신규 운영자가 첫 주에 학습할 단일 가이드입니다.",
     ["장애·CS·비용·삭제요청 표준 절차", "마크다운 + 검색", "신규 운영자 첫 주 학습 가이드"],
     SCREENS / "operations" / "35-runbook.png"),
    ("운영자", "수강생 관리 (/admin/students)",
     "전체 수강생을 검색·필터·일괄 작업으로 처리. v2.3.0에서 검색·CSV·일괄 작업 인프라가 추가되어 운영 효율이 크게 개선됐습니다.",
     ["이름·이메일·이력·이해도·위험점수", "SearchFilter + BulkActionBar (v2.3)", "CSV 내보내기 (UTF-8 BOM Excel 호환)", "상세 → 학습·결제·동의·티켓 통합"],
     SCREENS / "operations" / "36-students.png"),
]


def slide_page(section, title, overview, bullets, img_path, idx, total):
    s = prs.slides.add_slide(BLANK)
    add_header(s, f"{section} — {title}", f"{idx} / {total}")

    # 좌측 섹션 라벨 칩
    add_band(s, ACCENT, Inches(0.4), Inches(0.95), Inches(1.0), Inches(0.4))
    add_textbox(s, Inches(0.45), Inches(0.98), Inches(1.0), Inches(0.4),
                section, size=11, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), align=PP_ALIGN.CENTER)

    # 타이틀
    add_textbox(s, Inches(0.5), Inches(1.5), Inches(3.8), Inches(0.7),
                title, size=20, bold=True, color=NAVY)

    # 개요 (overview) — 본문 prose 한 단락
    ov_tb = s.shapes.add_textbox(Inches(0.5), Inches(2.25), Inches(3.8), Inches(1.6))
    ov_tf = ov_tb.text_frame
    ov_tf.word_wrap = True
    ov_p = ov_tf.paragraphs[0]
    ov_p.alignment = PP_ALIGN.LEFT
    ov_run = ov_p.add_run()
    ov_run.text = overview
    ov_run.font.size = Pt(12)
    ov_run.font.color.rgb = GRAY
    ov_run.font.italic = True
    ov_run.font.name = "맑은 고딕"

    # 구분선
    sep = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.5), Inches(4.0), Inches(0.4), Emu(20000))
    sep.fill.solid()
    sep.fill.fore_color.rgb = ACCENT
    sep.line.fill.background()

    # 주요 기능 라벨
    add_textbox(s, Inches(0.5), Inches(4.05), Inches(3.8), Inches(0.3),
                "주요 기능", size=10, bold=True, color=ACCENT)

    # 불릿
    tb = s.shapes.add_textbox(Inches(0.5), Inches(4.45), Inches(3.8), Inches(2.6))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, b in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(6)
        # bullet point
        r1 = p.add_run()
        r1.text = "•  "
        r1.font.size = Pt(13)
        r1.font.bold = True
        r1.font.color.rgb = ACCENT
        r1.font.name = "맑은 고딕"
        r2 = p.add_run()
        r2.text = b
        r2.font.size = Pt(12)
        r2.font.color.rgb = NAVY
        r2.font.name = "맑은 고딕"

    # 우측 스크린샷 (캡쳐 영역 박스 + 이미지 fit)
    img_left = Inches(4.5)
    img_top = Inches(1.0)
    img_max_w = Inches(8.5)
    img_max_h = Inches(5.9)
    # 배경 박스 (연한 그림자 느낌)
    bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, img_left - Emu(20000), img_top - Emu(20000),
                            img_max_w + Emu(40000), img_max_h + Emu(40000))
    bg.fill.solid()
    bg.fill.fore_color.rgb = LIGHT
    bg.line.color.rgb = RGBColor(0xE2, 0xE8, 0xF0)

    if img_path.exists():
        # PIL로 비율 계산
        from PIL import Image
        with Image.open(img_path) as im:
            iw, ih = im.size
        ratio = iw / ih
        # 가능한 최대 크기 결정
        if img_max_w / ratio <= img_max_h:
            w = img_max_w
            h = int(img_max_w / ratio)
        else:
            h = img_max_h
            w = int(img_max_h * ratio)
        # 가운데 정렬
        cx = img_left + (img_max_w - w) // 2
        cy = img_top + (img_max_h - h) // 2
        s.shapes.add_picture(str(img_path), cx, cy, width=w, height=h)
    else:
        add_textbox(s, img_left, img_top + Inches(2.5), img_max_w, Inches(0.5),
                    f"[이미지 없음: {img_path.name}]",
                    size=14, color=GRAY, align=PP_ALIGN.CENTER)


# 5. 마지막 슬라이드
def slide_closing():
    s = prs.slides.add_slide(BLANK)
    add_band(s, NAVY, 0, 0, SW, SH)
    add_textbox(s, Inches(0.8), Inches(2.5), Inches(11), Inches(1.0),
                "재캡쳐 / 데모 계정 갱신",
                size=32, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
    add_band(s, ACCENT, Inches(0.8), Inches(3.6), Inches(2.5), Inches(0.06))
    cmds = [
        "# 1) 데모 계정 비밀번호·role 재설정",
        "npm run seed:demo",
        "",
        "# 2) 모든 페이지 스크린샷 갱신",
        "BASE_URL=https://ai-studio-drab-nine.vercel.app \\",
        "  npm run capture",
        "",
        "# 3) 시연 종료 후 데모 계정 삭제",
        "npx tsx scripts/seed-demo-users.ts --cleanup",
    ]
    add_textbox(s, Inches(0.8), Inches(4.0), Inches(11), Inches(2.5),
                "\n".join(cmds), size=14, color=RGBColor(0xCB, 0xD5, 0xE1))
    add_textbox(s, Inches(0.8), SH - Inches(0.8), Inches(11), Inches(0.4),
                "문의: aureinstudio@gmail.com",
                size=12, color=RGBColor(0x94, 0xA3, 0xB8))


# 빌드
slide_cover()
slide_accounts()
slide_scenario()
total_pages = len(PAGES)
for i, (section, title, overview, bullets, img) in enumerate(PAGES, start=1):
    slide_page(section, title, overview, bullets, img, i, total_pages)
slide_closing()

# 페이지 번호 자동 삽입 (cover, accounts, scenario, [pages...], closing)
total = len(prs.slides.__iter__.__self__._sldIdLst) if False else 0  # placeholder
slides_list = list(prs.slides)
total = len(slides_list)
for idx, slide in enumerate(slides_list, start=1):
    if idx == 1 or idx == total:
        continue
    add_footer(slide, idx, total)

OUT.parent.mkdir(parents=True, exist_ok=True)
prs.save(OUT)
print(f"OK {OUT} ({total} slides)")
