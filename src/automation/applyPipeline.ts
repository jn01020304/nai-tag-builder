import type { CommentJson, MetadataState } from '../types/metadata';
import { buildCommentJson } from '../model/buildCommentJson';
import { generatePngWithMetadata } from '../encoding/pngEncoder';
import { dispatchPasteEvent } from '../encoding/pasteDispatch';
import type { PasteDispatchResult } from '../encoding/pasteDispatch';

export interface ApplyPipelineOptions {
  state: MetadataState;
  autoGenerate?: boolean;
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
  effect: PasteDispatchResult;
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

export async function runApplyEffect(payload: EncodedApplyPayload): Promise<PasteDispatchResult> {
  return dispatchPasteEvent(payload.blob, payload.plan.autoGenerate);
}

export async function runApplyPipeline(options: ApplyPipelineOptions): Promise<ApplyPipelineResult> {
  const plan = planApply(options);
  const payload = await encodeApplyPlan(plan);
  const effect = await runApplyEffect(payload);
  return { ...payload, effect };
}
