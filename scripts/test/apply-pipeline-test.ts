import assert from "node:assert";
import {
  planApply,
  planSeed,
} from "../../src/automation/applyPipeline";
import { DEFAULT_STATE } from "../../src/model/defaults";

function runTests() {
  console.log("Running Apply Pipeline Tests...");

  {
    const seed = planSeed(0);
    assert.strictEqual(seed.requestedSeed, 0);
    assert.strictEqual(seed.appliedSeed, 0);
    assert.strictEqual(seed.seedWasRandomized, false);
  }

  {
    const seed = planSeed(0, "randomize");
    assert(seed.appliedSeed > 0);
    assert.strictEqual(seed.seedWasRandomized, true);
  }

  {
    const state = structuredClone(DEFAULT_STATE);
    state.params.seed = 0;
    const plan = planApply({ state });

    assert.strictEqual(plan.appliedState.params.seed, 0);
    assert.strictEqual(plan.comment.seed, 0);
  }

  console.log("Apply Pipeline Tests passed!");
}

runTests();
