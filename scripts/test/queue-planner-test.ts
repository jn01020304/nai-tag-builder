import assert from 'node:assert';
import {
  createQueueDraft,
  planNextQueueTick,
} from '../../src/queue/queuePlanner';
import type { MetadataState } from '../../src/types/metadata';
import type { QueueSourceSnapshot, QueueDraft } from '../../src/queue/queueTypes';

// 테스트 헬퍼
function createDummyState(seed: number = 0) {
  return {
    prompt: { basePrompt: '', negativeBase: '', characters: [], negativeCharacters: [] },
    params: {
      width: 512, height: 512, scale: 5, sampler: 'k_euler_ancestral', steps: 28, seed,
    },
    advanced: {
      qualityToggle: true, ucPreset: 0, sm: false, sm_dyn: false, dynamic_thresholding: false, controlnet_strength: 1, legacy: false, add_original_image: false, uncond_scale: 1, cfg_rescale: 0, noise_schedule: 'native', legacy_v3_extend: false, skip_cfg_above_sigma: null,
    },
    useCoords: false,
    useOrder: false,
    source: 'tests',
  } satisfies MetadataState;
}

function createDummySource(id: string, seed: number = 0): QueueSourceSnapshot {
  return {
    kind: 'preset',
    id,
    name: `Preset ${id}`,
    state: createDummyState(seed),
  };
}

function runTests() {
  console.log('Running Queue Planner Tests...');

  // 1. Draft Normalization 테스트
  {
    const draft = createQueueDraft({
      targetCount: 'abc', // NaN -> fallback 1
      intervalSec: 'invalid', // NaN -> fallback 10
      runsPerPreset: -5, // < 1 -> min clamp 1
      seedRule: 'random',
      queueMode: 'batched',
    });
    assert.strictEqual(draft.targetCount, 1);
    assert.strictEqual(draft.intervalSec, 10);
    assert.strictEqual(draft.runsPerPreset, 1);
  }

  // 2. Batched Mode (`runsPerPreset`) 테스트
  {
    const draft: QueueDraft = {
      targetCount: 10, intervalSec: 10, seedRule: 'none', queueMode: 'batched', runsPerPreset: 2, stopOnFailure: true
    };
    const sources = [createDummySource('A'), createDummySource('B')];
    const runId = 'test-run';
    const state = createDummyState();

    // 틱 0: Source A (반복 0)
    const tick0 = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 0, queueCursor: 0, scheduledAt: 0 });
    assert(tick0 !== null);
    assert.strictEqual(tick0.source.name, 'Preset A');
    assert.strictEqual(tick0.nextQueueCursor, 0);
    assert.strictEqual(tick0.sourceIterationIndex, 0);

    // 틱 1: Source A (반복 1)
    const tick1 = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 1, queueCursor: tick0.nextQueueCursor, scheduledAt: 0 });
    assert(tick1 !== null);
    assert.strictEqual(tick1.source.name, 'Preset A');
    assert.strictEqual(tick1.nextQueueCursor, 0);
    assert.strictEqual(tick1.sourceIterationIndex, 1);

    // 틱 2: Source B (반복 0)
    const tick2 = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 2, queueCursor: tick1.nextQueueCursor, scheduledAt: 0 });
    assert(tick2 !== null);
    assert.strictEqual(tick2.source.name, 'Preset B');
    assert.strictEqual(tick2.nextQueueCursor, 1);
    assert.strictEqual(tick2.sourceIterationIndex, 0);
  }

  // 3. Randomized Mode 테스트
  {
    const draft: QueueDraft = {
      targetCount: 10, intervalSec: 10, seedRule: 'none', queueMode: 'randomized', runsPerPreset: 1, stopOnFailure: true
    };
    const sources = [createDummySource('A'), createDummySource('B'), createDummySource('C')];
    // random()이 0.9일 때 마지막 요소(C) 추출 확인
    const tick0 = planNextQueueTick({
      runId: 'test', draft, currentState: createDummyState(), queuedSources: sources, tickIndex: 0, queueCursor: 0, scheduledAt: 0,
      random: () => 0.9
    });
    assert(tick0 !== null);
    assert.strictEqual(tick0.source.name, 'Preset C');
  }

  // 4. Seed Rules 테스트
  {
    const sources = [createDummySource('A', 100)];
    const runId = 'test';
    const state = createDummyState(100);

    // seedRule: 'none'
    let draft = createQueueDraft({ targetCount: 1, intervalSec: 10, seedRule: 'none', queueMode: 'batched', runsPerPreset: 1 });
    let tick = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 0, queueCursor: 0, scheduledAt: 0 });
    assert.strictEqual(tick?.state.params.seed, 100);

    // seedRule: 'random'
    draft = createQueueDraft({ targetCount: 1, intervalSec: 10, seedRule: 'random', queueMode: 'batched', runsPerPreset: 1 });
    tick = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 0, queueCursor: 0, scheduledAt: 0, random: () => 0.5 });
    assert.strictEqual(tick?.state.params.seed, 2147483648);

    // seedRule: 'increment'
    draft = createQueueDraft({ targetCount: 2, intervalSec: 10, seedRule: 'increment', queueMode: 'batched', runsPerPreset: 2 });
    tick = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 1, queueCursor: 0, scheduledAt: 0 });
    assert.strictEqual(tick?.state.params.seed, 102);

    // seedRule: 'decrement'
    draft = createQueueDraft({ targetCount: 2, intervalSec: 10, seedRule: 'decrement', queueMode: 'batched', runsPerPreset: 2 });
    tick = planNextQueueTick({ runId, draft, currentState: state, queuedSources: sources, tickIndex: 1, queueCursor: 0, scheduledAt: 0 });
    assert.strictEqual(tick?.state.params.seed, 98);
  }

  // 5. Empty Queue Fallback 테스트
  {
    const draft = createQueueDraft({ targetCount: 1, intervalSec: 10, seedRule: 'none', queueMode: 'batched', runsPerPreset: 1 });
    const currentState = createDummyState(777);
    const tick = planNextQueueTick({ runId: 'test', draft, currentState, queuedSources: [], tickIndex: 0, queueCursor: 0, scheduledAt: 0 });
    assert(tick !== null);
    assert.strictEqual(tick.source.kind, 'current-state');
    assert.strictEqual(tick.state.params.seed, 777);
  }

  // 6. Termination 테스트 (targetCount 초과 시 null 반환)
  {
    const draft = createQueueDraft({ targetCount: 5, intervalSec: 10, seedRule: 'none', queueMode: 'batched', runsPerPreset: 1 });
    const tick = planNextQueueTick({ runId: 'test', draft, currentState: createDummyState(), queuedSources: [], tickIndex: 5, queueCursor: 0, scheduledAt: 0 });
    assert.strictEqual(tick, null);
  }

  console.log('Queue Planner Tests passed!');
}

runTests();
