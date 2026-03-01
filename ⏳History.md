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

## 주입 방식

```
북마클릿 (사용자 탭)
  → <script src="...github.io/nai-tag-builder.js">
    → main.tsx: fixed-position 컨테이너 div 생성
      → ReactDOM.createRoot + flushSync로 <App/> 렌더링
```

- flushSync 필수: NovelAI의 React 19와 번들된 React의 async scheduler가 충돌하여 없으면 빈 DOM 생성
- 컨테이너: `position: fixed; top: 20px; right: 20px; z-index: 999999`
- 글로벌 CSS 미사용: NovelAI UI 침범 방지. 모든 스타일은 inline + theme.ts

## 모듈 구조

```
src/
├── main.tsx                    진입점. DOM 컨테이너 + React 마운트.
├── App.tsx                     루트 컴포넌트. 오버레이, 드래그, 접기, 자동생성 루프, 프리셋 큐.
│
├── types/
│   ├── metadata.ts             NovelAI V4 Comment JSON 타입 정의.
│   └── preset.ts               프리셋 인터페이스, QueueMode 타입.
├── model/
│   ├── defaults.ts             메타데이터 필드 기본값.
│   ├── buildCommentJson.ts     UI state → Comment JSON 변환.
│   └── presetStorage.ts        localStorage CRUD (프리셋 저장/로드/삭제/정렬/내보내기/가져오기).
│
├── encoding/
│   ├── pngEncoder.ts           PNG 생성: tEXt 청크 + stealth_pngcomp LSB 인코딩.
│   └── pasteDispatch.ts        붙여넣기 이벤트 디스패치 + 사후 자동화 (Import Metadata → Generate 클릭).
│
├── hooks/
│   └── useMetadataState.ts     useReducer 중앙 상태. LOAD_PRESET 액션 포함.
│
├── components/
│   ├── PresetManager.tsx       프리셋 저장/불러오기/삭제 UI, 큐 관리 (Progression/Random 모드).
│   ├── PromptSection.tsx       베이스 프롬프트 textarea.
│   ├── GenerationParams.tsx    해상도 프리셋, steps/scale (슬라이더+숫자), sampler/noise/seed.
│   ├── CharacterCaptions.tsx   다중 캐릭터 항목 (x/y 좌표).
│   ├── NegativePrompt.tsx      네거티브 프롬프트.
│   ├── AdvancedParams.tsx      CFG rescale, SMEA, dynamic thresholding 등.
│   ├── CollapsibleSection.tsx  접기/펼치기 래퍼.
│   └── ApplyButton.tsx         적용 버튼.
│
└── styles/theme.ts             Catppuccin Mocha 팔레트 + 공유 스타일.
```

## 데이터 흐름

```
사용자 입력
  → useMetadataState (useReducer)
    → buildCommentJson(state) → Comment JSON
      → pngEncoder: tEXt 청크 + LSB 스텔스 인코딩 → PNG Blob
        → pasteDispatch: ClipboardEvent('paste') → .ProseMirror
          → autoImportAndScroll:
              "Import Metadata" 버튼 대기 → 클릭
              모달 닫힘 대기 → Generate 클릭
```

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

# 아이디어 노트
1. 세팅값 게이지바로 조절하기
2. seed 숫자 같아서 못 만들고 있는 거 방지하기
    - 추후 seed 숫자 이용해서 프롬 Before/After 비교하기
3. 프롬프트 입력 창의 크기를 늘리거나 줄일 수 있는 기능만들기
4. DB 연동해서 캐릭터 태그 불러오기
5. 프롬프트 프리셋 Progression, Rotation, Randomization 기능 만들기
6. DB Import/Export 기능
7. 북마클릿 켜면 나오는 디폴트 값 실제 NovelAI에서 쓰는 프롬프트로 바꾸기
8. **프롬프트 및 설정** 조작 사용자 친화적으로 만들기

---

# 추후 할 일 목록

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