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

# V3 Queue Architecture

이 문서는 `nai-tag-builder` v3 Queue 단계의 아키텍처 계약이다.
v3의 목표는 반복 생성 옵션을 많이 붙이는 것이 아니라, 모바일 사용자가 짧은 시간 안에 여러 생성 작업을 안전하게 위임할 수 있는 짧은 작업 지시서를 만드는 것이다.

Queue는 v2 Automation 신뢰성 위에 올라간다.
Queue는 NovelAI DOM selector를 직접 만지지 않는다.
Queue는 `runApplyPipeline()`의 성공과 실패를 관찰하고, 다음 tick을 예약할지 중단할지만 결정한다.

## 제품 목표

v3 Queue는 모바일 자투리 시간의 반자동 생성 흐름을 담당한다.
사용자는 PC 앞에서 긴 작업표를 설계하는 사람이 아니라, 점심시간이나 이동 중에 짧은 프리셋 묶음을 고르고 실행을 감독하는 사람이다.

초기 Queue는 세 가지 명령을 우선한다.
하나는 현재 프롬프트 또는 선택한 프리셋으로 N장을 반복 생성하는 것이다.
둘째는 seed를 고정, 증가, 감소, 랜덤 중 하나로 적용하는 것이다.
셋째는 프리셋 또는 이미지에서 생성한 프리셋을 Batched Queue로 묶음 실행하거나 랜덤 실행하는 것이다.

복잡한 workflow builder, 조건 분기, 실패 후 자동 복구, 이미지 분석 기반 재시도는 v3 범위가 아니다.
v3는 가볍고 예측 가능한 반복 실행을 만드는 단계다.

## 현재 구현 진단

현재 반복 생성은 `src/hooks/useAutoGenerator.ts`에 집중되어 있다.
이 hook은 auto generate 토글, interval, target count, seed rule, queue ref, queue mode, next preset 선택, seed 계산, timeout 예약, apply pipeline 호출, 실패 처리까지 모두 알고 있다.

이 구조는 빠르게 동작을 붙이기에는 좋았지만 v3의 장기 구조로는 무겁다.
Queue 정책과 세션 상태, UI draft, Automation 실행이 같은 hook 안에 섞이면 실패 상태를 설명하기 어렵고, 향후 character preset 순환이나 Review handoff를 붙일 때 강결합이 커진다.

`src/components/PresetManager.tsx`도 preset 관리와 queue 편집을 함께 맡고 있다.
초기 구현에서는 `Queue Images`가 여러 이미지의 NovelAI 메타데이터를 각각 Preset으로 저장한 뒤 기존 Queue 뒤에 추가한다.
장기적으로는 Preset 저장소와 Queue 작업 지시서 편집을 분리해야 한다.

## 책임 경계

Queue 도메인은 작업 지시서, 세션 상태, tick 계획, stop policy, failure policy를 소유한다.
Queue 도메인은 `MetadataState`를 입력 상태로 받을 수 있지만, `MetadataState` 내부를 임의로 shallow merge해서는 안 된다.
Queue 도메인은 `runApplyPipeline()`을 호출할 수 있지만, `.ProseMirror`, `Import Metadata`, `Generate` 같은 NovelAI selector를 알면 안 된다.

Automation 도메인은 단일 Apply의 외부 DOM 실행을 소유한다.
Automation은 Queue가 몇 번째 tick인지, 어떤 preset 순서인지, target count가 얼마인지 알면 안 된다.

Metadata 도메인은 seed planning과 Comment JSON, PNG metadata encoding을 소유한다.
Queue가 seed rule을 선택하더라도 실제 적용 seed는 apply planning 결과로 추적되어야 한다.

UI 도메인은 Queue 작업 지시서를 만들고 세션 상태를 투영한다.
UI는 timeout을 직접 예약하거나 `runApplyPipeline()`을 직접 반복 호출하지 않는다.

## 데이터 계약

Queue 작업 지시서는 런타임에서 가벼운 plain object로 다룬다.
초기 모델은 `QueueDraft`, `QueueSession`, `QueueTickPlan`, `QueueTickResult` 네 개로 나눈다.

`QueueDraft`는 사용자가 실행 전에 편집하는 값이다.
source는 현재 상태 또는 preset queue를 가리킨다.
targetCount는 생성 목표 횟수다.
intervalSec는 tick 사이 대기 시간이다.
seedRule은 none, random, increment, decrement 중 하나다.
none은 사용자에게 프리셋 seed 유지로 보이는 규칙이며 source state의 seed를 그대로 보존한다.
Queue seed 기본값은 항상 random이다.
queueMode는 batched 또는 randomized다.
batched는 `runsPerPreset`만큼 같은 preset을 실행한 뒤 다음 preset으로 이동한다.
`runsPerPreset` 기본값은 1이며, 이 값이 기존 progression과 같은 의미다.
randomized는 매 tick마다 queued preset 중 하나를 무작위로 고르고 `runsPerPreset`을 사용하지 않는다.
stopOnFailure는 초기값 true다.

`QueueSession`은 실행 중인 세션 상태다.
status는 idle, starting, waiting, applying, cooldown, stopped, completed, failed 중 하나다.
runId는 한 번의 시작 명령을 구분하는 id다.
currentIndex는 완료된 tick 수가 아니라 현재 계획 중인 tick 번호다.
completedCount는 성공한 tick 수다.
targetCount는 세션 시작 시 snapshot으로 고정한다.
startedAt, updatedAt, lastError, lastAppliedSeed를 가진다.

`QueueTickPlan`은 다음 한 번의 Apply를 위한 계획이다.
tickIndex, sourcePresetId, sourcePresetName, state, seedIntent, sourceIterationIndex, scheduledAt를 가진다.
이 plan은 Automation selector를 포함하지 않는다.

`QueueTickResult`는 한 tick이 닫힌 결과다.
status는 success, failed, skipped, stopped 중 하나다.
applyResult는 `runApplyPipeline()` 결과를 담는다.
failure는 실패 코드와 사용자용 메시지를 담는다.

## 세션 상태 전이

idle은 실행 전 상태다.
사용자가 Queue 실행을 누르면 starting으로 이동한다.
starting은 draft를 session snapshot으로 고정하고 첫 tick을 만든다.

waiting은 다음 tick의 예약 시간이 오기를 기다리는 상태다.
사용자가 Stop을 누르면 stopped로 이동하고 예약된 timeout을 제거한다.

applying은 `runApplyPipeline()`이 진행 중인 상태다.
이 상태에서는 Queue 설정 변경이 다음 세션에만 반영된다.
현재 tick은 완료, 실패, 중단 중 하나로 닫혀야 한다.

cooldown은 성공한 tick 이후 다음 tick까지 대기하는 상태다.
남은 횟수가 있으면 waiting으로 이동한다.
목표 횟수를 채우면 completed로 이동한다.

failed는 실패 정책에 따라 세션이 멈춘 상태다.
초기 v3는 실패 시 자동 재시도하지 않는다.
사용자는 실패 원인과 복구 힌트를 보고 다시 시작할지 판단한다.

stopped는 사용자가 명시적으로 중단한 상태다.
stopped는 실패가 아니며, Status Banner는 경고가 아니라 info 또는 success tone으로 표시한다.

## Tick 계획 규칙

Queue는 한 번에 하나의 tick만 계획하고 실행한다.
다음 tick은 이전 tick의 `runApplyPipeline()` 결과가 성공으로 닫힌 뒤에만 예약한다.
이 규칙은 v2 Automation 신뢰성 계약을 보존하기 위한 핵심이다.

preset queue가 비어 있으면 현재 `MetadataState` snapshot을 source로 사용한다.
preset queue가 있으면 세션 시작 시점의 queued preset source snapshot을 고정하고, 이후 실행 중 Queue 편집은 현재 세션에 반영하지 않는다.
batched는 `preset1 x runsPerPreset -> preset2 x runsPerPreset` 순서로 순환한다.
randomized는 매 tick마다 무작위 preset을 고르되, v3 MVP에서는 중복 방지를 보장하지 않는다.

seedRule이 none이면 source seed를 그대로 사용한다.
seedRule이 random이면 매 tick마다 `createRandomSeed()`를 사용한다.
seedRule이 increment이면 source seed에서 현재 preset 내부 반복 index만큼 더한다.
seedRule이 decrement이면 source seed에서 현재 preset 내부 반복 index만큼 빼되 0 아래로 내려가지 않는다.
예를 들어 `runsPerPreset = 3`, preset1 seed 100, preset2 seed 500이면 increment는 `101, 102, 103 -> 501, 502, 503`이다.

seed 0은 random seed 요청으로 해석하지 않는다.
random은 seedRule로만 표현한다.
이 계약은 NovelAI seed 의미와 제품 설명을 맞추기 위해 유지한다.

## Stop 정책

Stop은 예약된 timeout과 다음 tick을 모두 취소한다.
Stop은 이미 진행 중인 외부 DOM 적용을 되돌린다고 약속하지 않는다.
applying 상태에서 Stop을 누른 경우, 현재 tick이 끝나는 즉시 다음 예약을 만들지 않는다.

따라서 Stop 버튼 문구는 "현재 적용 취소"가 아니라 "반복 생성 중지"로 유지한다.
사용자가 Stop을 눌렀다고 해서 NovelAI에 이미 전달된 paste/import/generate가 취소된 것은 아니다.

## 실패 정책

초기 v3는 stopOnFailure를 true로 고정한다.
`runApplyPipeline()`이 failed를 반환하면 세션은 failed로 이동하고 다음 tick을 예약하지 않는다.

`IMPORT_BUTTON_TIMEOUT`, `IMPORT_COMPLETE_TIMEOUT`, `GENERATE_BUTTON_DISABLED`는 사용자가 직접 NovelAI 화면 상태를 확인해야 하는 실패다.
이 실패들은 자동 재시도하면 잘못된 프롬프트가 연속 생성될 수 있으므로 v3에서는 재시도하지 않는다.

`PASTE_EVENT_FAILED`와 `PASTE_TARGET_NOT_FOUND`는 북마클릿 또는 페이지 로드 상태 문제일 가능성이 높다.
이 경우에도 자동 재시도하지 않고 상태 배너와 Footer에 실패를 표시한다.

향후 retry policy가 필요하면 `retryLimit`, `retryDelaySec`, `retryableCodes`를 별도 필드로 추가한다.
하지만 v3 MVP에는 넣지 않는다.

## 모바일 UI 계약

Queue UI는 Body의 독립 작업면이어야 한다.
Presets 접힘 영역 안에 모든 설정을 계속 추가하면 Compose 화면이 다시 길어진다.
v3에서는 Queue 작업면을 Compose, Tune과 동급 mode로 승격하는 방향을 기본으로 한다.

Queue 기본 화면은 짧은 요약을 먼저 보여준다.
예시는 현재 상태로 8장, 30초 간격, seed 증가, 실패 시 중단 같은 한 줄이다.
세부 설정은 접힌 영역 또는 작은 bottom sheet로 분리한다.

Footer는 세션 상태를 최우선으로 보여준다.
idle에서는 "Queue 준비됨" 또는 "적용 준비됨"을 보여준다.
waiting에서는 "다음 생성 대기 중"을 보여준다.
applying에서는 v2 Apply phase 라벨을 그대로 보여준다.
cooldown에서는 "다음 생성까지 대기 중"을 보여준다.
failed에서는 실패 코드와 복구 힌트를 Status Banner로 보여주고, Footer는 다시 실행 가능한 상태로 돌아간다.

자동 생성 중 Stop 버튼은 Footer에 고정한다.
Stop 버튼은 Body 스크롤 아래로 내려가면 안 된다.

## 파일 구조 제안

v3 구현은 새 `src/queue/` 폴더를 기준으로 시작한다.
`queueTypes.ts`는 QueueDraft, QueueSession, QueueTickPlan, QueueTickResult를 정의한다.
`queuePlanner.ts`는 다음 tick을 선택하고 seed를 계산한다.
`queueSession.ts`는 세션 상태 전이를 순수 함수로 모델링한다.
`useQueueRunner.ts`는 React hook으로 timeout 예약, stop, start, tick 실행을 연결한다.
`QueuePanel.tsx`는 모바일 작업면 UI를 담당한다.

기존 `src/hooks/useAutoGenerator.ts`는 v3 구현 중 점진적으로 축소한다.
최종적으로는 `useQueueRunner.ts` 또는 그 adapter로 대체한다.

`src/components/AutoGeneratePanel.tsx`는 v3에서는 Queue 설정 UI로 흡수하거나, Tune 화면의 간단한 "Apply 후 1회 Generate" 옵션만 남긴다.

## 구현 순서

첫 단계는 타입과 순수 planner를 만든다.
이 단계에서는 UI를 거의 바꾸지 않는다.
현재 `queue`, `queueMode`, `runsPerPreset`, `seedRule`, `intervalSec`, `targetCount`를 `QueueDraft`로 표현할 수 있게 만든다.

둘째 단계는 `planNextQueueTick()`을 만든다.
현재 state, preset id 배열, preset lookup 결과, seed rule, current index를 입력받아 다음 `QueueTickPlan`을 반환한다.
이 함수는 DOM과 React state를 몰라야 한다.

셋째 단계는 세션 전이 함수를 만든다.
start, tick success, tick failure, stop, complete 이벤트를 받아 다음 `QueueSession`을 반환한다.
이 함수도 순수 함수여야 한다.

넷째 단계는 `useQueueRunner()`를 만든다.
이 hook만 timeout과 `runApplyPipeline()` 호출을 가진다.
한 tick이 성공으로 닫힌 뒤에만 다음 timeout을 예약한다.

다섯째 단계는 기존 `useAutoGenerator.ts`를 adapter로 바꾸거나 제거한다.
이때 `App.tsx`가 queue 세부 구현을 직접 알지 않도록 한다.

여섯째 단계는 Queue 작업면 UI를 분리한다.
모바일 화면에서는 preset 목록, run summary, target count, interval, seed rule, queue mode, stop policy만 기본 노출한다.

## 검증 계약

Queue planner는 단위 테스트가 필요하다.
batched가 `runsPerPreset` 단위로 preset을 고르는지, randomized가 허용 범위 안의 preset을 고르는지, seed increment와 decrement가 preset 내부 반복 index 기준으로 기대값을 만드는지 검증한다.

Queue session은 상태 전이 테스트가 필요하다.
start 이후 waiting 또는 applying으로 가는지, success가 completed 또는 cooldown으로 가는지, failure가 failed로 가는지, stop이 timeout 예약을 남기지 않는지 검증한다.

E2E는 mock NovelAI fixture에서 검증한다.
성공한 tick 뒤에만 다음 tick이 예약되는지, 실패 tick 뒤에는 다음 tick이 실행되지 않는지, Stop을 누르면 target count가 남아 있어도 다음 tick이 실행되지 않는지 확인한다.

모바일 layout은 기존 Compose smoke test에 Queue mode와 Queue Images import를 추가해 확인한다.
320px 폭에서 Queue summary, target count, interval, Stop 버튼이 부모 폭 밖으로 나가면 안 된다.

## v3 MVP 범위

v3 MVP에 포함되는 것은 현재 상태 반복, preset queue batched, preset queue randomized, Queue Images 기반 preset 생성과 queue append, seed none, random, increment, decrement, target count, interval, stop on failure, manual stop, footer status, status banner failure hint다.

v3 MVP에 포함되지 않는 것은 조건 분기, 이미지 결과 기반 다음 작업 선택, 자동 retry, 실패 후 fallback preset, per-preset 개별 target count, nested queue, LLM prompt rewrite, vision AI 검수, 직접 NovelAI API 호출이다.

## 완료 기준

v3가 완료되려면 반복 생성이 `runApplyPipeline()`을 우회하지 않아야 한다.
한 tick이 성공 또는 실패로 닫히기 전 다음 tick이 예약되면 안 된다.
Stop 이후 살아남은 timeout이 없어야 한다.
실패 코드는 Status Banner에 표시되고 다음 tick은 중단되어야 한다.
Queue UI는 모바일 기본 화면에서 Compose와 Tune을 밀어내지 않는 독립 작업면이어야 한다.

이 기준을 만족하면 v4 Review and Handoff로 넘어갈 수 있다.
