---
language: korean
formatting:
  tables: minimum
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# 현재 구조 (As-Is)

## 자동 생성 루프와 시드 규칙

App.tsx 내부의 executeLoop는 재귀 setTimeout 기반.
intervalRef/targetCountRef를 useRef로 읽어 루프 중 실시간 조절 가능.

시드 규칙 4가지:
- 일반 (none): Generate 버튼만 클릭. 메타데이터 미주입. 사용자가 NAI UI에서 직접 설정한 값 유지.
- 랜덤 (random): 매 루프마다 랜덤 시드를 메타데이터에 넣어 페이스트. 동일 프롬/설정에서 시드 중복 방지.
- 증가/감소 (increment/decrement): 시드를 ±1하여 메타데이터 페이스트. 순차 탐색용.

프리셋 큐 활성 시: 매 루프마다 다음 프리셋을 localStorage에서 로드 → 메타데이터 페이스트.

## 현재 구조의 문제점

App.tsx가 500줄 이상의 God Component:
- handleApply 안에 executeLoop가 중첩 정의 (100줄 이상의 비동기 함수)
- 자동 생성 상태(intervalSec, targetCount, seedRule 등)가 낱개 useState로 흩어져 있음
- UI 렌더링과 자동 생성 비즈니스 로직이 한 파일에 혼재

---

# 목표 구조 (To-Be) — 리팩토링 방향

## 자동 생성 로직 분리

executeLoop와 관련 상태/로직을 커스텀 훅으로 분리:

```
src/
├── hooks/
│   ├── useMetadataState.ts     (기존 유지)
│   └── useAutoGenerator.ts     [NEW] 자동 생성 루프, 시드 규칙, 프리셋 큐 순환 로직
```

이렇게 하면 App.tsx는 "UI 껍데기"만 담당하고, 자동 생성 로직은 독립적으로 테스트/확장 가능.
프리셋 프로그레션 기능 추가 시 useAutoGenerator.ts만 수정하면 됨.

## 자동 생성 설정 UI 분리

App.tsx의 return문 안에 하드코딩된 자동 생성 UI를 별도 컴포넌트로:

```
src/
├── components/
│   └── AutoGeneratePanel.tsx   [NEW] 시드 규칙 드롭다운, 간격/횟수 입력, +/- 버튼
```

## 추후 확장을 위한 자리 (향후 로드맵 연결)

- useAutoGenerator 내부에 "다음 state와 seed를 결정하는 함수"를 분리해두면, 프리셋 프로그레션/로테이션 로직을 끼워넣기 쉬움
- DB 연동 시 presetStorage.ts의 localStorage → DB 어댑터로 교체 가능하도록 인터페이스 유지
- 태그 시스템 추가 시 model/ 하위에 태그 관련 모듈 배치

---

# 할 일 목록

## 1순위 — 기초 토대
- [ ] DB 구조 설계 (`{ id, keyword, category, weight, isEnabled, isNegative }`)
- [ ] 디자인 시스템 구성
- [ ] NovelAI API 연동 테스트

## 2순위 — 핵심 파이프라인
- [ ] 자연어 → Danbooru 태그 변환 AI
- [ ] 태그 가중치 편집 UI (막대그래프 + 슬라이더)
- [ ] 프롬프트 컴파일러 (태그 객체 배열 → NovelAI 문법 문자열)
- [ ] 이미지 생성 호출 및 결과 출력

## 3순위 — 관리 기능
- [ ] 틴더식 스와이프 이미지 선별 UI
- [ ] 이미지 오류 탐지 (비전 AI 히트맵)
- [ ] 탭-투-마스크 인페인팅 보조
- [ ] 이미지 나란히 비교 UI
- [ ] 프롬프트 히스토리 보관함 (검색 · 재활용)

## 3순위 — 작성 편의 기능
- [ ] 태그 칩 드래그 앤 드롭 (순서 재배치)
- [ ] 부정 프롬프트 템플릿 토글
- [ ] 프롬프트 재조합 AI 추천
- [ ] 스마트 탭 자동 분류 ([인물], [배경], [구도] 등)
- [ ] 바텀 시트 가중치 조절 팝업
- [ ] 만화/스토리보드 생성 모드

## 3순위 — 자동화
- [ ] AI 사용 패턴 기반 프롬프트 추천 보고서
- [ ] DB Import/Export 지원
- [ ] 기기 간 동기화 (Firebase/Supabase + Google 로그인)

## 나중에
- [ ] AI 어시스턴트 성격·말투 설정
- [ ] 사용자 취향 통계 UI
- [ ] 온보딩 화면 구성
- [ ] 앱 이름 결정 (후보: PromptAIO, TagMaster AIO, OmniPrompt, DanbooruAIO, AIO Canvas)
- [ ] iOS/Android 제스처 충돌 검증 (3손가락 탭, 2손가락 더블 탭 등)
- [ ] API 키 클라이언트 보안 방안 확정