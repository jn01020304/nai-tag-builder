import type { MetadataState } from "../types/metadata";
import type { QueueMode, SeedRule } from "../types/preset";
import type {
  QueueDraft,
  QueuePreflightWarning,
  QueueSourceSnapshot,
  QueueTickPlan,
} from "./queueTypes";

const MAX_SEED = 4294967295;
const LARGE_PIXEL_COUNT = 1024 * 1024;
const HIGH_STEP_COUNT = 28;
const LONG_TARGET_COUNT = 50;
const SHORT_INTERVAL_SEC = 5;

export interface CreateQueueDraftInput {
  targetCount: number | string;
  intervalSec: number | string;
  seedRule: SeedRule;
  queueMode: QueueMode;
  hasPresetQueue: boolean;
}

export interface PlanNextQueueTickInput {
  runId: string;
  draft: QueueDraft;
  currentState: MetadataState;
  queuedSources: QueueSourceSnapshot[];
  tickIndex: number;
  queueCursor: number;
  scheduledAt: number;
  random?: () => number;
}

function normalizePositiveInt(value: number | string, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

function normalizePositiveNumber(value: number | string, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function createRandomSeed(random: () => number): number {
  return Math.floor(random() * MAX_SEED) + 1;
}

function cloneStateWithSeed(state: MetadataState, seed: number): MetadataState {
  return {
    ...state,
    params: {
      ...state.params,
      seed,
    },
  };
}

function applySeedRule(
  state: MetadataState,
  seedRule: SeedRule,
  tickIndex: number,
  random: () => number,
): MetadataState {
  const baseSeed = Number(state.params.seed) || 0;

  if (seedRule === "random") {
    return cloneStateWithSeed(state, createRandomSeed(random));
  }

  if (seedRule === "increment") {
    return cloneStateWithSeed(state, Math.min(MAX_SEED, Math.max(1, baseSeed) + tickIndex + 1));
  }

  if (seedRule === "decrement") {
    return cloneStateWithSeed(state, Math.max(0, baseSeed - tickIndex - 1));
  }

  return state;
}

function selectQueuedSource(
  mode: QueueMode,
  sources: QueueSourceSnapshot[],
  queueCursor: number,
  random: () => number,
): { source: QueueSourceSnapshot; nextQueueCursor: number } | null {
  if (sources.length === 0) return null;

  if (mode === "randomization") {
    const index = Math.floor(random() * sources.length);
    return {
      source: sources[index],
      nextQueueCursor: queueCursor,
    };
  }

  const index = queueCursor % sources.length;
  return {
    source: sources[index],
    nextQueueCursor: index + 1,
  };
}

export function createQueueDraft(input: CreateQueueDraftInput): QueueDraft {
  return {
    targetCount: normalizePositiveInt(input.targetCount, 1, 1),
    intervalSec: normalizePositiveNumber(input.intervalSec, 30, 3),
    seedRule: input.hasPresetQueue ? "none" : input.seedRule,
    queueMode: input.queueMode,
    stopOnFailure: true,
  };
}

export function createCurrentStateSource(state: MetadataState): QueueSourceSnapshot {
  return {
    kind: "current-state",
    name: "현재 프롬프트",
    state,
  };
}

export function planNextQueueTick(input: PlanNextQueueTickInput): QueueTickPlan | null {
  if (input.tickIndex >= input.draft.targetCount) return null;

  const random = input.random ?? Math.random;
  const queued = selectQueuedSource(
    input.draft.queueMode,
    input.queuedSources,
    input.queueCursor,
    random,
  );
  const source = queued?.source ?? createCurrentStateSource(input.currentState);
  const nextQueueCursor = queued?.nextQueueCursor ?? input.queueCursor;
  const state = applySeedRule(source.state, input.draft.seedRule, input.tickIndex, random);

  return {
    runId: input.runId,
    tickIndex: input.tickIndex,
    source,
    state,
    seedRule: input.draft.seedRule,
    scheduledAt: input.scheduledAt,
    displayLabel: `${source.name} · ${input.tickIndex + 1}/${input.draft.targetCount}`,
    nextQueueCursor,
  };
}

export function createQueuePreflightWarnings(
  draft: QueueDraft,
  sources: QueueSourceSnapshot[],
  fallbackSource?: QueueSourceSnapshot,
): QueuePreflightWarning[] {
  const warnings: QueuePreflightWarning[] = [];
  const inspectedSources = sources.length > 0 ? sources : (fallbackSource ? [fallbackSource] : []);

  if (draft.intervalSec < SHORT_INTERVAL_SEC) {
    warnings.push({
      code: "SHORT_INTERVAL",
      severity: "warning",
      message: "반복 간격이 매우 짧습니다.",
      hint: "NovelAI 화면 반응이 늦으면 Import 또는 Generate 대기 단계에서 실패할 수 있습니다.",
    });
  }

  if (draft.targetCount > LONG_TARGET_COUNT) {
    warnings.push({
      code: "LONG_TARGET_COUNT",
      severity: "info",
      message: "목표 생성 수가 많습니다.",
      hint: "모바일 세션에서는 중간에 Stop으로 끊을 수 있도록 상태 배너를 확인하세요.",
    });
  }

  if (sources.length === 0 && draft.queueMode === "randomization") {
    warnings.push({
      code: "EMPTY_PRESET_QUEUE",
      severity: "info",
      message: "프리셋 Queue가 없어 현재 프롬프트로 반복합니다.",
      hint: "Random Queue mode는 프리셋이 있을 때만 의미가 있습니다.",
    });
  }

  for (const source of inspectedSources) {
    if (source.state.params.steps > HIGH_STEP_COUNT) {
      warnings.push({
        code: "HIGH_STEP_COUNT",
        severity: "warning",
        message: "Steps가 기본 안전선보다 높습니다.",
        hint: "반복 생성 전에 Anlas 사용량과 대기 시간을 확인하세요.",
        sourceName: source.name,
      });
    }

    if (source.state.params.width * source.state.params.height > LARGE_PIXEL_COUNT) {
      warnings.push({
        code: "LARGE_RESOLUTION",
        severity: "warning",
        message: "해상도가 큰 프리셋이 Queue에 포함되어 있습니다.",
        hint: "모바일 자동화에서는 큰 해상도 작업이 실패나 긴 대기를 유발할 수 있습니다.",
        sourceName: source.name,
      });
    }
  }

  return warnings;
}
