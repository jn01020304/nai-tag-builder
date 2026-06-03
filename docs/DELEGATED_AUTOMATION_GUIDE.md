# 위임형 자동화 리팩토링 가이드

이 문서는 `nai-tag-builder`를 기능 추가 전에 구조적으로 안정화하기 위한 실행 기준선이다.
상위 제품 원칙은 “사용자는 작업자가 아니라 감독자”라는 관점이며, 구현 기준은 “상태, 계획, 인코딩, 외부 실행, UI 투영을 서로 섞지 않는다”이다.

## 1. 현재 제품의 성격

`nai-tag-builder`는 일반적인 프롬프트 편집기가 아니다.
NovelAI 이미지 생성 페이지 위에 주입되는 북마크릿 오버레이이며, 사용자의 메타데이터 상태를 NovelAI가 읽을 수 있는 PNG 산출물로 바꾼 뒤 paste 이벤트를 통해 외부 앱에 위임하는 자동화 도구다.

따라서 이 프로젝트의 핵심 워크플로우는 다음 순서로 보아야 한다.

1. 사용자가 프롬프트, 생성 파라미터, 고급 설정을 상태로 구성한다.
2. 내부 상태를 NovelAI Comment JSON으로 계획한다.
3. Comment JSON을 PNG tEXt 청크와 stealth_pngcomp LSB에 인코딩한다.
4. 브라우저 Clipboard/Paste 이벤트로 NovelAI 페이지에 전달한다.
5. NovelAI 페이지의 Import Metadata 동작과 Generate 상태를 확인한다.
6. 자동 생성 루프에서는 한 작업의 성공, 실패, 취소, 대기를 세션 단위로 닫은 뒤 다음 작업으로 넘어간다.

이 흐름 중 어느 단계도 UI 렌더링 함수 안에서 직접 수행되어서는 안 된다.

## 2. 단일 진실 공급원

현재 기준으로 가장 신뢰할 수 있는 프로젝트 기록은 다음 순서로 본다.

1. 현재 세션에서 직접 실행한 검증 결과
2. `one-pager.md`의 Evergreen과 Findings
3. `HANDOFF.md`의 현재 작업 상태
4. `docs/ARCHITECTURE.md`의 As-Is 구조
5. `decision-making/`의 결정 기록

특히 `one-pager.md`의 다음 결론은 리팩토링 중 뒤집으면 안 된다.

- NovelAI 웹 프론트엔드는 paste와 file upload에서 PNG tEXt 청크를 읽는다.
- Import Metadata 트리거에는 `Title`, `Description`, `Software`, `Source`, `Generation time`, `Comment` 6개 tEXt 청크가 필요하다.
- `Comment`에는 NovelAI Comment JSON이 들어간다.
- stealth_pngcomp LSB는 방어적 호환성 목적으로 유지하지만, 웹 프론트엔드 import 감지의 주 경로는 tEXt다.
- React 19 기반 NovelAI 페이지에서 직접 DOM input 조작은 안정적인 주 경로가 아니다.
- seed 0은 random이 아니라 NovelAI의 literal fixed seed다.
- 모바일에서는 NovelAI 파라미터 패널이 DOM에서 완전히 unmount될 수 있다.

## 3. 파일별 책임 계약

### 3.1. 상태 계약

대상 파일:

- `src/types/metadata.ts`
- `src/hooks/useMetadataState.ts`
- `src/model/defaults.ts`
- `src/model/presetStorage.ts`
- `src/model/db.ts`

책임:

- `MetadataState`는 앱의 비즈니스 상태 계약이다.
- UI 컴포넌트는 이 상태를 화면에 투영하고 사용자 입력을 액션으로 전달한다.
- 저장소 로직은 로드 시 항상 정규화해야 한다.
- 상태 스키마가 변경될 때 기존 IndexedDB 데이터가 손상되면 안 된다.

금지:

- 컴포넌트 내부에서 별도의 비즈니스 상태 원본을 만드는 것
- 외부 NovelAI DOM 값을 내부 상태의 원천으로 신뢰하는 것
- import 시 사용자가 선택하지 않은 필드를 빈 값이나 기본값으로 덮어쓰는 것

검수 포인트:

- `normalizeMetadataState()`가 모든 저장소 진입점에 적용되는가
- shallow merge로 nested 상태를 통째로 날리는 경로가 없는가
- `basePrompt`와 향후 `TagEntry[]` 중 무엇이 source of truth인지 명확한가

### 3.2. 계획 계약

대상 파일:

- `src/model/buildCommentJson.ts`

책임:

- `MetadataState`를 NovelAI Comment JSON으로 변환한다.
- 사용자 입력과 시스템 파생값의 차이를 명확히 만든다.
- seed 0이 들어왔을 때 실제 적용 seed를 결정하고, 그 결정이 추적 가능해야 한다.

금지:

- 브라우저 API 호출
- DOM 탐색
- PNG 인코딩
- UI 상태 변경
- 사용자에게 보이지 않는 랜덤값 치환

현재 상태:

- `buildCommentJson()`은 받은 `MetadataState`의 seed를 그대로 Comment JSON으로 옮긴다.
- seed 0의 랜덤 치환은 `src/automation/applyPipeline.ts`의 planning 단계에서 `requestedSeed`와 `appliedSeed`로 분리한다.

권장 방향:

- `buildCommentJson()`은 순수 변환으로 유지한다.
- seed 파생은 planning 결과의 `appliedSeed`로 추적한다.
- 자동 생성 루프와 단일 적용 버튼이 같은 planning 계약을 사용하게 만든다.

### 3.3. 인코딩 계약

대상 파일:

- `src/encoding/pngEncoder.ts`

책임:

- Comment JSON을 NovelAI가 읽을 수 있는 PNG로 만든다.
- tEXt 6개 청크와 stealth_pngcomp LSB를 현재 호환성 기준에 맞춰 유지한다.
- 인코딩 실패는 호출자에게 명시적으로 전달한다.

금지:

- UI 상태 변경
- NovelAI DOM 조작
- paste 이벤트 발송
- 실패를 조용히 삼키는 것

검수 포인트:

- `CompressionStream` 미지원 환경에서 어떤 오류가 나는가
- `canvas.toBlob()` 실패가 도메인 오류로 전달되는가
- 생성 PNG를 다시 파싱했을 때 `Comment` JSON이 보존되는가
- `Software`, `Source`, `Description`이 실제 NovelAI import 조건과 맞는가

### 3.4. 외부 실행 계약

대상 파일:

- `src/encoding/pasteDispatch.ts`

책임:

- Blob을 File/DataTransfer/ClipboardEvent로 변환해 NovelAI 페이지에 전달한다.
- Import Metadata 버튼 탐색, 클릭, Generate 버튼 탐색 같은 외부 DOM 조작을 격리한다.
- 성공, 실패, 대기, 취소를 명시적 결과로 반환해야 한다.

금지:

- `catch {}`로 실패를 숨기는 것
- 버튼 미검출을 성공처럼 취급하는 것
- 외부 DOM 상태를 앱 내부 상태의 진실로 삼는 것

현재 위험:

- `autoImportAndScroll()`이 내부 예외를 삼킨다.
- Import Metadata 버튼을 찾지 못해도 호출자에게 실패가 전달되지 않는다.
- paste 대상이 `.ProseMirror` 또는 `document.body`로 fallback되지만, 이 fallback의 성공 여부가 관측되지 않는다.

권장 방향:

- `dispatchPasteEvent()`는 `PasteDispatchResult`를 반환한다.
- `autoImportAndScroll()`은 `ImportAutomationResult`를 반환한다.
- DOM query는 adapter 계층으로 분리하고, 사용자 피드백은 호출자가 처리한다.

### 3.5. 자동 생성 세션 계약

대상 파일:

- `src/hooks/useAutoGenerator.ts`

책임:

- 자동 생성 루프를 세션 단위로 제어한다.
- 목표 횟수, 간격, seed 규칙, 프리셋 큐, 중지 명령을 하나의 상태 전이 모델로 다룬다.
- 한 tick의 결과가 성공, 실패, 대기, 취소 중 무엇인지 명확히 닫힌 뒤 다음 tick을 예약한다.

금지:

- 단순 타이머 반복만으로 Generate를 누르는 것
- 이전 작업의 성공 여부를 모른 채 다음 작업을 예약하는 것
- 실패를 무한 재시도하는 것
- 중지 후 예약된 timeout이 살아남는 것

현재 위험:

- `executeLoop()`가 build, encode, paste, queue, seed 결정을 모두 갖고 있다.
- NovelAI Generate 버튼의 ready 상태 확인이 제한적이다.
- loop count는 ref에 있지만 UI 투영과 세션 상태가 분리되어 있지 않다.

권장 방향:

- 세션 상태를 `idle`, `starting`, `waiting`, `applying`, `generating`, `paused`, `failed`, `stopped`, `completed`처럼 명시한다.
- 각 tick은 `planNextGeneration()`, `encodeGenerationPayload()`, `dispatchToNovelAI()`, `scheduleNextTick()`으로 나눈다.
- 실패는 항목 실패와 세션 실패로 구분한다.

### 3.6. 파싱과 라운드트립 계약

대상 파일:

- `src/utils/pngParser.ts`
- `src/utils/metadataTranslator.ts`
- `tests/`

책임:

- 생성한 PNG에서 다시 메타데이터를 읽는다.
- 읽은 NovelAI Comment JSON을 내부 `MetadataState`로 복원한다.
- 생성 전 상태와 복원 후 상태의 보존율을 회귀 테스트로 고정한다.

금지:

- 수동 확인만으로 인코딩 정확성을 판단하는 것
- 실제 NovelAI 스키마에서 중요한 필드를 테스트 밖에 두는 것

권장 방향:

- 무거운 이미지 파일을 늘리지 말고, 작은 합성 PNG를 런타임에 생성한다.
- `buildCommentJson -> generatePngWithMetadata -> parse -> translate` 경로를 테스트한다.
- seed, width, height, sampler, advanced flags, character captions, negative captions를 각각 검증한다.

### 3.7. UI와 렌더링 계약

대상 파일:

- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/styles/theme.ts`
- `src/components/`

책임:

- UI는 상태를 투영하고 사용자 명령을 전달한다.
- 긴 프롬프트, 긴 파일명, 작은 모바일 폭에서 콘텐츠가 부모 밖으로 튀어나오면 안 된다.
- 실패와 대기 상태는 사용자가 즉시 인지할 수 있어야 한다.

금지:

- 렌더링 함수 안에서 PNG 생성, paste 발송, DB 마이그레이션 같은 부수 효과를 직접 실행하는 것
- 전역 CSS로 특정 컴포넌트 내부를 우발적으로 바꾸는 것
- raw metadata를 항상 펼쳐서 인지 부하를 높이는 것

검수 포인트:

- `App.tsx`는 조립자 역할에 머무르는가
- overlay resize 경계가 동적이고 모바일에서 무너지지 않는가
- `theme` 전역 mutable 패턴을 언제까지 허용할지 결정되어 있는가
- 상태 배너, 버튼 disabled, 실패 메시지가 같은 상태 모델을 바라보는가

## 4. 입력원과 출력처 추상화

향후 기능명으로 경로를 늘리지 말고 역할 기반 계약으로 묶는다.

입력원:

- 현재 편집 상태
- 프리셋
- 가져온 PNG 메타데이터
- 향후 Danbooru 태그 변환 결과
- 향후 자연어 변환 결과

출력처:

- NovelAI paste 이벤트
- 프리셋 저장소
- PNG 파일 export
- 향후 클립보드 또는 외부 브리지

권장 인터페이스 이름:

- `JobSource`
- `OutputSink`
- `ApplyPlan`
- `ApplyEffectResult`
- `ProofResult`

이 추상화는 새 기능을 위한 장식이 아니라, 기존 `App.tsx`, `useAutoGenerator.ts`, `pasteDispatch.ts`에 몰린 책임을 줄이기 위한 기준선이다.

## 5. 에러와 피드백 원칙

조용한 실패는 금지한다.

명시적으로 노출해야 하는 실패:

- PNG 인코딩 실패
- `CompressionStream` 미지원
- `canvas.toBlob()` 실패
- paste target 미검출
- ClipboardEvent 또는 DataTransfer 생성 실패
- Import Metadata 버튼 미검출
- Generate 버튼 미검출 또는 disabled 지속
- 프리셋 로드 실패
- IndexedDB 로드, 저장, 마이그레이션 실패
- import patch 적용 시 선택하지 않은 필드가 덮어써질 위험

권장 결과 타입:

- `ok`
- `waiting`
- `skipped`
- `cancelled`
- `failed`

실패 메시지는 개발자용 원인과 사용자용 조치 안내를 분리한다.
민감한 프롬프트 원문, 로컬 경로, API 키, 세션 정보는 로그에 그대로 남기지 않는다.

## 6. 테스트 기준선

당장 무거운 VRT 도구를 도입하지 않는다.
이 프로젝트의 리소스 제약을 고려하면 먼저 경량 회귀 방어선을 세운다.

우선 테스트해야 할 항목:

- Comment JSON 필드 보존
- PNG tEXt 6개 청크 존재
- `Comment` JSON parse 가능 여부
- stealth_pngcomp LSB payload 생성 가능 여부
- `buildCommentJson -> generatePngWithMetadata -> pngParser -> metadataTranslator` 라운드트립
- import patch가 선택한 필드만 병합하는지
- seed 0이 자동 생성 정책에서 명시적 applied seed로 바뀌는지
- paste/auto import adapter가 실패를 결과로 반환하는지

레이아웃은 스크린샷 비교보다 먼저 DOM 메트릭으로 방어한다.

측정 후보:

- overlay가 viewport 밖으로 벗어나지 않는가
- 긴 프롬프트와 긴 파일명이 부모 폭 안에서 줄바꿈 또는 생략되는가
- 주요 버튼이 320px 폭에서도 클릭 가능한 크기를 유지하는가
- 스크롤 컨테이너가 body 스크롤과 충돌하지 않는가

## 7. 단계별 예비 리팩토링 순서

### 1단계: 현재 계약 문서화와 품질 기준선

- 이 문서를 상위 기준선으로 고정한다.
- `docs/ARCHITECTURE.md`에서 이 문서를 참조한다.
- `npm run build`, `npm run lint`의 현 상태를 기록한다.
- 기존 `tests/` 스크립트를 정리해 최소 테스트 명령을 만든다.

### 2단계: 적용 파이프라인 분리

- `App.tsx`의 단일 적용 흐름에서 build, encode, dispatch를 분리한다.
- `useAutoGenerator.ts`도 같은 파이프라인 함수를 사용하게 만든다.
- UI는 `isApplying` 같은 투영 상태만 받는다.

### 3단계: 라운드트립 proof 추가

- 작은 합성 PNG 기반 테스트를 추가한다.
- 인코더가 만든 PNG를 파서가 다시 읽는지 검증한다.
- 파생 seed와 사용자 입력 seed를 분리해 검증한다.

### 4단계: paste adapter 결과 타입 도입

- `pasteDispatch.ts`의 silent catch를 제거한다.
- DOM 탐색 실패를 도메인 오류로 반환한다.
- 상태 배너 또는 apply 버튼 피드백으로 연결한다.

### 5단계: 자동 생성 루프 FSM화

- 세션 상태와 tick 결과를 명시한다.
- 중지, 완료, 실패, 대기 전이를 테스트한다.
- 무한 재시도와 중복 timeout을 차단한다.

### 6단계: UI 조립자 축소

- `App.tsx`에서 import modal, queue, apply, auto generation 상태를 점진적으로 분리한다.
- 컴포넌트는 상태 투영과 이벤트 전달만 맡는다.
- 전역 theme import를 점진적으로 `useTheme()` 기반으로 전환한다.

## 8. 지금 당장 금지할 패턴

- 새 기능을 이유로 `App.tsx`에 실행 로직을 더 넣는 것
- NovelAI 입력값을 직접 DOM 조작으로 바꾸는 것을 주 경로로 삼는 것
- paste 실패를 성공처럼 처리하는 것
- seed 0을 planning 결과 없이 랜덤 seed로 바꾸거나 applied seed를 추적하지 않는 것
- import merge에서 선택하지 않은 nested 상태를 기본값으로 덮어쓰는 것
- API 키를 클라이언트 저장소에 평문으로 보관하는 것
- 큰 이미지 fixture를 저장소에 누적하는 것

## 9. 보안과 API 연동 판단

NovelAI 직접 API 연동은 현재 1순위 리팩토링 범위에서 제외한다.

이유:

- 현재 배포 방식은 GitHub Pages 기반 북마크릿이다.
- 클라이언트 코드나 IndexedDB에 API 키를 평문 저장하면 보안 기준과 충돌한다.
- 직접 API 호출은 CORS, 인증, 요금, 비밀값 보관 정책을 함께 설계해야 한다.

다시 검토하려면 먼저 다음 중 하나가 필요하다.

- 사용자의 로컬 브리지 프로그램
- 안전한 서버리스 프록시
- 브라우저 확장 저장소 기반 권한 모델
- NovelAI가 공식적으로 허용하는 안전한 클라이언트 인증 경로

그 전까지 핵심 출력처는 NovelAI paste/import workflow로 유지한다.

## 10. 리팩토링 완료 판단

다음 조건을 만족하면 다음 기능 추가로 넘어갈 수 있다.

- `App.tsx`가 실행 파이프라인 세부 구현을 직접 알지 않는다.
- 단일 적용과 자동 생성 루프가 같은 plan/encode/effect 계약을 사용한다.
- PNG 생성 결과를 파싱해 메타데이터 보존을 자동 검증한다.
- paste/import 실패가 사용자에게 명시적으로 노출된다.
- import patch semantics가 테스트로 보호된다.
- 자동 생성 루프가 세션 상태 전이로 설명된다.
- 작은 화면에서 주요 조작 UI가 부모 밖으로 튀어나오지 않는다.

## 11. 현재 품질 기준선

기준일: 2026-06-03

실행 결과:

- `npm run build`: 통과
- `npm run lint`: 통과

정리된 기준선:

- ESLint 설정을 `src` 브라우저 앱과 `tests`/`scripts` Node 및 진단 스크립트로 분리했다.
- CJS 테스트 파일의 TypeScript 문법 잔재를 제거했다.
- 입력 메타데이터 파싱 경계의 `any`를 `unknown`과 타입 가드로 좁혔다.
- `ThemeProvider`와 `useTheme()`를 분리해 Fast Refresh export 경계를 정리했다.
- 자동 생성 루프의 화면 표시용 `loopCount`를 React state로 분리했다.
- 미사용 변수, `prefer-const`, 정규식 lint 오류를 제거했다.

다음 리팩토링에 들어갈 때 새 코드는 이 기준선을 깨면 안 된다.

## 12. 현재 리팩토링 진행 상태

기준일: 2026-06-03

완료:

- 공용 적용 파이프라인 `src/automation/applyPipeline.ts`를 추가했다.
- 단일 적용 버튼과 자동 생성 루프가 같은 `runApplyPipeline()` 경로를 사용한다.
- `App.tsx`와 `useAutoGenerator.ts`에서 직접 PNG 인코딩과 paste 발송 조립을 제거했다.
- seed 0 랜덤 치환을 `buildCommentJson()` 밖으로 꺼내 `requestedSeed`와 `appliedSeed`로 추적한다.
- `dispatchPasteEvent()`가 paste target, import, generate 자동화 결과를 명시적으로 반환한다.
- 단일 적용과 자동 생성 루프가 effect 실패를 사용자에게 알리고 후속 진행을 중단한다.
- 적용, 자동 생성, PNG/프리셋 가져오기 피드백을 브라우저 `alert()` 대신 앱 내부 상태 배너로 투영한다.

아직 남은 일:

- 자동 생성 루프는 pipeline을 공유하지만, 세션 FSM으로 모델링되지는 않았다.
- applied seed는 코드 레벨에서 추적되지만, 아직 사용자 UI나 로그에 노출되지 않는다.
- 상태 배너는 도입됐지만, 아직 장기 실행 세션의 세부 상태 로그까지 표현하지는 않는다.
