import { useEffect, useRef, useState } from 'react';
import { runApplyPipeline } from '../automation/applyPipeline';
import { formatApplyErrorDetail } from '../automation/applyStatusText';
import { getPresetById } from '../model/presetStorage';
import {
  createCurrentStateSource,
  createQueueDraft,
  createQueuePreflightWarnings,
  planNextQueueTick,
} from '../queue/queuePlanner';
import {
  markQueueApplying,
  markQueueGenerating,
  markQueueStopped,
  markQueueTickFailure,
  markQueueTickSuccess,
  markQueueWaiting,
  startQueueSession,
} from '../queue/queueSession';
import type { QueueSession, QueueSourceSnapshot } from '../queue/queueTypes';
import type { ShowFeedback } from '../types/feedback';
import type { MetadataState } from '../types/metadata';
import type { QueueMode, SeedRule } from '../types/preset';

export interface AutoGeneratorConfig {
  state: MetadataState;
  queue: string[];
  queueMode: QueueMode;
  onFeedback?: ShowFeedback;
}

export function useAutoGenerator({ state, queue, queueMode, onFeedback }: AutoGeneratorConfig) {
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number | string>(30);
  const [targetCount, setTargetCount] = useState<number | string>(100);
  const [targetMin, setTargetMin] = useState<number | string>(50);
  const [isLooping, setIsLooping] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [queueSession, setQueueSession] = useState<QueueSession | null>(null);
  const [seedRule, setSeedRule] = useState<SeedRule>('none');
  const [adjustStep, setAdjustStep] = useState<number | string>(3);

  const stateRef = useRef(state);
  const queueRef = useRef(queue);
  const queueModeRef = useRef(queueMode);
  const seedRuleRef = useRef(seedRule);
  const feedbackRef = useRef(onFeedback);
  const loopCountRef = useRef(0);
  const loopTimeoutRef = useRef<number | null>(null);
  const applyAbortRef = useRef<AbortController | null>(null);
  const queueIndexRef = useRef(0);
  const queueSessionRef = useRef<QueueSession | null>(null);
  const stopRequestedRef = useRef(false);
  const intervalRef = useRef(Number(intervalSec) || 30);
  const targetCountRef = useRef(Number(targetCount) || 100);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
  useEffect(() => { seedRuleRef.current = seedRule; }, [seedRule]);
  useEffect(() => { feedbackRef.current = onFeedback; }, [onFeedback]);
  useEffect(() => { intervalRef.current = Number(intervalSec); }, [intervalSec]);
  useEffect(() => { targetCountRef.current = Number(targetCount); }, [targetCount]);

  const updateQueueSession = (nextSession: QueueSession | null) => {
    queueSessionRef.current = nextSession;
    setQueueSession(nextSession);
  };

  const stopLoop = () => {
    if (loopTimeoutRef.current !== null) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    applyAbortRef.current?.abort();
    applyAbortRef.current = null;
    stopRequestedRef.current = true;
    if (
      queueSessionRef.current &&
      queueSessionRef.current.status !== 'completed' &&
      queueSessionRef.current.status !== 'failed' &&
      queueSessionRef.current.status !== 'stopped'
    ) {
      updateQueueSession(markQueueStopped(queueSessionRef.current));
    }
    setIsLooping(false);
  };

  useEffect(() => () => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    applyAbortRef.current?.abort();
  }, []);

  const getQueuedSources = async (): Promise<QueueSourceSnapshot[]> => {
    const presets = await Promise.all(queueRef.current.map((id) => getPresetById(id)));
    return presets
      .filter((preset): preset is NonNullable<typeof preset> => preset != null)
      .map((preset) => ({
        kind: 'preset',
        id: preset.id,
        name: preset.name,
        state: preset.state,
      }));
  };

  const startLoop = () => {
    void startQueueLoop();
  };

  const startQueueLoop = async () => {
    stopLoop();
    stopRequestedRef.current = false;
    setIsLooping(true);
    loopCountRef.current = 0;
    setLoopCount(0);
    queueIndexRef.current = 0;

    const draft = createQueueDraft({
      targetCount: targetCountRef.current,
      intervalSec: intervalRef.current,
      seedRule: seedRuleRef.current,
      queueMode: queueModeRef.current,
      hasPresetQueue: queueRef.current.length > 0,
    });
    const initialSession = startQueueSession(draft);
    updateQueueSession(initialSession);

    const initialSources = await getQueuedSources();
    const warnings = createQueuePreflightWarnings(
      draft,
      initialSources,
      createCurrentStateSource(stateRef.current),
    );
    const firstWarning = warnings.find((warning) => warning.severity === 'warning');

    if (firstWarning) {
      feedbackRef.current?.({
        tone: firstWarning.severity,
        message: firstWarning.message,
        detail: firstWarning.sourceName
          ? `${firstWarning.sourceName}: ${firstWarning.hint}`
          : firstWarning.hint,
      });
    }

    const executeLoop = async () => {
      if (stopRequestedRef.current) return;
      const currentSession = queueSessionRef.current;
      if (!currentSession || currentSession.runId !== initialSession.runId) return;

      if (loopCountRef.current >= draft.targetCount) {
        stopLoop();
        return;
      }

      const queuedSources = await getQueuedSources();
      const plan = planNextQueueTick({
        runId: currentSession.runId,
        draft,
        currentState: stateRef.current,
        queuedSources,
        tickIndex: loopCountRef.current,
        queueCursor: queueIndexRef.current,
        scheduledAt: Date.now(),
      });

      if (!plan) {
        stopLoop();
        return;
      }

      queueIndexRef.current = plan.nextQueueCursor;
      updateQueueSession(markQueueWaiting(currentSession, plan));
      updateQueueSession(markQueueApplying(queueSessionRef.current ?? currentSession, plan));
      const applyAbort = new AbortController();
      applyAbortRef.current = applyAbort;

      try {
        const result = await runApplyPipeline({
          state: plan.state,
          autoGenerate: true,
          signal: applyAbort.signal,
          onPhase: (event) => {
            if (event.phase === 'waiting-generation-complete') {
              updateQueueSession(markQueueGenerating(queueSessionRef.current ?? currentSession, plan));
            }
          },
        });
        if (applyAbortRef.current === applyAbort) {
          applyAbortRef.current = null;
        }
        if (result.effect.status === 'failed') {
          if (result.effect.code === 'ABORTED' && stopRequestedRef.current) return;
          console.error('Auto generate effect failed:', result.effect);
          updateQueueSession(markQueueTickFailure(queueSessionRef.current ?? currentSession, {
            code: result.effect.code,
            message: result.effect.message,
            detail: result.effect.detail,
            sourceName: plan.source.name,
            tickIndex: plan.tickIndex,
          }));
          feedbackRef.current?.({
            tone: 'error',
            message: result.effect.message,
            detail: formatApplyErrorDetail(result.effect.code, result.effect.detail),
          });
          stopLoop();
          return;
        }
        updateQueueSession(markQueueTickSuccess(queueSessionRef.current ?? currentSession, plan, result));
      } catch (error) {
        if (applyAbortRef.current === applyAbort) {
          applyAbortRef.current = null;
        }
        if (stopRequestedRef.current) return;
        console.error('Auto generate pipeline failed:', error);
        updateQueueSession(markQueueTickFailure(queueSessionRef.current ?? currentSession, {
          code: 'QUEUE_PLANNING_FAILED',
          message: '자동 생성 적용 중 오류가 발생했습니다.',
          detail: error instanceof Error ? error.message : undefined,
          sourceName: plan.source.name,
          tickIndex: plan.tickIndex,
        }));
        feedbackRef.current?.({ tone: 'error', message: '자동 생성 적용 중 오류가 발생했습니다.' });
        stopLoop();
        return;
      }

      loopCountRef.current += 1;
      setLoopCount(loopCountRef.current);
      if (loopCountRef.current >= draft.targetCount) {
        setIsLooping(false);
        loopTimeoutRef.current = null;
        return;
      }
      loopTimeoutRef.current = window.setTimeout(executeLoop, draft.intervalSec * 1000);
    };

    if (stopRequestedRef.current) return;
    loopTimeoutRef.current = window.setTimeout(executeLoop, draft.intervalSec * 1000);
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
    const step = Number(adjustStep) || 3;
    if (type === 'interval') {
      const val = Math.max(3, Number(intervalSec) + (step * dir));
      handleIntervalChange(String(val));
    } else {
      const val = Math.max(1, Number(targetCount) + (step * dir));
      handleCountChange(String(val));
    }
  };

  return {
    autoGenerate, setAutoGenerate,
    seedRule, setSeedRule,
    intervalSec, targetCount, targetMin, adjustStep, setAdjustStep,
    isLooping, loopCount, queueSession,
    startLoop, stopLoop,
    handleIntervalChange, handleCountChange, handleMinChange, adjustValue,
  };
}
