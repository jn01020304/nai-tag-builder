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

# Handoff — 2026-06-09

## 현재 상태

`nai-tag-builder`는 NovelAI 이미지 생성 페이지에 주입되는 모바일 우선 북마클릿 오버레이다.

최근 작업의 중심은 네 가지다.

- EXIF/PNG 청크가 없는 NovelAI 이미지에서도 프롬프트 메타데이터 복원
- NovelAI 실제 테마와의 색상 동기화 복구
- 모바일 화면을 덜 잡아먹는 UI 정리
- 모바일 오버레이가 접힘, 펼침, 드래그, 리사이즈, viewport 변화 속에서도 화면 안에 남도록 하는 셸 안정화
- Batched Queue 기반의 이미지 batch import → Preset 생성 → Queue append 흐름 추가

현재 `main`은 배포된 GitHub Pages 번들과 동기화되어 있으며, 최신 북마클릿은 원격 `nai-tag-builder.js`를 `?t=Date.now()`로 로드한다.

최신 주요 커밋 흐름은 다음과 같다.

- `498a43c Refine header controls and automation default`
  - 헤더 컨트롤과 자동화 기본값 기준점
- `c663084 Add two finger overlay drag`
  - 모바일에서 두 손가락 드래그로 오버레이를 끌어오는 기능
- `c1db0f8 Preserve resize handles during two finger drag`
  - 두 손가락 드래그가 4면/4모서리 리사이즈 핸들을 침범하지 않도록 보정
- `e48ef10 Preserve panel state across overlay collapse`
  - 접었다 펼쳐도 섹션 펼침 상태가 유지되도록 overlay body를 숨김 처리로 전환
- `3b672a1 Keep overlay inside mobile viewport`
  - 펼침, 리사이즈, viewport 변화 후 오버레이가 모바일 화면 밖으로 잘리지 않도록 위치 clamp

## 최근 완료

이미지 Import 파이프라인을 확장했다.

- `Load PNG`를 `Load Image`로 변경
- PNG뿐 아니라 WebP 등 `image/*` 파일 선택 허용
- PNG `tEXt`, `iTXt`, `zTXt` 파싱
- `stealth_pngcomp` alpha LSB 디코더 추가
- `createImageBitmap()` + canvas pixel decode
- column-major alpha LSB bit extraction
- 32-bit big-endian payload length
- `pako.inflateRaw()` 우선, `ungzip()` fallback
- 다중 파일 batch parse와 conservative merge 기반 추가

UI/UX를 모바일 기준으로 압축했다.

- Main/Undesired Prompt textarea 위의 작은 중복 라벨 제거
- Character Prompt / Character Undesired Content 중복 라벨 제거
- Tag Dictionary를 MainPromptSection 내부로 통합하여 더 가볍고 응집력 있는 도구로 변경
- `Insert target: ...` 텍스트 제거
- prompt tab 라벨을 모바일용 `Main` / `Negative`로 단축
- 탭이 현재 편집 대상과 색상 식별을 담당
- 접힘 상태를 긴 바가 아닌 56px 원형 런처로 변경
- 오버레이 크기 조절을 좌/우/상/하 4방향으로 확장
- 크기 조절은 viewport 8px padding 안에서 clamp
- 오버레이를 접었을 때도 내부 body DOM은 제거하지 않고 숨김 처리
- 접었다 펼칠 때 Tag Dictionary, Main Prompt, Parameters, Queue의 개별 펼침 상태 보존
- 최초 실행 기본 펼침 상태는 Main Prompt와 Queue만 open
- Tag Dictionary와 Parameters는 최초 실행 시 collapsed
- 접힌 원형 런처가 화면 구석에 있어도 펼칠 때 전체 패널을 viewport 안쪽으로 자동 보정
- 모바일 visual viewport resize/scroll 이벤트를 감지해 주소창, 가상 키보드, 회전 등으로 viewport가 바뀔 때 위치 재보정

테마 동기화를 복구했다.

- NovelAI가 CSS variables를 쓰지 않는 전제를 반영
- Styled Components DOM의 computed style 표본 채취
- page/panel/input/parameter/generate accent 샘플링
- 글자색은 첫 후보가 아니라 현재 배경 대비가 좋은 색을 선택
- interactive 요소의 글자색이 일반 본문색을 오염시키지 않도록 필터링
- 밝은 NAI 테마에서 흰 글자 오염이 overlay에 전파되는 문제 수정

배포/검증 루틴을 강화했다.

- bookmarklet smoke에 LSB import 검증 포함
- four-edge resize viewport bound 검증 포함
- circular collapse launcher 검증 포함
- theme text matching 검증 포함
- prompt field subtitle 제거 검증 포함

Batched Queue 1단계를 구현했다.

- `Queue Images`로 여러 이미지 파일을 선택하면 각 이미지의 NovelAI 메타데이터를 Preset으로 저장하고 기존 Queue 뒤에 추가
- 폴더 선택은 모바일 기준 1단계에서 지원하지 않음
- Queue mode는 `batched`와 `randomized`
- 기존 progression은 `batched + runsPerPreset = 1`로 흡수
- `runsPerPreset`은 batched에서 프리셋당 반복 수로 사용
- Queue seed 기본값은 항상 `random`
- `+1`/`-1` seed는 프리셋 내부 반복 index 기준으로 적용
- Queue 실행 중 preset source 목록은 세션 시작 시 snapshot으로 고정
- Queue 실행 루프는 `src/queue/useQueueRunner.ts`로 분리하고 `useAutoGenerator.ts`는 UI 설정 adapter로 축소
- compose smoke에서 PNG metadata fixture 2개를 Queue Images로 주입해 Preset 생성과 Queue chip 추가를 검증
- Queue 실행 중 현재 preset 이름과 batch 진행률을 Queue panel에 작게 표시하도록 UI 개선

## 핵심 파일

- `src/utils/stealthLsbDecoder.ts`
  - alpha LSB `stealth_pngcomp` 복원 로직

- `src/utils/pngParser.ts`
  - PNG text metadata, stealth fallback, batch image import merge

- `src/styles/themeProbe.ts`
  - NovelAI DOM/CSS 표본 채취 방식 테마 동기화

- `src/styles/theme.ts`
  - ThemeColors, fallback tokens, dynamic theme hook

- `src/components/PromptPairTabs.tsx`
  - Main/Negative 및 Character/Negative Character 공통 탭 UI

- `src/components/MainPromptSection.tsx`
  - Main Prompt 섹션. 중복 subtitle 제거 완료

- `src/components/CharacterCaptions.tsx`
  - Character prompt pair 렌더링. 중복 subtitle 제거 완료

- `src/hooks/useEdgeResize.ts`
  - 4방향 overlay resize

- `src/App.tsx`
  - overlay shell 조립
  - two-finger drag 시작점
  - collapse launcher (drag/click 충돌 해결)
  - viewport guard (visualViewport tracking을 통한 동적 maxHeight 관리 추가)
  - section state preservation을 위한 body visibility 전환

- `scripts/e2e/bookmarklet-injection-smoke.mjs`
  - 실제 번들 주입 smoke. theme, resize, collapse, LSB import, apply/generate 검증

- `scripts/e2e/compose-smoke.mjs`
  - 모바일 compose flow, prompt targeting, highlight, queue, apply lock, section default state, collapse state preservation, viewport guard 검증
  - Queue Images fixture import, Queue seed 기본값 random, batched/randomized mode 컨트롤 검증

- `src/queue/queuePlanner.ts`
  - Batched Queue source 선택, randomized 선택, preset 내부 반복 index 기준 seed rule 계산

- `src/queue/useQueueRunner.ts`
  - Queue timeout 예약, `runApplyPipeline()` 호출, stop/failure/completion 상태 전이 연결

- `src/components/PresetManager.tsx`
  - Load Image와 Queue Images 진입점 분리. Queue Images는 이미지별 Preset 생성 후 Queue append

## 반드시 지킬 것

작업 후에는 빌드된 `dist/nai-tag-builder.js`를 커밋해야 한다.

북마클릿 배포 확인은 로컬 성공만으로 끝내지 않는다. 반드시 원격 JS를 직접 받아 sentinel string을 확인한다.

권장 검증:

```bash
rtk git diff --check
rtk npm run lint
rtk npm run build
rtk npm run test:e2e:bookmarklet
rtk npm run test:e2e:compose
```

원격 확인 예:

```bash
rtk pwsh -NoProfile -Command '$u = "https://jn01020304.github.io/nai-tag-builder/nai-tag-builder.js?t=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $text = (Invoke-WebRequest -UseBasicParsing -Uri $u).Content; [pscustomobject]@{ HasLoadImage=$text.Contains("Load Image"); HasWebp=$text.Contains("image/webp") } | ConvertTo-Json -Compress'
```

## 주의할 함정

GitHub Pages가 오래된 artifact를 잠깐 서빙할 수 있다. push 직후 원격 sentinel이 false면 5-15초 기다렸다가 다시 확인한다.

모바일 오버레이 셸은 단순한 레이아웃 장식이 아니라 제품의 핵심 런타임 계약이다. 드래그, 리사이즈, 접힘, 펼침 중 하나를 고칠 때 나머지 셋을 깨뜨리기 쉽다.

오버레이를 접을 때 body를 unmount하면 섹션별 펼침 상태가 초기화된다. 현재는 `display: none`으로 숨겨 내부 `Panel` state를 보존한다.

오버레이 위치 보정은 `window.innerWidth/innerHeight`만 보지 않고 가능하면 `window.visualViewport`를 함께 본다. 모바일 주소창, 확대, OSK, 화면 회전에서는 layout viewport와 visual viewport가 다를 수 있다.

리사이즈 핸들은 4면과 4모서리를 모두 유지해야 한다. 두 손가락 드래그를 수정할 때 `[data-overlay-resize-handle='true']` 예외를 제거하면 안 된다.

NovelAI 테마는 CSS 변수로 읽을 수 없다. `getComputedStyle()` 표본 채취 방식만 믿어야 한다.

글자색은 첫 번째 DOM 후보를 그대로 쓰면 안 된다. 버튼/태그의 흰 글자가 밝은 배경에 잘못 적용될 수 있다.

textarea 하이라이트는 보호 대상이다. textarea 배경을 칠하면 weighted prompt syntax highlighting이 묻힌다.

WebP/LSB 복원은 이미지 변환 과정에서 alpha LSB가 보존된 경우에만 가능하다. 손실 변환은 payload를 깨뜨릴 수 있다.

React-controlled NovelAI input은 직접 DOM 값 변경이 되돌아갈 수 있다. 기본 적용 경로는 metadata import pipeline이다.

## 다음 후보 작업

- Theme Probe Validation (실제 NovelAI theme variants에서 표본 추가 검증)
