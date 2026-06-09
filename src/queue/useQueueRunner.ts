import { useEffect, useRef, useState } from "react";
import { runApplyPipeline } from "../automation/applyPipeline";
import { formatApplyErrorDetail } from "../automation/applyStatusText";
import { getPresetById } from "../model/presetStorage";
import type { ShowFeedback } from "../types/feedback";
import type { MetadataState } from "../types/metadata";
import type { QueueMode, SeedRule } from "../types/preset";
import {
  createCurrentStateSource,
  createQueueDraft,
  createQueuePreflightWarnings,
  planNextQueueTick,
} from "./queuePlanner";
import {
  markQueueApplying,
  markQueueGenerating,
  markQueueStopped,
  markQueueTickFailure,
  markQueueTickSuccess,
  markQueueWaiting,
  startQueueSession,
} from "./queueSession";
import type { QueueSession, QueueSourceSnapshot } from "./queueTypes";

export interface QueueRunnerConfig {
  state: MetadataState;
  queue: string[];
  queueMode: QueueMode;
  seedRule: SeedRule;
  intervalSec: number | string;
  targetCount: number | string;
  runsPerPreset: number | string;
  onFeedback?: ShowFeedback;
}

export interface QueueRunnerState {
  isLooping: boolean;
  loopCount: number;
  queueSession: QueueSession | null;
  startLoop: () => void;
  stopLoop: () => void;
}

export function useQueueRunner({
  state,
  queue,
  queueMode,
  seedRule,
  intervalSec,
  targetCount,
  runsPerPreset,
  onFeedback,
}: QueueRunnerConfig): QueueRunnerState {
  const [isLooping, setIsLooping] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [queueSession, setQueueSession] = useState<QueueSession | null>(null);

  const stateRef = useRef(state);
  const queueRef = useRef(queue);
  const queueModeRef = useRef(queueMode);
  const seedRuleRef = useRef(seedRule);
  const feedbackRef = useRef(onFeedback);
  const intervalRef = useRef(Number(intervalSec) || 10);
  const targetCountRef = useRef(Number(targetCount) || 100);
  const runsPerPresetRef = useRef(Number(runsPerPreset) || 1);
  const loopCountRef = useRef(0);
  const loopTimeoutRef = useRef<number | null>(null);
  const applyAbortRef = useRef<AbortController | null>(null);
  const queueIndexRef = useRef(0);
  const queueSessionRef = useRef<QueueSession | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueModeRef.current = queueMode; }, [queueMode]);
  useEffect(() => { seedRuleRef.current = seedRule; }, [seedRule]);
  useEffect(() => { feedbackRef.current = onFeedback; }, [onFeedback]);
  useEffect(() => { intervalRef.current = Number(intervalSec); }, [intervalSec]);
  useEffect(() => { targetCountRef.current = Number(targetCount); }, [targetCount]);
  useEffect(() => { runsPerPresetRef.current = Number(runsPerPreset); }, [runsPerPreset]);

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
      queueSessionRef.current.status !== "completed" &&
      queueSessionRef.current.status !== "failed" &&
      queueSessionRef.current.status !== "stopped"
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
        kind: "preset",
        id: preset.id,
        name: preset.name,
        state: preset.state,
      }));
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
      runsPerPreset: runsPerPresetRef.current,
    });
    const initialSession = startQueueSession(draft);
    updateQueueSession(initialSession);

    const initialSources = await getQueuedSources();
    const warnings = createQueuePreflightWarnings(
      draft,
      initialSources,
      createCurrentStateSource(stateRef.current),
    );
    const firstWarning = warnings.find((warning) => warning.severity === "warning");

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

      const plan = planNextQueueTick({
        runId: currentSession.runId,
        draft,
        currentState: stateRef.current,
        queuedSources: initialSources,
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
            if (event.phase === "waiting-generation-complete") {
              updateQueueSession(markQueueGenerating(queueSessionRef.current ?? currentSession, plan));
            }
          },
        });
        if (applyAbortRef.current === applyAbort) {
          applyAbortRef.current = null;
        }
        if (result.effect.status === "failed") {
          if (result.effect.code === "ABORTED" && stopRequestedRef.current) return;
          console.error("Auto generate effect failed:", result.effect);
          updateQueueSession(markQueueTickFailure(queueSessionRef.current ?? currentSession, {
            code: result.effect.code,
            message: result.effect.message,
            detail: result.effect.detail,
            sourceName: plan.source.name,
            tickIndex: plan.tickIndex,
          }));
          feedbackRef.current?.({
            tone: "error",
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
        console.error("Auto generate pipeline failed:", error);
        updateQueueSession(markQueueTickFailure(queueSessionRef.current ?? currentSession, {
          code: "QUEUE_PLANNING_FAILED",
          message: "자동 생성 적용 중 오류가 발생했습니다.",
          detail: error instanceof Error ? error.message : undefined,
          sourceName: plan.source.name,
          tickIndex: plan.tickIndex,
        }));
        feedbackRef.current?.({ tone: "error", message: "자동 생성 적용 중 오류가 발생했습니다." });
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

  const startLoop = () => {
    void startQueueLoop();
  };

  return {
    isLooping,
    loopCount,
    queueSession,
    startLoop,
    stopLoop,
  };
}
