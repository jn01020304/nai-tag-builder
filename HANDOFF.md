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

# Handoff — 2026-06-08

## 현재 상태

`nai-tag-builder`는 NovelAI 이미지 생성 페이지에 주입되는 모바일 우선 북마클릿 오버레이다.

최근 작업의 중심은 세 가지다.

- EXIF/PNG 청크가 없는 NovelAI 이미지에서도 프롬프트 메타데이터 복원
- NovelAI 실제 테마와의 색상 동기화 복구
- 모바일 화면을 덜 잡아먹는 UI 정리

현재 `main`은 배포된 GitHub Pages 번들과 동기화되어 있으며, 최신 북마클릿은 원격 `nai-tag-builder.js`를 `?t=Date.now()`로 로드한다.

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
- `Insert target: ...` 텍스트 제거
- prompt tab 라벨을 모바일용 `Main` / `Negative`로 단축
- 탭이 현재 편집 대상과 색상 식별을 담당
- 접힘 상태를 긴 바가 아닌 56px 원형 런처로 변경
- 오버레이 크기 조절을 좌/우/상/하 4방향으로 확장
- 크기 조절은 viewport 8px padding 안에서 clamp

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

- `scripts/e2e/bookmarklet-injection-smoke.mjs`
  - 실제 번들 주입 smoke. theme, resize, collapse, LSB import, apply/generate 검증

- `scripts/e2e/compose-smoke.mjs`
  - 모바일 compose flow, prompt targeting, highlight, queue, apply lock 검증

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

NovelAI 테마는 CSS 변수로 읽을 수 없다. `getComputedStyle()` 표본 채취 방식만 믿어야 한다.

글자색은 첫 번째 DOM 후보를 그대로 쓰면 안 된다. 버튼/태그의 흰 글자가 밝은 배경에 잘못 적용될 수 있다.

textarea 하이라이트는 보호 대상이다. textarea 배경을 칠하면 weighted prompt syntax highlighting이 묻힌다.

WebP/LSB 복원은 이미지 변환 과정에서 alpha LSB가 보존된 경우에만 가능하다. 손실 변환은 payload를 깨뜨릴 수 있다.

React-controlled NovelAI input은 직접 DOM 값 변경이 되돌아갈 수 있다. 기본 적용 경로는 metadata import pipeline이다.

## 다음 후보 작업

- Queue 세션의 batch import 기반 random rotation 설계
- tag dictionary를 더 작은 모바일 작업면으로 재배치
- 실기기 모바일에서 원형 collapse launcher drag/click 충돌 확인
- 실제 NovelAI theme variants에서 `themeProbe` 표본 후보 추가 검증
