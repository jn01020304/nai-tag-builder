import assert from 'node:assert';
import {
  startQueueSession,
  markQueueWaiting,
  markQueueApplying,
  markQueueGenerating,
  markQueueTickSuccess,
  markQueueTickFailure,
  markQueueStopped,
} from '../../src/queue/queueSession';
import type { QueueDraft, QueueTickPlan, QueueFailure } from '../../src/queue/queueTypes';
import type { ApplyPipelineResult } from '../../src/automation/applyPipeline';
import type { MetadataState } from '../../src/types/metadata';

function createDummyState(): MetadataState {
  return {
    prompt: { basePrompt: '', negativeBase: '', characters: [], negativeCharacters: [] },
    params: { width: 512, height: 512, scale: 5, sampler: 'k_euler_ancestral', steps: 28, seed: 0 },
    advanced: { qualityToggle: true, ucPreset: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, controlnet_strength: 1, legacy: false, add_original_image: false, uncond_scale: 1, cfg_rescale: 0, noise_schedule: 'native', legacy_v3_extend: false, skip_cfg_above_sigma: null },
    useCoords: false,
    useOrder: false,
    source: 'tests',
  } satisfies MetadataState;
}

function runTests() {
  console.log('Running Queue Session Tests...');

  const draft: QueueDraft = {
    targetCount: 3,
    intervalSec: 10,
    seedRule: 'random',
    queueMode: 'batched',
    runsPerPreset: 1,
    stopOnFailure: true,
  };

  const state = createDummyState();
  const plan: QueueTickPlan = {
    runId: 'test-run-id',
    tickIndex: 0,
    source: { kind: 'preset', id: 'p1', name: 'Preset 1', state },
    state,
    seedRule: 'random',
    sourceIterationIndex: 0,
    scheduledAt: 1000,
    displayLabel: 'Test',
    nextQueueCursor: 1,
  };

  const applyResult = {
    success: true,
    plan: {
      seed: { isRandom: true, appliedSeed: 12345 },
      prompts: { base: '', negative: '' },
      params: state.params,
      advanced: state.advanced,
    },
    timings: {},
    effect: { status: 'applied', message: 'test', detail: undefined },
  } satisfies ApplyPipelineResult;

  // 1. startQueueSession 테스트
  let session = startQueueSession(draft, 100);
  assert.strictEqual(session.status, 'starting');
  assert.strictEqual(session.targetCount, 3);
  assert.strictEqual(session.completedCount, 0);
  assert.strictEqual(session.currentIndex, 0);
  assert.strictEqual(session.log[0].phase, 'starting');

  // runId 덮어쓰기
  session.runId = 'test-run-id';

  // 2. markQueueWaiting 테스트
  session = markQueueWaiting(session, plan, 200);
  assert.strictEqual(session.status, 'waiting');
  assert.strictEqual(session.currentPlan, plan);
  assert.strictEqual(session.log[session.log.length - 1].phase, 'waiting');

  // 3. markQueueApplying / Generating 테스트
  session = markQueueApplying(session, plan, 300);
  assert.strictEqual(session.status, 'applying');
  assert.strictEqual(session.log[session.log.length - 1].phase, 'applying');

  session = markQueueGenerating(session, plan, 400);
  assert.strictEqual(session.status, 'generating');
  assert.strictEqual(session.log[session.log.length - 1].phase, 'generating');

  // 4. markQueueTickSuccess 테스트 (Cooldown)
  session = markQueueTickSuccess(session, plan, applyResult, 500);
  assert.strictEqual(session.status, 'cooldown', 'Should go to cooldown because completedCount < targetCount');
  assert.strictEqual(session.completedCount, 1);
  assert.strictEqual(session.currentIndex, 1);
  assert.strictEqual(session.lastAppliedSeed, 12345);
  assert.strictEqual(session.log[session.log.length - 1].phase, 'cooldown');

  // 5. markQueueTickFailure 테스트
  const plan2 = { ...plan, tickIndex: 1 };
  session = markQueueWaiting(session, plan2, 600);
  const failure: QueueFailure = {
    code: 'TEST_ERROR',
    message: 'Test failed',
    hint: 'Try again',
    severity: 'error',
    tickIndex: 1,
    sourceName: 'Preset 1',
  };
  session = markQueueTickFailure(session, failure, 700);
  assert.strictEqual(session.status, 'failed');
  assert.strictEqual(session.lastError, failure);
  assert.strictEqual(session.log[session.log.length - 1].phase, 'failed');
  assert.strictEqual(session.log[session.log.length - 1].errorCode, 'TEST_ERROR');

  // 6. markQueueStopped 테스트
  session = startQueueSession(draft, 800);
  session = markQueueApplying(session, plan, 900);
  session = markQueueStopped(session, 1000);
  assert.strictEqual(session.status, 'stopped');
  assert.strictEqual(session.log[session.log.length - 1].phase, 'stopped');

  // 7. markQueueTickSuccess 테스트 (Completion)
  session = startQueueSession({ ...draft, targetCount: 1 }, 1100);
  session = markQueueApplying(session, plan, 1200);
  session = markQueueTickSuccess(session, plan, applyResult, 1300);
  assert.strictEqual(session.status, 'completed', 'Should go to completed because completedCount >= targetCount');
  assert.strictEqual(session.completedCount, 1);

  console.log('Queue Session Tests passed!');
}

runTests();
