import type { CommentJson, MetadataState } from '../types/metadata';
import { buildCommentJson } from '../model/buildCommentJson';
import { generatePngWithMetadata } from '../encoding/pngEncoder';
import { applyMetadataToNovelAi } from './novelAiAdapter';
import type { ApplyAutomationPhaseEvent, ApplyAutomationResult } from './automationTypes';

export interface ApplyPipelineOptions {
  state: MetadataState;
  autoGenerate?: boolean;
  signal?: AbortSignal;
  onPhase?: (event: ApplyPipelinePhaseEvent) => void;
}

export type ApplyPipelinePhase =
  | 'planning'
  | 'encoding-png'
  | ApplyAutomationPhaseEvent['phase'];

export interface ApplyPipelinePhaseEvent {
  phase: ApplyPipelinePhase;
  message: string;
  detail?: string;
}

export interface SeedPlan {
  requestedSeed: number;
  appliedSeed: number;
  seedWasRandomized: boolean;
}

export interface ApplyPlan {
  requestedState: MetadataState;
  appliedState: MetadataState;
  comment: CommentJson;
  source?: string;
  autoGenerate: boolean;
  seed: SeedPlan;
}

export interface EncodedApplyPayload {
  plan: ApplyPlan;
  blob: Blob;
}

export interface ApplyPipelineResult extends EncodedApplyPayload {
  effect: ApplyAutomationResult;
}

const MAX_SEED = 4294967295;

export function createRandomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED) + 1;
}

export function planSeed(requestedSeed: number): SeedPlan {
  const seedWasRandomized = requestedSeed === 0;
  return {
    requestedSeed,
    appliedSeed: seedWasRandomized ? createRandomSeed() : requestedSeed,
    seedWasRandomized,
  };
}

function applyPlannedSeed(state: MetadataState, seed: SeedPlan): MetadataState {
  if (!seed.seedWasRandomized) return state;

  return {
    ...state,
    params: {
      ...state.params,
      seed: seed.appliedSeed,
    },
  };
}

export function planApply({ state, autoGenerate = false }: ApplyPipelineOptions): ApplyPlan {
  const seed = planSeed(state.params.seed);
  const appliedState = applyPlannedSeed(state, seed);

  return {
    requestedState: state,
    appliedState,
    comment: buildCommentJson(appliedState),
    source: appliedState.source,
    autoGenerate,
    seed,
  };
}

export async function encodeApplyPlan(plan: ApplyPlan): Promise<EncodedApplyPayload> {
  return {
    plan,
    blob: await generatePngWithMetadata(plan.comment, plan.source),
  };
}

export async function runApplyEffect(
  payload: EncodedApplyPayload,
  options: Pick<ApplyPipelineOptions, 'signal' | 'onPhase'> = {},
): Promise<ApplyAutomationResult> {
  return applyMetadataToNovelAi(payload.blob, {
    mode: payload.plan.autoGenerate ? 'import-and-generate' : 'import-only',
    signal: options.signal,
    onPhase: options.onPhase,
  });
}

export async function runApplyPipeline(options: ApplyPipelineOptions): Promise<ApplyPipelineResult> {
  options.onPhase?.({ phase: 'planning', message: 'NovelAI 메타데이터를 준비하는 중' });
  const plan = planApply(options);
  options.onPhase?.({ phase: 'encoding-png', message: 'NovelAI 호환 PNG 메타데이터를 생성하는 중' });
  const payload = await encodeApplyPlan(plan);
  const effect = await runApplyEffect(payload, options);
  return { ...payload, effect };
}
