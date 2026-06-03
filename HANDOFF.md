---
language: korean
formatting:
  tables: false
  bold emphasis: false
  blockquotes: false
writing:
  preamble: false
  filler: false
  closing summary: false
  asides: false
---

# Handoff — 2026-03-13

## 맥락
NovelAI 이미지 생성 페이지에 주입하는 북마클릿 기반 태그 빌더.
빌드 성공 (`dist/nai-tag-builder.js`), GitHub Pages 배포 중.

코드베이스 정비 9개 항목 전부 완료, 사이트 테스트 통과. 로드맵 1순위(기초 토대) 의사결정 1차 탐색 시작.

## 완료
- 코드베이스 정비 9/9 완료 + 배포 + 사이트 테스트 통과
  - D1(00861f2), R3(00861f2), R4(00861f2), D2(d59f4c2), R1(d95e6ac), R5(ff8a637), R2(27982ab), C1(fb9c9f6), C2(27fc72e)
  - D2 누락 2파일 + ImportModal seed 버그 수정 (d59f4c2)
  - 빌드+배포: 76d5759 (R5+R2+C1+C2)
- ARCHITECTURE.md As-Is 갱신 (17a2d4d) — 현행 코드 상태 반영
- 로드맵 1순위 의사결정 1차 탐색 (decision-making/roadmap-p1/1.md)
  - DB 구조: TagEntry에 order/scope 추가 잠정 결정
  - 디자인 시스템: 외부 라이브러리 미도입, 내부 공용 컴포넌트 점진 추출
  - API 연동: 1순위에서 제외, DOM 자동화로 범위 재정의

## 대화 기록
User: 사이트 테스트 완료. ARCHITECTURE.md 할 일 목록(1순위)으로 넘어가라.

AI: 1순위 3항목(DB 구조, 디자인 시스템, API 연동) 탐색. TagEntry 스키마 갭 발견 (order/scope 누락). API 직접 연동은 제외하고 DOM 자동화로 전환. 잠정 결정 4개 + 심화 미결 5건 도출.

User: wrap-up.

## 다음
1. 로드맵 1순위 2차 심화 — 심화 미결 5건 해소:
   - TagEntry category 값 체계 (Danbooru vs 커스텀)
   - basePrompt ↔ TagEntry[] source of truth 결정
   - 기존 프리셋 마이그레이션 전략
   - TagChip 시각 디자인
   - DOM 자동화 범위 확인 (useAutoGenerator와 중복?)
2. 심화 완료 후 구현 진입

## 검증 지시
N/A

## 참고 파일
- decision-making/roadmap-p1/1.md — 1차 탐색 (DB/디자인/API 잠정 결정)
- decision-making/codebase-overhaul/feedback_decision_making.md — 의사결정 프로세스 교정
- docs/ARCHITECTURE.md — 현행 구조 + 할 일 목록
- src/model/db.ts — TagEntry 스키마 (미사용)
- src/utils/intensityParser.ts — 현재 태그 파싱 로직

## 보류
- 9개 컴포넌트 전체 useTheme() 마이그레이션 — 코드 품질, 버그 아님
- Priority 2 — 자연어→Danbooru 태그 변환, 태그 가중치 편집 UI, 프롬프트 컴파일러, 이미지 생성 호출
- Priority 3 — ARCHITECTURE.md 참조
