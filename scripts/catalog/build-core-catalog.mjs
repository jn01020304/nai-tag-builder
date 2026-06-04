#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCT_CATEGORIES = new Set([
  "headcount",
  "background",
  "framing",
  "pose",
  "expression",
  "appearance",
  "outfit",
  "style_quality",
  "negative_safety",
  "character_scope",
  "utility",
]);

const CATEGORY_DEFAULT_TARGET = {
  headcount: "prompt",
  background: "prompt",
  framing: "prompt",
  pose: "prompt",
  expression: "prompt",
  appearance: "prompt",
  outfit: "prompt",
  style_quality: "prompt",
  negative_safety: "negative",
  character_scope: "character",
  utility: "any",
};

const SOURCE_PATH_FALLBACK = "D:/Downloads/danbooru_tag_dataset_20250703/tags.json";
const DEFAULT_MAX_CANDIDATES_PER_CATEGORY = 80;
const DEFAULT_VISIBLE_PER_CATEGORY = 16;

const CATEGORY_RULES = [
  {
    category: "headcount",
    minor: [/headcount/i, /relationship/i],
    tag: [
      /^\d+\s*(girls?|boys?)$/,
      /^multiple\s+(girls?|boys?)$/,
      /^solo$/,
      /^solo focus$/,
      /^group$/,
    ],
  },
  {
    category: "background",
    major: [/background/i],
    minor: [/background/i, /location/i, /environment/i],
    tag: [
      /background/,
      /^indoors?$/,
      /^outdoors?$/,
      /classroom/,
      /bedroom/,
      /sky/,
      /room$/,
      /street/,
      /forest/,
      /city/,
      /beach/,
    ],
  },
  {
    category: "framing",
    major: [/image composition/i],
    minor: [/composition/i, /view/i, /perspective/i],
    tag: [
      /looking at/,
      /looking away/,
      /shot$/,
      /body$/,
      /^close-up$/,
      /^from /,
      /view$/,
      /profile/,
    ],
  },
  {
    category: "pose",
    major: [/pose/i],
    minor: [/pose/i, /posture/i],
    tag: [
      /^standing$/,
      /^sitting$/,
      /^lying$/,
      /^kneeling$/,
      /^arms? /,
      /^hands? /,
      /pose$/,
      /on hip/,
    ],
  },
  {
    category: "expression",
    minor: [/expression/i, /emotion/i],
    tag: [
      /smile/,
      /mouth/,
      /blush/,
      /crying/,
      /angry/,
      /serious/,
      /sad/,
      /happy/,
      /expression/,
    ],
  },
  {
    category: "appearance",
    major: [/character/i],
    minor: [/hair/i, /eyes/i, /species/i, /traits/i],
    tag: [
      /hair/,
      /eyes/,
      /twintails/,
      /ponytail/,
      /bangs/,
      /skin/,
      /tail$/,
      /ears$/,
    ],
  },
  {
    category: "outfit",
    major: [/clothing/i],
    minor: [/costume/i, /topwear/i, /headwear/i, /accessories/i],
    tag: [
      /uniform/,
      /dress/,
      /shirt/,
      /skirt/,
      /jacket/,
      /hat$/,
      /shoes/,
      /socks/,
      /gloves/,
      /ribbon/,
    ],
  },
  {
    category: "style_quality",
    major: [/image composition/i],
    minor: [/quality/i, /resolution/i, /style/i],
    tag: [
      /quality/,
      /^highres$/,
      /masterpiece/,
      /detailed/,
      /resolution/,
      /aesthetic/,
    ],
  },
  {
    category: "negative_safety",
    tag: [
      /^lowres$/,
      /bad anatomy/,
      /bad hands/,
      /^text$/,
      /watermark/,
      /blurry/,
      /jpeg artifacts/,
    ],
  },
];

const EXCLUDED_MAJOR = new Set(["Source and Artist", "Adult Content"]);
const EXCLUDED_MINOR = new Set(["Artist", "Series"]);

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
    } else {
      args.set(key, next);
      i++;
    }
  }
  return args;
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function normalizeTag(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stableId(tag) {
  return `tag_${tag.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function getNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matchesAny(value, patterns = []) {
  return patterns.some((pattern) => pattern.test(value));
}

function readJsonSafe(text, filename) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON parse failed: ${filename}: ${error.message}`);
  }
}

function classifySource(entry) {
  const tag = entry.tag;
  const major = entry.sourceMajorCategory;
  const minor = entry.sourceMinorCategory;
  const matches = [];

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    const reasons = [];
    if (matchesAny(major, rule.major)) {
      score += 2;
      reasons.push("major");
    }
    if (matchesAny(minor, rule.minor)) {
      score += 3;
      reasons.push("minor");
    }
    if (matchesAny(tag, rule.tag)) {
      score += 4;
      reasons.push("tag");
    }
    if (score > 0) {
      matches.push({ category: rule.category, score, reasons });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  if (matches.length === 0) {
    return {
      productCategory: "utility",
      reviewStatus: "needs_review",
      confidence: 0,
      reasons: ["fallback"],
    };
  }

  const top = matches[0];
  const second = matches[1];
  const needsReview = Boolean(second && top.score - second.score <= 1);

  return {
    productCategory: top.category,
    reviewStatus: needsReview ? "needs_review" : "candidate",
    confidence: top.score,
    reasons: top.reasons,
  };
}

function normalizeSourceEntries(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("Source tags JSON must be an array.");
  }

  const byTag = new Map();
  for (const item of raw) {
    const tag = normalizeTag(item.english_name);
    if (!tag) continue;
    const count = getNumber(item.count);
    const existing = byTag.get(tag);
    if (existing && existing.count >= count) continue;

    byTag.set(tag, {
      tag,
      label: tag,
      koreanLabel: String(item.korean_name ?? "").trim(),
      description: String(item.description ?? "").trim(),
      keyword: String(item.keyword ?? "").trim(),
      sourceMajorCategory: String(item.major_categories ?? "").trim(),
      sourceMinorCategory: String(item.minor_categories ?? "").trim(),
      count,
    });
  }

  return Array.from(byTag.values());
}

function shouldExcludeCandidate(entry, overrideAcceptedTags) {
  if (overrideAcceptedTags.has(entry.tag)) return false;
  if (EXCLUDED_MAJOR.has(entry.sourceMajorCategory)) return true;
  if (EXCLUDED_MINOR.has(entry.sourceMinorCategory)) return true;
  if (entry.count <= 0) return true;
  return false;
}

function loadOverrides(raw) {
  const accepted = Array.isArray(raw.accepted) ? raw.accepted : [];
  const rejected = Array.isArray(raw.rejected) ? raw.rejected : [];
  const aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
  const acceptedByTag = new Map();
  const rejectedTags = new Set();
  const aliasesByTag = new Map();

  for (const item of accepted) {
    const tag = normalizeTag(item.tag);
    if (!tag) continue;
    const productCategory = String(item.productCategory ?? "");
    if (!PRODUCT_CATEGORIES.has(productCategory)) {
      throw new Error(`Unknown productCategory for accepted tag "${tag}": ${productCategory}`);
    }
    acceptedByTag.set(tag, {
      tag,
      productCategory,
      priority: getNumber(item.priority),
      defaultVisible: item.defaultVisible !== false,
      target: item.target,
    });
  }

  for (const item of rejected) {
    const tag = normalizeTag(typeof item === "string" ? item : item.tag);
    if (tag) rejectedTags.add(tag);
  }

  for (const item of aliases) {
    const alias = normalizeTag(item.alias);
    const tag = normalizeTag(item.tag);
    if (!alias || !tag) continue;
    if (!aliasesByTag.has(tag)) aliasesByTag.set(tag, []);
    aliasesByTag.get(tag).push(alias);
  }

  return { acceptedByTag, rejectedTags, aliasesByTag };
}

function basePriority(entry) {
  return Math.round(Math.log10(Math.max(entry.count, 1)) * 10);
}

function makeCandidate(entry, classification, aliases = []) {
  const target = CATEGORY_DEFAULT_TARGET[classification.productCategory] ?? "any";
  return {
    id: stableId(entry.tag),
    tag: entry.tag,
    label: entry.label,
    koreanLabel: entry.koreanLabel,
    productCategory: classification.productCategory,
    sourceMajorCategory: entry.sourceMajorCategory,
    sourceMinorCategory: entry.sourceMinorCategory,
    count: entry.count,
    aliases,
    priority: basePriority(entry),
    defaultVisible: false,
    target,
    reviewStatus: classification.reviewStatus,
    confidence: classification.confidence,
    reasons: classification.reasons,
    keyword: entry.keyword,
    description: entry.description,
  };
}

function makeManualEntry(accepted, aliases = []) {
  const productCategory = accepted.productCategory;
  const target = accepted.target || CATEGORY_DEFAULT_TARGET[productCategory] || "any";
  return {
    id: stableId(accepted.tag),
    tag: accepted.tag,
    label: accepted.tag,
    koreanLabel: "",
    productCategory,
    sourceMajorCategory: "Manual",
    sourceMinorCategory: "Override",
    count: 0,
    aliases,
    priority: accepted.priority || 0,
    defaultVisible: accepted.defaultVisible,
    target,
    reviewStatus: "accepted",
    confidence: 100,
    reasons: ["manual_override_missing_source"],
    keyword: "",
    description: "",
  };
}

function applyOverrides(candidate, overrides) {
  const accepted = overrides.acceptedByTag.get(candidate.tag);
  if (accepted) {
    return {
      ...candidate,
      productCategory: accepted.productCategory,
      priority: accepted.priority || candidate.priority,
      defaultVisible: accepted.defaultVisible,
      target: accepted.target || CATEGORY_DEFAULT_TARGET[accepted.productCategory] || candidate.target,
      reviewStatus: "accepted",
      confidence: Math.max(candidate.confidence, 99),
      reasons: ["override"],
    };
  }

  if (overrides.rejectedTags.has(candidate.tag)) {
    return {
      ...candidate,
      reviewStatus: "rejected",
      reasons: [...candidate.reasons, "override_rejected"],
    };
  }

  return candidate;
}

function compactRuntimeEntry(candidate) {
  return {
    id: candidate.id,
    tag: candidate.tag,
    label: candidate.label,
    koreanLabel: candidate.koreanLabel,
    productCategory: candidate.productCategory,
    sourceMajorCategory: candidate.sourceMajorCategory,
    sourceMinorCategory: candidate.sourceMinorCategory,
    count: candidate.count,
    aliases: candidate.aliases,
    priority: candidate.priority,
    defaultVisible: candidate.defaultVisible,
    target: candidate.target,
    reviewStatus: "accepted",
  };
}

function sortCatalogEntries(a, b) {
  if (a.productCategory !== b.productCategory) {
    return a.productCategory.localeCompare(b.productCategory);
  }
  if (b.priority !== a.priority) return b.priority - a.priority;
  if (b.count !== a.count) return b.count - a.count;
  return a.tag.localeCompare(b.tag);
}

function limitCandidates(candidates, maxPerCategory) {
  const grouped = new Map();
  for (const candidate of candidates) {
    if (!grouped.has(candidate.productCategory)) {
      grouped.set(candidate.productCategory, []);
    }
    grouped.get(candidate.productCategory).push(candidate);
  }

  const result = [];
  for (const [category, items] of grouped.entries()) {
    items.sort(sortCatalogEntries);
    const accepted = items.filter((item) => item.reviewStatus === "accepted");
    const others = items.filter((item) => item.reviewStatus !== "accepted").slice(0, maxPerCategory);
    result.push(...accepted, ...others.map((item) => ({ ...item, productCategory: category })));
  }
  return result.sort(sortCatalogEntries);
}

function visibleCountByCategory(entries) {
  const counts = new Map();
  for (const entry of entries) {
    if (!entry.defaultVisible) continue;
    counts.set(entry.productCategory, (counts.get(entry.productCategory) ?? 0) + 1);
  }
  return counts;
}

function verifyRuntimeCatalog(entries, visibleLimit) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.tag)) {
      throw new Error(`Duplicate runtime catalog tag: ${entry.tag}`);
    }
    seen.add(entry.tag);
    if (!PRODUCT_CATEGORIES.has(entry.productCategory)) {
      throw new Error(`Unknown productCategory in runtime catalog: ${entry.productCategory}`);
    }
    if (entry.reviewStatus !== "accepted") {
      throw new Error(`Runtime catalog contains non-accepted entry: ${entry.tag}`);
    }
  }

  const visibleCounts = visibleCountByCategory(entries);
  for (const [category, count] of visibleCounts.entries()) {
    if (count > visibleLimit) {
      throw new Error(`Too many defaultVisible tags in ${category}: ${count} > ${visibleLimit}`);
    }
  }
}

function generatedTs(entries) {
  const json = JSON.stringify(entries, null, 2);
  return [
    "import type { CoreCatalogEntry } from \"./catalogTypes\";",
    "",
    `export const coreCatalog = ${json} as const satisfies readonly CoreCatalogEntry[];`,
    "",
    "export const coreCatalogGeneratedBy = \"scripts/catalog/build-core-catalog.mjs\";",
    "",
  ].join("\n");
}

async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const root = repoRoot();
  const args = parseArgs(process.argv.slice(2));
  const source = args.get("source") || process.env.DANBOORU_TAGS_JSON || SOURCE_PATH_FALLBACK;
  const overridePath = path.resolve(
    root,
    args.get("overrides") || "resource/catalog/overrides/core-catalog-overrides.json",
  );
  const candidatesPath = path.resolve(
    root,
    args.get("candidates") || "resource/catalog/generated/core-catalog-candidates.json",
  );
  const outputPath = path.resolve(
    root,
    args.get("output") || "src/prompt/catalog/coreCatalog.generated.ts",
  );
  const maxPerCategory = getNumber(
    args.get("max-candidates-per-category"),
    DEFAULT_MAX_CANDIDATES_PER_CATEGORY,
  );
  const visibleLimit = getNumber(
    args.get("default-visible-per-category"),
    DEFAULT_VISIBLE_PER_CATEGORY,
  );

  if (!existsSync(source)) {
    throw new Error(`Source tags JSON not found: ${source}`);
  }
  if (!existsSync(overridePath)) {
    throw new Error(`Override file not found: ${overridePath}`);
  }

  const [sourceRaw, overrideRaw] = await Promise.all([
    readFile(source, "utf8"),
    readFile(overridePath, "utf8"),
  ]);

  const sourceEntries = normalizeSourceEntries(readJsonSafe(sourceRaw, source));
  const overrides = loadOverrides(readJsonSafe(overrideRaw, overridePath));

  const candidates = [];
  const seenSourceTags = new Set();
  for (const entry of sourceEntries) {
    seenSourceTags.add(entry.tag);
    if (shouldExcludeCandidate(entry, overrides.acceptedByTag)) continue;
    const classification = classifySource(entry);
    const aliases = overrides.aliasesByTag.get(entry.tag) ?? [];
    const candidate = applyOverrides(makeCandidate(entry, classification, aliases), overrides);
    candidates.push(candidate);
  }

  for (const accepted of overrides.acceptedByTag.values()) {
    if (seenSourceTags.has(accepted.tag)) continue;
    const aliases = overrides.aliasesByTag.get(accepted.tag) ?? [];
    candidates.push(makeManualEntry(accepted, aliases));
  }

  const limitedCandidates = limitCandidates(candidates, maxPerCategory);
  const runtimeEntries = limitedCandidates
    .filter((item) => item.reviewStatus === "accepted")
    .map(compactRuntimeEntry)
    .sort(sortCatalogEntries);

  verifyRuntimeCatalog(runtimeEntries, visibleLimit);

  await writeJson(candidatesPath, {
    generatedAt: new Date().toISOString(),
    source,
    sourceCount: sourceEntries.length,
    candidates: limitedCandidates,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generatedTs(runtimeEntries), "utf8");

  const acceptedCount = runtimeEntries.length;
  const candidateCount = limitedCandidates.filter((item) => item.reviewStatus === "candidate").length;
  const reviewCount = limitedCandidates.filter((item) => item.reviewStatus === "needs_review").length;
  const rejectedCount = limitedCandidates.filter((item) => item.reviewStatus === "rejected").length;
  const visibleCount = runtimeEntries.filter((item) => item.defaultVisible).length;

  console.log(`source entries: ${sourceEntries.length}`);
  console.log(`candidate artifact: ${limitedCandidates.length}`);
  console.log(`accepted runtime entries: ${acceptedCount}`);
  console.log(`candidate: ${candidateCount}`);
  console.log(`needs_review: ${reviewCount}`);
  console.log(`rejected: ${rejectedCount}`);
  console.log(`defaultVisible runtime entries: ${visibleCount}`);
  console.log(`wrote ${path.relative(root, candidatesPath)}`);
  console.log(`wrote ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
