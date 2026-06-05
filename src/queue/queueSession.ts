import type { ApplyPipelineResult } from "../automation/applyPipeline";
import type {
  QueueDraft,
  QueueFailure,
  QueueRunLogEntry,
  QueueSession,
  QueueSessionStatus,
  QueueTickPlan,
} from "./queueTypes";

const MAX_QUEUE_LOG_ENTRIES = 50;

export function createQueueRunId(now = Date.now()): string {
  return `queue_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function appendQueueLog(session: QueueSession, entry: QueueRunLogEntry): QueueRunLogEntry[] {
  return [...session.log, entry].slice(-MAX_QUEUE_LOG_ENTRIES);
}

function withLog(
  session: QueueSession,
  status: QueueSessionStatus,
  message: string,
  now: number,
  plan?: QueueTickPlan,
  failure?: QueueFailure,
): QueueSession {
  return {
    ...session,
    status,
    updatedAt: now,
    currentPlan: plan,
    lastError: failure ?? session.lastError,
    log: appendQueueLog(session, {
      timestamp: now,
      runId: session.runId,
      tickIndex: plan?.tickIndex ?? failure?.tickIndex,
      phase: status,
      sourceName: plan?.source.name ?? failure?.sourceName,
      errorCode: failure?.code,
      message,
    }),
  };
}

export function startQueueSession(draft: QueueDraft, now = Date.now()): QueueSession {
  const runId = createQueueRunId(now);
  const session: QueueSession = {
    runId,
    status: "starting",
    currentIndex: 0,
    completedCount: 0,
    targetCount: draft.targetCount,
    startedAt: now,
    updatedAt: now,
    log: [],
  };

  return withLog(session, "starting", "Queue 세션을 시작했습니다.", now);
}

export function markQueueWaiting(session: QueueSession, plan: QueueTickPlan, now = Date.now()): QueueSession {
  return withLog(session, "waiting", "다음 Queue tick을 예약했습니다.", now, plan);
}

export function markQueueApplying(session: QueueSession, plan: QueueTickPlan, now = Date.now()): QueueSession {
  return withLog(session, "applying", "Queue tick 적용을 시작했습니다.", now, plan);
}

export function markQueueGenerating(session: QueueSession, plan: QueueTickPlan, now = Date.now()): QueueSession {
  return withLog(session, "generating", "NovelAI 생성 완료를 기다리는 중입니다.", now, plan);
}

export function markQueueTickSuccess(
  session: QueueSession,
  plan: QueueTickPlan,
  result: ApplyPipelineResult,
  now = Date.now(),
): QueueSession {
  const completedCount = session.completedCount + 1;
  const nextStatus: QueueSessionStatus = completedCount >= session.targetCount ? "completed" : "cooldown";
  const nextSession: QueueSession = {
    ...session,
    currentIndex: plan.tickIndex + 1,
    completedCount,
    lastAppliedSeed: result.plan.seed.appliedSeed,
    lastError: undefined,
  };

  return withLog(nextSession, nextStatus, "Queue tick이 성공했습니다.", now, plan);
}

export function markQueueTickFailure(
  session: QueueSession,
  failure: QueueFailure,
  now = Date.now(),
): QueueSession {
  return withLog(session, "failed", failure.message, now, session.currentPlan, failure);
}

export function markQueueStopped(session: QueueSession, now = Date.now()): QueueSession {
  return withLog(session, "stopped", "Queue 세션을 사용자가 중지했습니다.", now, session.currentPlan);
}
