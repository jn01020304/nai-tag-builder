import { useState, useRef, useEffect } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import { buildCommentJson } from './model/buildCommentJson';
import { generatePngWithMetadata } from './encoding/pngEncoder';
import { dispatchPasteEvent } from './encoding/pasteDispatch';
import { getPresetById } from './model/presetStorage';
import type { QueueMode } from './types/preset';
import { theme, inputStyle, labelStyle } from './styles/theme';
import PromptSection from './components/PromptSection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import NegativePrompt from './components/NegativePrompt';
import AdvancedParams from './components/AdvancedParams';
import ApplyButton from './components/ApplyButton';
import PresetManager from './components/PresetManager';

const CONTAINER_ID = 'nai-tag-builder-root';
type SeedRule = 'none' | 'random' | 'decrement' | 'increment';

function findNaiSeedInput(): HTMLInputElement | null {
  const inputs = Array.from(document.querySelectorAll('input'));

  // 1. Direct ID/Name match
  for (const input of inputs) {
    if (input.id.toLowerCase().includes('seed') || input.name.toLowerCase().includes('seed')) {
      return input;
    }
  }

  // 2. Proximity to "Seed" text
  for (const input of inputs) {
    let parent = input.parentElement;
    for (let i = 0; i < 6 && parent; i++) {
      if (parent.textContent?.toLowerCase().includes('seed')) {
        return input;
      }
      // Check previous siblings of this parent level
      let prev = parent.previousElementSibling;
      while (prev) {
        if (prev.textContent?.toLowerCase().includes('seed')) return input;
        prev = prev.previousElementSibling;
      }
      parent = parent.parentElement;
    }
  }

  return null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  input.focus();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, key: 'Enter', code: 'Enter' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: 'Enter', code: 'Enter' }));
  input.blur();
} function startDrag(clientX: number, clientY: number) {
  const el = document.getElementById(CONTAINER_ID) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  el.style.right = '';
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';

  let lx = clientX, ly = clientY;

  const move = (cx: number, cy: number) => {
    el.style.left = (parseFloat(el.style.left) + cx - lx) + 'px';
    el.style.top = (parseFloat(el.style.top) + cy - ly) + 'px';
    lx = cx;
    ly = cy;
  };

  const onMM = (e: MouseEvent) => move(e.clientX, e.clientY);
  const onTM = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
  const up = () => {
    document.removeEventListener('mousemove', onMM);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', onTM);
    document.removeEventListener('touchend', up);
  };

  document.addEventListener('mousemove', onMM);
  document.addEventListener('mouseup', up);
  document.addEventListener('touchmove', onTM, { passive: false });
  document.addEventListener('touchend', up);
}

export default function App() {
  const [state, dispatch] = useMetadataState();
  const [isApplying, setIsApplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number | string>(30);
  const [targetCount, setTargetCount] = useState<number | string>(100);
  const [targetMin, setTargetMin] = useState<number | string>(50);
  const [isLooping, setIsLooping] = useState(false);
  const [seedRule, setSeedRule] = useState<SeedRule>('random');
  const [adjustStep, setAdjustStep] = useState<number | string>(10);

  const loopCountRef = useRef(0);
  const [overlayWidth, setOverlayWidth] = useState(320);
  const loopTimeoutRef = useRef<number | null>(null);

  // For live loop reading
  const intervalRef = useRef(Number(intervalSec) || 30);
  const targetCountRef = useRef(Number(targetCount) || 100);

  useEffect(() => { intervalRef.current = Number(intervalSec); }, [intervalSec]);
  useEffect(() => { targetCountRef.current = Number(targetCount); }, [targetCount]);

  // Preset queue state
  const [queue, setQueue] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>('progression');
  const queueIndexRef = useRef(0);

  const stopLoop = () => {
    if (loopTimeoutRef.current) { clearTimeout(loopTimeoutRef.current); loopTimeoutRef.current = null; }
    setIsLooping(false);
  };

  useEffect(() => () => { if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current); }, []);

  const handleClose = () => {
    stopLoop();
    document.getElementById(CONTAINER_ID)?.remove();
  };

  const getNextQueueState = () => {
    if (queue.length === 0) return null;
    let idx: number;
    if (queueMode === 'randomization') {
      idx = Math.floor(Math.random() * queue.length);
    } else {
      idx = queueIndexRef.current % queue.length;
      queueIndexRef.current = idx + 1;
    }
    const preset = getPresetById(queue[idx]);
    return preset?.state ?? null;
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const comment = buildCommentJson(state);
      const blob = await generatePngWithMetadata(comment);
      dispatchPasteEvent(blob, autoGenerate);
      setIsCollapsed(true);

      if (autoGenerate && Number(intervalSec) > 0 && Number(targetCount) > 0) {
        stopLoop();
        setIsLooping(true);
        loopCountRef.current = 0;
        queueIndexRef.current = 0;
        let currentLoopSeed = Number(state.seed);

        const executeLoop = async () => {
          if (loopCountRef.current >= targetCountRef.current) {
            stopLoop();
            return;
          }

          const genBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent?.includes('Generate')) as HTMLButtonElement | undefined;

          const revealSeedInputAndSet = async (nextSeed: number): Promise<boolean> => {
            // 1. Direct check if it's already visible
            let naiSeedInput = findNaiSeedInput();
            if (naiSeedInput) {
              setReactInputValue(naiSeedInput, String(nextSeed));
              return true;
            }

            const buttons = Array.from(document.querySelectorAll('button'));

            // 2. UI Might be collapsed (mobile view). Look for the expander button (▲) or setting gears.
            const expanderBtns = buttons.filter(b =>
              b.textContent?.includes('▲') ||
              b.textContent?.toLowerCase().includes('parameters') ||
              b.textContent?.toLowerCase().includes('advanced') ||
              b.querySelector('svg')
            );

            // Try clicking expanders one by one
            for (const btn of expanderBtns) {
              btn.click();
              await new Promise(r => setTimeout(r, 200)); // wait for react render

              let maybeInput = findNaiSeedInput();
              if (maybeInput) {
                setReactInputValue(maybeInput, String(nextSeed));
                return true;
              }

              // It also might be in the "N/A" (random) button state after expanding.
              const seedNaBtn = Array.from(document.querySelectorAll('button')).find(b => {
                if (b.textContent?.trim() !== 'N/A') return false;
                let parent = b.parentElement;
                for (let i = 0; i < 4 && parent; i++) {
                  if (parent.textContent?.toLowerCase().includes('seed')) return true;
                  if (parent.previousElementSibling?.textContent?.toLowerCase().includes('seed')) return true;
                  parent = parent.parentElement;
                }
                return false;
              });

              if (seedNaBtn) {
                seedNaBtn.click();
                await new Promise(r => setTimeout(r, 100));
                maybeInput = findNaiSeedInput();
                if (maybeInput) {
                  setReactInputValue(maybeInput, String(nextSeed));
                  return true;
                }
              }
            }

            // 3. Failed completely to find it via DOM crawling
            return false;
          };

          if (queue.length > 0) {
            if (genBtn && genBtn.disabled) {
              const nextState = getNextQueueState() ?? state;
              const seedToUse = nextState.seed === 0 ? 0 : (currentLoopSeed += 1);
              const loopComment = buildCommentJson({ ...nextState, seed: seedToUse });
              const loopBlob = await generatePngWithMetadata(loopComment);
              dispatchPasteEvent(loopBlob, true);
            } else {
              const nextState = getNextQueueState() ?? state;
              const loopComment = buildCommentJson(nextState);
              const loopBlob = await generatePngWithMetadata(loopComment);
              dispatchPasteEvent(loopBlob, true);
            }
          } else {
            // Autonomy block: modify seed directly if rules apply
            let nextSeed = currentLoopSeed;
            if (seedRule === 'random') {
              nextSeed = 0; // 0 tells NAI to randomize
            } else if (seedRule === 'increment') {
              nextSeed = currentLoopSeed + 1;
            } else if (seedRule === 'decrement') {
              nextSeed = currentLoopSeed - 1;
            }

            if (seedRule !== 'none') {
              const success = await revealSeedInputAndSet(nextSeed);

              if (success) {
                // We successfully filled the DOM input
                if (genBtn && !genBtn.disabled) {
                  genBtn.click();
                } else if (genBtn && genBtn.disabled) {
                  console.log('Generate button is disabled. Attempting to bypass.');
                  const diceBtn = Array.from(document.querySelectorAll('button')).find(b =>
                    b.title?.toLowerCase().includes('random') ||
                    b.getAttribute('aria-label')?.toLowerCase().includes('random') ||
                    b.textContent?.toLowerCase().includes('randomize')
                  );
                  if (diceBtn) {
                    diceBtn.click();
                    setTimeout(() => genBtn.click(), 300); // Give it a moment to update
                  }
                }
              } else {
                // Mobile / DOM hidden fallback: force via Metadata Paste Event
                console.warn('[NAI Tag Builder] Seed input not found by UI crawler. Falling back to explicit metadata injection.');
                const loopComment = buildCommentJson({ ...state, seed: nextSeed });
                const loopBlob = await generatePngWithMetadata(loopComment);
                // dispatchPasteEvent automatically clicks import and generate if autoGenerate is true
                dispatchPasteEvent(loopBlob, true);
              }
            } else {
              // Same behavior as before if no seed rule is applied
              if (genBtn && !genBtn.disabled) {
                genBtn.click();
              } else if (genBtn && genBtn.disabled) {
                console.log('Generate button is disabled. Attempting to bypass.');
                const diceBtn = Array.from(document.querySelectorAll('button')).find(b =>
                  b.title?.toLowerCase().includes('random') ||
                  b.getAttribute('aria-label')?.toLowerCase().includes('random') ||
                  b.textContent?.toLowerCase().includes('randomize')
                );
                if (diceBtn) {
                  diceBtn.click();
                  setTimeout(() => genBtn.click(), 300);
                }
              }
            }
          }

          loopCountRef.current += 1;
          const nextSec = Math.max(3, intervalRef.current);
          loopTimeoutRef.current = window.setTimeout(executeLoop, nextSec * 1000);
        };

        // Start first loop after a short delay (or immediately)
        loopTimeoutRef.current = window.setTimeout(executeLoop, Math.max(3, intervalRef.current) * 1000);
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      alert('적용 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const startResize = (clientX: number) => {
    let startX = clientX;
    let startWidth = overlayWidth;

    const onMM = (e: MouseEvent) => {
      e.preventDefault();
      setOverlayWidth(Math.max(320, startWidth + (e.clientX - startX)));
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      setOverlayWidth(Math.max(320, startWidth + (e.touches[0].clientX - startX)));
    };

    const up = () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMM);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', onTM);
      document.removeEventListener('touchend', up);
    };

    document.body.style.cursor = 'ew-resize';
    document.addEventListener('mousemove', onMM);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', onTM, { passive: false });
    document.addEventListener('touchend', up);
  };

  const headerBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    padding: '0 2px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px',
    lineHeight: 1,
  };

  const smallNumInput: React.CSSProperties = {
    ...inputStyle,
    width: '60px',
    textAlign: 'center',
    padding: '4px',
  };

  const handleIntervalChange = (val: string) => {
    const sec = val === '' ? '' : Math.max(0, Number(val));
    setIntervalSec(sec);
    if (typeof sec === 'number' && typeof targetCount === 'number') {
      setTargetMin(Math.round((sec * targetCount / 60) * 10) / 10);
    }
  };

  const handleCountChange = (val: string) => {
    const count = val === '' ? '' : Math.max(0, Number(val));
    setTargetCount(count);
    if (typeof intervalSec === 'number' && typeof count === 'number') {
      setTargetMin(Math.round((intervalSec * count / 60) * 10) / 10);
    }
  };

  const handleMinChange = (val: string) => {
    const min = val === '' ? '' : Math.max(0, Number(val));
    setTargetMin(min);
    if (typeof intervalSec === 'number' && typeof min === 'number' && intervalSec > 0) {
      setTargetCount(Math.round((min * 60) / intervalSec));
    }
  };

  const adjustValue = (type: 'interval' | 'count', dir: 1 | -1) => {
    const step = Number(adjustStep) || 10;
    if (type === 'interval') {
      const val = Math.max(3, Number(intervalSec) + (step * dir));
      handleIntervalChange(String(val));
    } else {
      const val = Math.max(1, Number(targetCount) + (step * dir));
      handleCountChange(String(val));
    }
  };

  const miniBtn: React.CSSProperties = {
    background: theme.surface1, color: theme.text, border: 'none', borderRadius: '4px',
    width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  return (
    <div style={{
      width: `${overlayWidth}px`,
      minWidth: '320px',
      maxWidth: '90vw',
      maxHeight: isCollapsed ? 'none' : '80vh',
      overflowY: isCollapsed ? 'visible' : 'auto',
      backgroundColor: theme.base,
      color: theme.text,
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      fontFamily: 'sans-serif',
      border: `1px solid ${theme.surface0}`,
      paddingBottom: isCollapsed ? '0' : '12px',
      position: 'relative', // Relative for absolute components like the handle
    }}>
      {/* Right Edge Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX); }}
          onTouchStart={(e) => { e.preventDefault(); startResize(e.touches[0].clientX); }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '8px',
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 10,
            touchAction: 'none'
          }}
        />
      )}

      {/* Header — drag handle */}
      <div
        onMouseDown={(e) => {
          if ((e.target as Element).closest('button')) return;
          if (e.button === 0) startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if ((e.target as Element).closest('button')) return;
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        style={{
          backgroundColor: theme.crust,
          padding: '10px 16px',
          fontWeight: 'bold',
          fontSize: '14px',
          borderBottom: isCollapsed ? 'none' : `1px solid ${theme.surface0}`,
          marginBottom: isCollapsed ? '0' : '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          cursor: 'grab',
          borderRadius: isCollapsed ? '12px' : '12px 12px 0 0',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <span>NAI Tag Builder v2.0</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Stop button — visible only when looping */}
          {isLooping && (
            <button
              onClick={stopLoop}
              title="반복 중지"
              style={{ ...headerBtnStyle, color: theme.yellow, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ fontSize: '10px' }}>({loopCountRef.current}/{targetCount})</span>
              &#9632;
            </button>
          )}
          {/* Collapse button */}
          <button
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? '펼치기' : '접기'}
            style={{ ...headerBtnStyle, color: theme.subtext0 }}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          {/* Close button */}
          <button
            onClick={handleClose}
            title="닫기"
            style={{ ...headerBtnStyle, color: theme.red }}
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div style={{ padding: '0 12px' }}>
          <PresetManager
            state={state}
            dispatch={dispatch}
            queue={queue}
            setQueue={setQueue}
            queueMode={queueMode}
            setQueueMode={setQueueMode}
          />
          <PromptSection value={state.basePrompt} dispatch={dispatch} />
          <GenerationParams state={state} dispatch={dispatch} />
          <CharacterCaptions characters={state.characters} dispatch={dispatch} />
          <NegativePrompt state={state} dispatch={dispatch} />
          <AdvancedParams state={state} dispatch={dispatch} />

          {/* Auto-generate section */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.subtext0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                style={{ accentColor: theme.blue }}
              />
              적용 후 자동 생성
            </label>

            {autoGenerate && (
              <div style={{ marginLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* Seed Rule Selection (only relevant when queue is empty) */}
                {queue.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                    <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>시드 규칙</label>
                    <select
                      value={seedRule}
                      onChange={(e) => setSeedRule(e.target.value as SeedRule)}
                      style={{ ...inputStyle, padding: '2px 4px', fontSize: '11px' }}
                    >
                      <option value="none">건드리지 않음 (NAI설정)</option>
                      <option value="random">완전 랜덤 (0)</option>
                      <option value="increment">1씩 증가 (+1)</option>
                      <option value="decrement">1씩 감소 (-1)</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                  <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>조절 단위</label>
                  <input
                    type="number"
                    value={adjustStep}
                    onChange={(e) => setAdjustStep(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                    style={{ ...smallNumInput, width: '40px' }}
                  />
                  <span style={{ fontSize: '11px', color: theme.overlay0 }}>(+/- 버튼 클릭 시 변동량)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                  <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>간격(초)</label>
                  <button onClick={() => adjustValue('interval', -1)} style={miniBtn}>-</button>
                  <input
                    type="number"
                    value={intervalSec}
                    onChange={(e) => handleIntervalChange(e.target.value)}
                    style={smallNumInput}
                  />
                  <button onClick={() => adjustValue('interval', 1)} style={miniBtn}>+</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                  <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>목표 횟수</label>
                  <button onClick={() => adjustValue('count', -1)} style={miniBtn}>-</button>
                  <input
                    type="number"
                    value={targetCount}
                    onChange={(e) => handleCountChange(e.target.value)}
                    style={smallNumInput}
                  />
                  <button onClick={() => adjustValue('count', 1)} style={miniBtn}>+</button>
                  <span style={{ fontSize: '12px', color: theme.subtext0, marginLeft: '4px' }}>회</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                  <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>목표 시간</label>
                  <div style={{ width: '24px' }} /> {/* alignment spacer */}
                  <input
                    type="number"
                    step="0.1"
                    value={targetMin}
                    onChange={(e) => handleMinChange(e.target.value)}
                    style={smallNumInput}
                  />
                  <div style={{ width: '24px' }} /> {/* alignment spacer */}
                  <span style={{ fontSize: '12px', color: theme.subtext0, marginLeft: '4px' }}>분</span>
                </div>

                {queue.length === 0 && seedRule === 'none' && (
                  <div style={{ fontSize: '10px', color: theme.yellow, marginTop: '2px' }}>
                    * 규칙이 '건드리지 않음'입니다. 끊기지 않게 연속 생성하려면 NAI의 Seed를 0으로 맞추세요.
                  </div>
                )}
              </div>
            )}
          </div>

          <ApplyButton isApplying={isApplying} onApply={handleApply} />
        </div>
      )}
    </div>
  );
}
