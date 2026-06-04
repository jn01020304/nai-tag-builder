---
language: korean
formatting:
  tables: false
  bold_emphasis: false
  blockquotes: false
  comments: false
writing:
  preamble: false
  filler: false
  closing_summary: false
---

# SDStudio Technical Spike

검토일은 2026-06-04이다.
원본 SDStudio는 `sunho/SDStudio`의 HEAD `f2088add103ad683a31e0590448e6e5bb4d71556`를 기준으로 보았다.
Fork는 `Dd154663/SDStudio`의 HEAD `00b57f625efb282ea3a790625c389c095eb47790`를 기준으로 보았다.

분석 대상은 SDStudio를 복제하기 위한 것이 아니다.
목적은 `nai-tag-builder` v3 Queue 구현 직전에 반복 생성 파이프라인, 프롬프트 상태 모델, 모바일 조작 흐름에서 참고할 수 있는 구조와 가져오면 안 되는 구조를 분리하는 것이다.

## 1. 결론

SDStudio는 “씬을 구성하고, 생성 작업을 예약하고, 결과 이미지를 월드컵식으로 고르고, 이후 리터칭으로 넘기는” 독립 실행형 제작 스튜디오다.
`README.md`도 이 흐름을 명시한다.
우리 프로젝트의 “짧은 모바일 세션에서 NovelAI 웹 UI를 안전하게 조종하는 북마클릿 오버레이”와 목표가 겹치는 지점은 반복 생성과 결과 선별뿐이다.

따라서 SDStudio에서 가져올 핵심은 `TaskQueueService.ts`의 작업 단위 분해, `TaskHandler` 전략 인터페이스, 진행률 이벤트, 비용 경고, 씬별 예약 수 표시, 프롬프트 조각과 조합의 개념이다.
반대로 직접 API 호출, Electron/Capacitor 파일 시스템, native tag DB, 거대한 prompt editor, 전역 mutable singleton queue, 실패 task 건너뛰기 정책은 `nai-tag-builder`의 v3에는 넣으면 안 된다.

v3 Queue 문서의 큰 방향은 여전히 맞다.
다만 이번 스파이크 결과, 구현 전에 세 가지 보강을 권장한다.
첫째, `QueuePreflightWarning`을 추가해 큰 해상도, 높은 steps, 긴 target count처럼 사용자가 비용이나 실패 위험을 알아야 하는 설정을 실행 전에 요약한다.
둘째, `QueueRunLog`를 내부적으로만 작게 둬서 실패 원인과 마지막 phase를 디버깅할 수 있게 한다.
셋째, SDStudio Fork처럼 실패 task를 자동으로 건너뛰는 정책은 배제하고, v3 MVP는 `stopOnFailure: true`를 유지한다.

## 2. 원본과 Fork의 델타

원본은 `package.json` 기준 version `3.1.11`이고, Fork는 version `4.9.0`이다.
Fork는 contributor와 publish owner가 `Dd154663`로 바뀌었고, renderer의 TS/TSX 파일 수가 60개에서 77개로 늘었다.
renderer 코드 라인 수는 약 17,764줄에서 34,981줄로 증가했다.
native tag DB인 `src/native/db.csv`는 약 3.33MB, 124,763행에서 약 4.95MB, 184,305행으로 커졌다.

Fork에서 새로 보이는 중요한 파일은 `src/renderer/models/CyclingSessionService.ts`, `src/renderer/models/GlobalPresetService.ts`, `src/renderer/models/GlobalPieceService.ts`, `src/renderer/models/ImageDownloadService.ts`, `src/renderer/models/TrashService.ts`, `src/renderer/models/KeyboardShortcutService.ts`이다.
UI 쪽에서는 `src/renderer/componenets/CharacterPresetEditor.tsx`, `GlobalPresetTab.tsx`, `ExportPresetManager.tsx`, `FindReplaceDialog.tsx`, `EmbeddedBrowser.tsx`, `DownloadDialog.tsx`, `ResizableSplitter.tsx`가 추가됐다.

이 변화의 의미는 “Fork가 원본을 경량화한 것”이 아니라 “원본의 제작 스튜디오 방향을 더 확장한 것”에 가깝다.
캐릭터 프리셋, 전역 프리셋, 전역 프롬프트 조각, 다운로드, 휴지통, 내장 브라우저, 검색 치환, 순차 생성이 붙으면서 독립 앱으로서의 완성도는 올라갔지만, 모바일 북마클릿에 가져올 수 있는 면적은 더 작아졌다.

## 3. Prompt 상태 관리에서 배울 점

원본과 Fork 모두 프롬프트를 단순 문자열 하나로만 보지 않는다.
`src/renderer/models/types.ts`에는 `PromptNode`가 `PromptGroupNode`, `PromptTextNode`, `PromptRandomNode`로 정의되어 있고, `PromptPiece`, `PromptPieceSlot`, `Scene.slots`, `PieceLibrary`가 별도 모델로 존재한다.
`src/renderer/models/PromptService.ts`의 `parseWord()`, `tryExpandPiece()`, `isMulti()`, `lowerPromptNode()`는 `<library.piece>` 형태의 조각을 해석하고, multi piece를 random node로 낮춘다.

이 구조의 좋은 점은 프롬프트 조립과 최종 문자열 생성을 분리한다는 것이다.
`createSDPrompts()`는 `preset.frontPrompt`, scene slot의 middle prompt, `preset.backPrompt`, easy mode의 character/background prompt를 합친 뒤 마지막에 `PromptNode`로 변환한다.
Fork는 여기에 `createSDCharacterPrompts()`를 추가해 캐릭터 프롬프트도 scene slot 조합에 참여하게 만들었다.

우리에게 필요한 해석은 간단하다.
Compose 화면의 Raw Prompt를 당장 `PromptNode` 기반 구조화 에디터로 바꾸면 안 된다.
모바일 MVP에서는 현재처럼 raw string을 source of truth로 유지하되, 카테고리 칩과 Core Catalog는 prompt 조각을 넣는 얇은 조립 보조 계층으로 남겨야 한다.
다만 v3 Queue가 preset queue를 실행할 때는 “현재 문자열 snapshot”과 “preset snapshot”을 명확히 구분해야 한다.
SDStudio의 `Scene.slots`처럼 조합 가능한 단위를 만들고 싶다면, 이것은 v3 Queue가 아니라 v1 Compose 이후의 별도 `promptPieceEngine` 단계로 다루는 편이 안전하다.

## 4. Prompt editor에서 가져오면 안 되는 점

`src/renderer/componenets/PromptEditTextArea.tsx`는 아주 많은 책임을 가진다.
모바일에서는 `NativeEditTextArea`, 데스크톱에서는 `EmulatedEditTextArea`를 쓰며, contentEditable caret 복원, Hangul composition, undo/redo history, autocomplete, highlighted overlay, fullscreen mobile editor, backend tag search까지 한 파일 안에 들어 있다.

이 파일은 SDStudio가 데스크톱급 편집기를 만들기 위해 어떤 문제를 마주했는지 보여주는 좋은 사례다.
하지만 `nai-tag-builder`에 그대로 이식하면 우리가 이미 겪은 문제, 즉 Raw Prompt 입력 불가, 커서 동기화, 레이아웃 붕괴가 더 커진 형태로 반복될 가능성이 높다.

우리 쪽 결론은 `PromptEditorView`를 계속 작게 유지하는 것이다.
자동완성은 SDStudio처럼 backend lookup을 직접 붙이는 대신, 오프라인 Core Catalog의 작은 정적 index를 읽는 `tagAutocompleteProvider`로 제한한다.
highlight, linter, chip insertion, raw textarea는 서로 독립 모듈이어야 하며, 한 컴포넌트가 caret, autocomplete, parser, catalog, drag reorder, mobile fullscreen을 모두 소유하면 안 된다.

## 5. Queue 구조에서 배울 점

원본 `src/renderer/models/TaskQueueService.ts`는 `TaskQueueService extends EventTarget`로 구현되어 있다.
queue 저장소는 `CircularQueue<Task>`이고, `Task`는 `id`, `cls`, `params`, `done`, `total`을 가진다.
`TaskHandler`는 `createTimeEstimator()`, `checkTask()`, `handleTask()`, `getNumTries()`, `handleDelay()`, `getInfo()`, `calculateCost()`를 가진 전략 인터페이스다.
`GenerateImageTaskHandler`, `AugmentTaskHandler`, `RemoveBgTaskHandler`가 이 인터페이스를 구현한다.

이 구조의 장점은 작업 종류와 Queue runner가 어느 정도 분리되어 있다는 점이다.
Queue UI는 `TaskQueueControl.tsx`에서 `taskQueueService`의 `start`, `stop`, `progress`, `complete`, `error` 이벤트를 듣고, `statsAllTasks()`, `estimateTime("mean")`, `estimateTopTaskTime("mean")`를 통해 남은 작업과 예상 시간을 표시한다.
실행 전에는 `calculateCost()`로 steps 28 초과나 큰 해상도 같은 비용 위험을 모아 확인 다이얼로그를 띄운다.

우리 v3에 가져올 수 있는 것은 이 세 가지다.
Queue planner는 실행 전에 비용/위험 경고를 만들 수 있어야 한다.
Queue runner는 progress snapshot을 UI에 제공해야 한다.
Queue item은 사용자에게 보이는 짧은 이름과 현재 진행 횟수를 가져야 한다.

하지만 SDStudio의 `TaskQueueService`는 우리 v3의 직접 모델이 되기에는 너무 크다.
queue 저장, retry, delay, task classification, direct API call, seed mutation, image file persistence, event dispatch, cost calculation, time estimation이 한 클래스에 섞여 있다.
우리의 `queuePlanner.ts`, `queueSession.ts`, `useQueueRunner.ts` 분리 계획은 이 문제를 피하기 위한 장치로 유지해야 한다.

## 6. Fork의 Queue 확장과 위험

Fork의 `TaskQueueService.ts`는 855줄에서 1,209줄로 커졌다.
주요 변화는 `TaskLog`, `MAX_TASK_LOGS`, `addLog()`, `clearLogs()`, `getRetryTimeoutMs()`, `withTimeout()` 추가, backend config의 `delayTime` 반영, 429 rate limit 처리, 실패 task skip 정책이다.

Fork는 `handler.handleTask()`를 timeout으로 감싸고, 429가 발생하면 60초 대기 후 재시도한다.
모든 retry가 실패하면 원본처럼 queue 전체를 fatal stop하지 않고, 해당 task를 제거한 뒤 다음 task로 넘어간다.
이 정책은 direct API 기반 스튜디오에서는 사용자 경험을 부드럽게 만들 수 있다.
하지만 `nai-tag-builder`에는 위험하다.
우리의 실패는 “API 한 번이 실패했다”보다 “NovelAI 화면이 예상 상태가 아니다”에 가깝다.
`IMPORT_BUTTON_TIMEOUT`, `GENERATE_BUTTON_DISABLED`, `PASTE_TARGET_NOT_FOUND` 이후 자동으로 다음 tick을 진행하면 잘못된 prompt 상태로 연속 생성될 수 있다.

따라서 Fork의 retry/skip은 v3 MVP에서 배제한다.
대신 `QueueRunLog`는 bounded debug log로 축소 도입할 가치가 있다.
Status Banner에는 사용자용 마지막 오류와 복구 힌트만 보이고, 내부 log에는 runId, tickIndex, phase, sourcePresetName, errorCode, timestamp 정도만 남기면 충분하다.

## 7. CyclingSessionService에서 배울 점

Fork의 `src/renderer/models/CyclingSessionService.ts`는 캐릭터 프리셋을 순차 적용하고, 각 프리셋마다 scene들을 queue에 넣은 뒤 `taskQueueService.run()`을 호출한다.
state는 `idle`, `running`, `paused`, `completed`이고, `presetQueue`, `currentPresetIndex`, `completedPresets`, `currentPresetName`을 observable로 가진다.

이 기능은 우리 v3의 “캐릭터 프리셋 A/B/C 순차 적용”과 가장 직접적으로 닿아 있다.
그러나 구현 방식은 그대로 가져오면 안 된다.
`CyclingSessionService.applyPreset()`는 session shared state를 직접 변경하고, preset에서 온 vibe/reference/character prompt에 `fromPreset`을 붙이며, queue stop 이벤트를 이용해 다음 preset으로 넘어간다.
즉 queue와 session mutation이 강하게 결합되어 있다.

우리에게 필요한 것은 이보다 더 작은 형태다.
`QueueDraft`의 source가 preset queue일 때 `planNextQueueTick()`이 다음 preset snapshot을 고르고, 그 snapshot을 `MetadataState` patch로 합성한 뒤 `runApplyPipeline()`에 넘기는 구조가 맞다.
현재 실행 중인 NovelAI 적용이 성공하기 전에는 다음 preset을 session state에 반영했다고 말하면 안 된다.

## 8. Workflow 시스템에서 배울 점

Fork의 `src/renderer/models/workflows/WorkFlow.ts`와 `WorkFlowService.ts`는 workflow definition registry를 제공한다.
`WorkFlowDef`는 preset/shared/meta vars, editor schema, handler, createPrompt, createCharacterPrompts, createPreset을 가진다.
`SDWorkFlow.ts`는 `SDImageGenDef`, `SDImageGenEasyDef`, `SDInpaintDef`, `SDI2IDef`, `SDMirrorDef`를 등록한다.

이 구조는 확장형 독립 앱에는 강력하다.
새 workflow를 추가할 때 preset 변수, UI 입력, prompt 생성, job handler를 한 definition에 묶을 수 있기 때문이다.
하지만 우리 북마클릿은 direct image generation workflow registry가 필요하지 않다.
우리의 실행 책임은 항상 `MetadataState`를 NovelAI-compatible PNG metadata로 만들고, v2 Automation pipeline으로 위임하는 것이다.

따라서 v3에는 workflow registry를 넣지 않는다.
대신 `QueueSource`를 단순하게 유지한다.
현재 상태, preset queue, character preset queue 정도만 둔다.
인페인트, mirror, image variation은 v4 이후 Review/Handoff에서 “PC 이관용 metadata package”로 먼저 다루고, 모바일에서 직접 workflow builder로 확장하지 않는다.

## 9. 모바일 및 웹 통합 관점

SDStudio는 Electron과 Capacitor를 모두 품고 있다.
`package.json`에는 Electron, Capacitor, 파일 시스템, 파일 오프너, background mode, native module, image processing, React DnD, react-window, local AI 관련 의존성이 같이 들어 있다.
`src/renderer/backends/electronBackend.ts`는 `TOKEN.txt`를 읽어 `NovelAiImageGenService`로 직접 NovelAI API를 호출하고, 결과 이미지를 로컬 파일로 저장한다.

이 구조는 독립 앱이기 때문에 가능하다.
반대로 북마클릿에서는 이 구조가 보안 취약점이 된다.
브라우저에 API token을 두고 직접 호출하거나, native DB와 file system을 전제로 삼는 순간 “가벼운 오버레이 조종 패널”이라는 제품 정체성이 무너진다.

SDStudio의 모바일 분기는 `isMobile` 조건으로 카드 크기, prompt fullscreen, hover button 표시 여부를 바꾸는 수준이다.
이것은 “모바일에서도 앱을 쓸 수 있게 하는 대응”이지, “NovelAI 페이지 위 좁은 오버레이에서 한 손으로 조작하는 저마찰 UX”가 아니다.
따라서 우리 UI 계약인 Header, Body, Footer 분리와 Footer 고정 실행 버튼은 계속 유지해야 한다.

## 10. Autocomplete와 tag DB에 대한 시사점

SDStudio는 `backend.searchTags()`와 `backend.lookupTag()`를 통해 autocomplete와 tag category 판단을 한다.
Electron backend는 IPC로 `search-tags`, `lookup-tag`를 호출하고, native 쪽 `db.csv`를 기반으로 검색한다.
Fork의 `db.csv`가 원본보다 크게 증가한 것은 autocomplete 품질과 coverage를 확장하려는 방향으로 해석된다.

우리 프로젝트는 이미 offline Core Catalog 빌더를 갖고 있다.
따라서 런타임에서 SDStudio식 native tag DB 검색을 가져오면 안 된다.
모바일 북마클릿에는 `core-catalog.json`과 작은 prefix/search index만 번들링하고, Danbooru 전체 DB나 LLM 분류는 오프라인 단계로 밀어야 한다.

다만 `PromptService.createSDPrompts()` 안에서 인원수 태그와 캐릭터 태그를 앞쪽으로 정렬하는 아이디어는 참고할 만하다.
우리 Core Catalog에도 product category와 함께 `placementHint` 같은 정적 힌트를 추가하면, 모바일 칩 삽입 시 “인원수, 캐릭터 핵심, 배경, 품질” 순서를 더 자연스럽게 제안할 수 있다.
이것은 v3 Queue보다 v1 Compose 개선 범위에 가깝다.

## 11. Review와 Handoff로 넘길 시사점

SDStudio의 `Tournament.tsx`, `ResultViewer.tsx`, `TrashService.ts`, `ImageDownloadService.ts`는 v4 Review/Handoff에서 다시 볼 가치가 있다.
원본 README의 “이미지 월드컵 기능”은 우리 사용자가 말한 고속 선별 흐름과 거의 같은 문제를 푼다.
Fork의 ResultViewer는 휴지통, 이미지 복원, 프롬프트 추출, sample seed 추출, 다른 scene에 seed를 적용하는 흐름을 포함한다.

하지만 이것을 v3 Queue에 넣으면 안 된다.
v3의 완료 기준은 “반복 생성 작업을 안전하게 예약하고 중단한다”이다.
이미지 비교, 삭제, 복원, seed sample extraction, PC package export는 v4 Review/Handoff에서 별도 상태 모델로 다루어야 한다.

## 12. v3 Queue 구현 전 반영할 계약

첫째, `queueTypes.ts`에는 `QueuePreflightWarning`을 추가한다.
필드는 `code`, `severity`, `message`, `hint`, `tickIndex`, `sourceName` 정도면 충분하다.
처음에는 steps 28 초과, large resolution, target count 과다, interval 과소, generate button 필요 여부를 점검한다.

둘째, `queueSession.ts`에는 사용자에게 직접 보이는 상태와 디버깅용 log를 분리한다.
사용자에게는 Footer의 짧은 status와 Status Banner만 보인다.
개발자용 log는 최근 50개 정도의 bounded list로 유지하면 된다.

셋째, `queuePlanner.ts`는 SDStudio의 `queueWorkflow()`처럼 실제 실행을 하지 않는다.
다음 tick에서 사용할 source snapshot, seed intent, preset name, display label만 만든다.
DOM 주입, Import 버튼 대기, Generate 버튼 검증은 계속 `runApplyPipeline()`만 맡는다.

넷째, `useQueueRunner.ts`는 SDStudio의 `TaskQueueService.runInternal()`처럼 while loop로 모든 작업을 밀어붙이지 않는다.
한 tick의 `runApplyPipeline()`이 success로 닫힌 뒤에만 다음 timeout을 예약한다.
사용자 Stop은 이미 진행 중인 apply를 되돌리지 않고, 다음 tick 예약만 막는다는 현재 v3 문서의 정책을 유지한다.

다섯째, failure policy는 Fork의 skip 방식이 아니라 stop 방식이다.
`IMPORT_BUTTON_TIMEOUT`, `IMPORT_COMPLETE_TIMEOUT`, `GENERATE_BUTTON_DISABLED`, `PASTE_TARGET_NOT_FOUND`, `PASTE_EVENT_FAILED`는 모두 다음 tick 중단 대상이다.
자동 retry는 v3 MVP 밖이다.

여섯째, Queue UI는 SDStudio의 `TaskQueueControl.tsx`처럼 task list와 controls를 한 줄에 빽빽하게 넣지 않는다.
Footer에는 현재 run summary, 남은 횟수, Stop만 둔다.
작업 목록, preset 순서, seed rule, interval은 Body의 Queue mode에 둔다.

## 13. 최종 판단

SDStudio 원본과 Fork는 `nai-tag-builder`가 추구하는 방향의 미래 전체를 미리 보여준다.
특히 scene, prompt piece, queue, tournament, result viewer는 장기적으로 참고할 수 있다.
하지만 같은 방향으로 커지면 모바일 북마클릿의 저마찰성이 사라진다.

v3에서 우리가 가져와야 할 것은 기능의 양이 아니라 경계의 이름이다.
SDStudio의 `TaskQueueService`는 우리가 피해야 할 비대화의 예시이면서도, `Task`, `TaskHandler`, progress, cost preflight라는 좋은 언어를 준다.
이 언어를 `QueueDraft`, `QueueTickPlan`, `QueueSession`, `QueuePreflightWarning`, `QueueRunLog`로 축소 번역하면 `Mobile Overlay Cockpit`의 청사진과 충돌하지 않는다.

따라서 v3 구현은 현재 `docs/V3_QUEUE_ARCHITECTURE.md`를 유지하되, preflight warning과 bounded run log를 추가하는 방향으로 시작한다.
Fork의 character preset cycling은 MVP 이후 “preset queue progression”이 안정된 다음에만 얇게 도입한다.
direct API, Electron/Capacitor, native tag DB, image file manager, workflow registry, tournament viewer는 v3 범위 밖으로 확정한다.

## 14. 참조한 주요 코드

원본 SDStudio HEAD는 https://github.com/sunho/SDStudio/tree/f2088add103ad683a31e0590448e6e5bb4d71556 이다.
Fork HEAD는 https://github.com/Dd154663/SDStudio/tree/00b57f625efb282ea3a790625c389c095eb47790 이다.

Queue 분석의 주요 파일은 원본과 Fork의 `src/renderer/models/TaskQueueService.ts`, Fork의 `src/renderer/models/CyclingSessionService.ts`, Fork의 `src/renderer/componenets/TaskQueueControl.tsx`, Fork의 `src/renderer/componenets/SceneQueueControl.tsx`이다.
Prompt 분석의 주요 파일은 원본과 Fork의 `src/renderer/models/PromptService.ts`, Fork의 `src/renderer/componenets/PromptEditTextArea.tsx`, Fork의 `src/renderer/models/types.ts`, Fork의 `src/renderer/models/workflows/WorkFlow.ts`, `WorkFlowService.ts`, `SDWorkFlow.ts`이다.
보안 경계 분석의 주요 파일은 Fork의 `src/renderer/backends/electronBackend.ts`와 `package.json`이다.
Review/Handoff 참고 파일은 Fork의 `src/renderer/componenets/Tournament.tsx`, `ResultViewer.tsx`, `src/renderer/models/TrashService.ts`, `ImageDownloadService.ts`이다.
