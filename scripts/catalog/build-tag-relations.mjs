#!/usr/bin/env node

// Builds the offline tag-relations recommendation asset.
// Input:  resource/catalog/sources/tag-relations.source.json  (LLM-generated seed -> related[] lists)
//         public/catalog/tag-dictionary/                       (for validity + korean/count enrichment)
// Output: public/catalog/tag-relations/relations.json          (committed, served at runtime)
//
// Each related tag is normalized, de-duplicated, dropped if it is the seed or not
// a real dictionary tag, then enriched with its canonical spelling, korean name,
// and danbooru count. Relation keys are NORMALIZED so they match the runtime
// lookup (normalizePromptToken in src/prompt/catalog/promptTagText.ts).

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(ROOT, "resource/catalog/sources/tag-relations.source.json");
const DICT_DIR = path.join(ROOT, "public/catalog/tag-dictionary");
const OUT = path.join(ROOT, "public/catalog/tag-relations/relations.json");

// MUST mirror normalizePromptToken in src/prompt/catalog/promptTagText.ts.
function normalizePromptToken(value) {
  return String(value ?? "")
    .trim()
    .replace(/^[-+]?\d+(?:\.\d+)?::/, "")
    .replace(/::$/, "")
    .replace(/^[{[(\s]+/, "")
    .replace(/[}\])\s]+$/, "")
    .replace(/^artist:/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function loadDictionaryIndex() {
  const manifest = JSON.parse(await readFile(path.join(DICT_DIR, "manifest.json"), "utf8"));
  const index = new Map(); // normalized -> { english_name, korean_name, count }
  for (const category of manifest.categories) {
    const chunk = JSON.parse(await readFile(path.join(DICT_DIR, category.file), "utf8"));
    for (const tag of chunk.tags) {
      const key = normalizePromptToken(tag.english_name);
      const existing = index.get(key);
      if (!existing || tag.count > existing.count) {
        index.set(key, { english_name: tag.english_name, korean_name: tag.korean_name, count: tag.count });
      }
    }
  }
  return index;
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`);
    process.exitCode = 1;
    return;
  }

  const source = JSON.parse(await readFile(SOURCE, "utf8"));
  const dict = await loadDictionaryIndex();

  const relations = {};
  let seedCount = 0;
  let keptRelated = 0;
  let droppedUnknown = 0;
  let droppedSeedMissing = 0;

  for (const { seed, related } of source) {
    const seedKey = normalizePromptToken(seed);
    if (!dict.has(seedKey)) {
      droppedSeedMissing += 1;
      continue;
    }

    const seen = new Set([seedKey]);
    const out = [];
    for (const candidate of related ?? []) {
      const key = normalizePromptToken(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = dict.get(key);
      if (!hit) {
        droppedUnknown += 1;
        continue;
      }
      out.push({ english_name: hit.english_name, korean_name: hit.korean_name, count: hit.count });
    }

    if (out.length > 0) {
      relations[seedKey] = out;
      seedCount += 1;
      keptRelated += out.length;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    seedCount,
    relations,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(payload);
  await writeFile(OUT, `${json}\n`, "utf8");

  console.log(`dictionary tags indexed: ${dict.size}`);
  console.log(`seeds in source: ${source.length}`);
  console.log(`seeds written: ${seedCount} (dropped, seed not in dictionary: ${droppedSeedMissing})`);
  console.log(`related kept: ${keptRelated} (dropped, not a dictionary tag: ${droppedUnknown})`);
  console.log(`avg related per seed: ${(keptRelated / seedCount).toFixed(1)}`);
  console.log(`output: ${path.relative(ROOT, OUT)} (${Math.round(Buffer.byteLength(json) / 1024)} KiB)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
