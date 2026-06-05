import type { ApplyPipelinePhase, ApplyPipelineResult } from "../automation/applyPipeline";
import type { ApplyAutomationErrorCode } from "../automation/automationTypes";
import type { MetadataState } from "../types/metadata";
import type { QueueMode, SeedRule } from "../types/preset";

export type QueueSessionStatus =
  | "idle"
  | "starting"
  | "waiting"
  | "applying"
  | "generating"
  | "cooldown"
  | "stopped"
  | "completed"
  | "failed";

export type QueueSourceKind = "current-state" | "preset";

export type QueuePreflightSeverity = "info" | "warning";

export interface QueueDraft {
  targetCount: number;
  intervalSec: number;
  seedRule: SeedRule;
  queueMode: QueueMode;
  stopOnFailure: boolean;
}

export interface QueueSourceSnapshot {
  kind: QueueSourceKind;
  id?: string;
  name: string;
  state: MetadataState;
}

export interface QueueTickPlan {
  runId: string;
  tickIndex: number;
  source: QueueSourceSnapshot;
  state: MetadataState;
  seedRule: SeedRule;
  scheduledAt: number;
  displayLabel: string;
  nextQueueCursor: number;
}

export interface QueuePreflightWarning {
  code:
    | "HIGH_STEP_COUNT"
    | "LARGE_RESOLUTION"
    | "LONG_TARGET_COUNT"
    | "SHORT_INTERVAL"
    | "EMPTY_PRESET_QUEUE";
  severity: QueuePreflightSeverity;
  message: string;
  hint: string;
  sourceName?: string;
}

export interface QueueRunLogEntry {
  timestamp: number;
  runId: string;
  tickIndex?: number;
  phase?: ApplyPipelinePhase | QueueSessionStatus;
  sourceName?: string;
  errorCode?: ApplyAutomationErrorCode | "QUEUE_PLANNING_FAILED";
  message: string;
}

export interface QueueFailure {
  code: ApplyAutomationErrorCode | "QUEUE_PLANNING_FAILED";
  message: string;
  detail?: string;
  sourceName?: string;
  tickIndex?: number;
}

export interface QueueSession {
  runId: string;
  status: QueueSessionStatus;
  currentIndex: number;
  completedCount: number;
  targetCount: number;
  startedAt: number;
  updatedAt: number;
  lastError?: QueueFailure;
  lastAppliedSeed?: number;
  currentPlan?: QueueTickPlan;
  log: QueueRunLogEntry[];
}

export type QueueTickResult =
  | {
      status: "success";
      plan: QueueTickPlan;
      applyResult: ApplyPipelineResult;
    }
  | {
      status: "failed";
      plan?: QueueTickPlan;
      failure: QueueFailure;
    }
  | {
      status: "stopped";
      plan?: QueueTickPlan;
    };
