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

interface ActiveQueueRun {
  runId: string;
  stopped: boolean;
  completedCount: number;
  queueCursor: number;
  timeoutId: number | null;
  applyAbort: AbortController | null;
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
  const queueSessionRef = useRef<QueueSession | null>(null);
  const activeRunRef = useRef<ActiveQueueRun | null>(null);

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
    const activeRun = activeRunRef.current;
    if (activeRun) {
      activeRun.stopped = true;
      if (activeRun.timeoutId !== null) {
        clearTimeout(activeRun.timeoutId);
        activeRun.timeoutId = null;
      }
      activeRun.applyAbort?.abort();
      activeRun.applyAbort = null;
      activeRunRef.current = null;
    }
    if (
      activeRun &&
      queueSessionRef.current &&
      queueSessionRef.current.runId === activeRun.runId &&
      queueSessionRef.current.status !== "completed" &&
      queueSessionRef.current.status !== "failed" &&
      queueSessionRef.current.status !== "stopped"
    ) {
      updateQueueSession(markQueueStopped(queueSessionRef.current));
    }
    setIsLooping(false);
  };

  useEffect(() => () => {
    const activeRun = activeRunRef.current;
    if (!activeRun) return;
    activeRun.stopped = true;
    if (activeRun.timeoutId !== null) clearTimeout(activeRun.timeoutId);
    activeRun.applyAbort?.abort();
    activeRunRef.current = null;
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
    setIsLooping(true);
    setLoopCount(0);

    const draft = createQueueDraft({
      targetCount: targetCountRef.current,
      intervalSec: intervalRef.current,
      seedRule: seedRuleRef.current,
      queueMode: queueModeRef.current,
      runsPerPreset: runsPerPresetRef.current,
    });
    const initialSession = startQueueSession(draft);
    const activeRun: ActiveQueueRun = {
      runId: initialSession.runId,
      stopped: false,
      completedCount: 0,
      queueCursor: 0,
      timeoutId: null,
      applyAbort: null,
    };
    activeRunRef.current = activeRun;
    updateQueueSession(initialSession);

    const isActiveRun = () => (
      activeRunRef.current === activeRun &&
      !activeRun.stopped
    );
    const getActiveSession = (): QueueSession | null => {
      if (!isActiveRun()) return null;
      const currentSession = queueSessionRef.current;
      return currentSession?.runId === activeRun.runId ? currentSession : null;
    };
    const finishActiveRun = () => {
      if (!isActiveRun()) return;
      if (activeRun.timeoutId !== null) {
        clearTimeout(activeRun.timeoutId);
        activeRun.timeoutId = null;
      }
      activeRun.applyAbort = null;
      activeRunRef.current = null;
      setIsLooping(false);
    };

    let initialSources: QueueSourceSnapshot[];
    try {
      initialSources = await getQueuedSources();
    } catch (error) {
      const currentSession = getActiveSession();
      if (!currentSession) return;
      const detail = error instanceof Error ? error.message : undefined;
      updateQueueSession(markQueueTickFailure(currentSession, {
        code: "QUEUE_PLANNING_FAILED",
        message: "Queue 프리셋을 불러오지 못했습니다.",
        detail,
      }));
      feedbackRef.current?.({
        tone: "error",
        message: "Queue 프리셋을 불러오지 못했습니다.",
        detail,
      });
      finishActiveRun();
      return;
    }

    if (!getActiveSession()) return;
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
      const currentSession = getActiveSession();
      if (!currentSession) return;

      if (activeRun.completedCount >= draft.targetCount) {
        finishActiveRun();
        return;
      }

      const plan = planNextQueueTick({
        runId: currentSession.runId,
        draft,
        currentState: stateRef.current,
        queuedSources: initialSources,
        tickIndex: activeRun.completedCount,
        queueCursor: activeRun.queueCursor,
        scheduledAt: Date.now(),
      });

      if (!plan) {
        finishActiveRun();
        return;
      }

      activeRun.queueCursor = plan.nextQueueCursor;
      const waitingSession = markQueueWaiting(currentSession, plan);
      updateQueueSession(waitingSession);
      updateQueueSession(markQueueApplying(waitingSession, plan));
      const applyAbort = new AbortController();
      activeRun.applyAbort = applyAbort;

      try {
        const result = await runApplyPipeline({
          state: plan.state,
          autoGenerate: true,
          signal: applyAbort.signal,
          onPhase: (event) => {
            if (event.phase === "waiting-generation-complete") {
              const phaseSession = getActiveSession();
              if (phaseSession) {
                updateQueueSession(markQueueGenerating(phaseSession, plan));
              }
            }
          },
        });
        if (activeRun.applyAbort === applyAbort) {
          activeRun.applyAbort = null;
        }
        const resultSession = getActiveSession();
        if (!resultSession) return;
        if (result.effect.status === "failed") {
          console.error("Auto generate effect failed:", result.effect);
          updateQueueSession(markQueueTickFailure(resultSession, {
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
          finishActiveRun();
          return;
        }
        updateQueueSession(markQueueTickSuccess(resultSession, plan, result));
        feedbackRef.current?.({
          tone: "success",
          message: result.effect.message,
        });
      } catch (error) {
        if (activeRun.applyAbort === applyAbort) {
          activeRun.applyAbort = null;
        }
        const errorSession = getActiveSession();
        if (!errorSession) return;
        console.error("Auto generate pipeline failed:", error);
        updateQueueSession(markQueueTickFailure(errorSession, {
          code: "QUEUE_PLANNING_FAILED",
          message: "자동 생성 적용 중 오류가 발생했습니다.",
          detail: error instanceof Error ? error.message : undefined,
          sourceName: plan.source.name,
          tickIndex: plan.tickIndex,
        }));
        feedbackRef.current?.({ tone: "error", message: "자동 생성 적용 중 오류가 발생했습니다." });
        finishActiveRun();
        return;
      }

      if (!isActiveRun()) return;
      activeRun.completedCount += 1;
      setLoopCount(activeRun.completedCount);
      if (activeRun.completedCount >= draft.targetCount) {
        finishActiveRun();
        return;
      }
      activeRun.timeoutId = window.setTimeout(executeLoop, draft.intervalSec * 1000);
    };

    if (!isActiveRun()) return;
    void executeLoop();
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
