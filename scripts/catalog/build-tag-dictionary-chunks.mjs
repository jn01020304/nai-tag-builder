#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const SOURCE_PATH_FALLBACK = "D:/Downloads/danbooru_tag_dataset_20250703/tags.json";
const DEFAULT_OUTPUT_DIR = "resource/catalog/generated/tag-dictionary";

const SOURCE_AND_ARTIST_CATEGORY_BY_MINOR = new Map([
  ["Character", "Character Names"],
  ["Artist", "Artist"],
  ["Series", "Series"],
  ["Other", "Series"],
]);

const SPLIT_MAJOR_BY_MINOR = new Set([
  "Adult Content",
  "Character",
  "Clothing and Accessories",
  "Image Composition",
  "Objects",
  "Source and Artist",
]);

const GROUP_ORDER = [
  "Action",
  "Adult Content",
  "Backgrounds",
  "Character",
  "Clothing and Accessories",
  "Concepts & Themes",
  "Image Composition",
  "Objects",
  "Other",
  "Pose",
  "Names and Sources",
];

const CATEGORY_ORDER_BY_GROUP = {
  "Adult Content": [
    "Acts",
    "Fetishes",
    "Body",
    "Exposure",
    "Fluids",
    "Clothing & Accessories",
    "Status & Mood & Sentiment",
    "Violence",
    "Poses",
    "Sex Toys",
    "Creature",
    "Other",
  ],
  Character: [
    "Headcount & Relationship",
    "Hairstyle & Color",
    "Eye Traits",
    "Body Parts",
    "Physical Traits",
    "Species & Traits",
    "Body State & Modification",
    "State & Emotion",
    "Other",
  ],
  "Clothing and Accessories": [
    "Costume",
    "Shirts and Topwear",
    "Pants and Bottomwear",
    "Dress",
    "Underwear & Hosiery",
    "Headwear and Headgear",
    "Footwear",
    "Accessories",
    "Style",
    "State",
    "Other",
  ],
  "Image Composition": [
    "Composition & Angle",
    "Focus",
    "Camera & Rendering Techniques",
    "Color & Tone",
    "Art Style",
    "Image Format",
    "In-World Effects & Elements",
    "Symbolic Representation",
    "Source Marking",
    "Quality & Resolution",
    "Other",
  ],
  "Objects": [
    "Tools & Devices",
    "Weapon",
    "Food & Drink",
    "Household Goods",
    "Furniture",
    "Vehicle",
    "Books & Documents",
    "Musical Instruments",
    "Natural Objects",
    "Toys & Dolls",
    "Clothing and Accessories",
    "Other",
  ],
  "Names and Sources": [
    "Character Names",
    "Artist",
    "Series",
  ],
};

const AUTOCOMPLETE_CATEGORIES = new Set([
  "Character Names",
  "Artist",
  "Series",
]);

const REQUIRED_FIELDS = [
  "english_name",
  "korean_name",
  "description",
  "keyword",
  "major_categories",
  "minor_categories",
  "count",
];

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

function readJsonSafe(text, filename) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON parse failed: ${filename}: ${error.message}`);
  }
}

function getString(value) {
  return String(value ?? "").trim();
}

function getNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertSourceSchema(items) {
  if (!Array.isArray(items)) {
    throw new Error("Source tags JSON must be an array.");
  }

  const missing = [];
  for (const [index, item] of items.entries()) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in item)) {
        missing.push(`${index}.${field}`);
        if (missing.length >= 10) break;
      }
    }
    if (missing.length >= 10) break;
  }

  if (missing.length > 0) {
    throw new Error(`Source tags JSON is missing required fields: ${missing.join(", ")}`);
  }
}

function getDictionaryCategory(item) {
  const major = getString(item.major_categories);
  const minor = getString(item.minor_categories);

  if (!SPLIT_MAJOR_BY_MINOR.has(major)) {
    return {
      groupLabel: major,
      categoryLabel: major,
      mode: "select",
    };
  }

  if (major === "Source and Artist") {
    const categoryLabel = SOURCE_AND_ARTIST_CATEGORY_BY_MINOR.get(minor) ?? "Series";
    return {
      groupLabel: "Names and Sources",
      categoryLabel,
      mode: "autocomplete",
    };
  }

  return {
    groupLabel: major,
    categoryLabel: minor || "Other",
    mode: getCategoryMode(major, minor),
  };
}

function getCategoryMode(major, minor) {
  if (major === "Adult Content") return "sensitive-select";
  return "select";
}

function normalizeDictionaryEntry(item) {
  return {
    english_name: getString(item.english_name),
    korean_name: getString(item.korean_name),
    description: getString(item.description),
    keyword: getString(item.keyword),
    count: getNumber(item.count),
  };
}

function sortEntries(a, b) {
  if (b.count !== a.count) return b.count - a.count;
  return a.english_name.localeCompare(b.english_name);
}

function orderIndex(items, value) {
  const index = items.indexOf(value);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function categorySortKey(category) {
  const groupIndex = orderIndex(GROUP_ORDER, category.groupLabel);
  const categoryOrder = CATEGORY_ORDER_BY_GROUP[category.groupLabel] ?? [];
  const categoryIndex = orderIndex(categoryOrder, category.label);
  return {
    groupIndex,
    categoryIndex,
    groupLabel: category.groupLabel,
    label: category.label,
  };
}

function sortCategories(a, b) {
  const ak = categorySortKey(a);
  const bk = categorySortKey(b);
  if (ak.groupIndex !== bk.groupIndex) return ak.groupIndex - bk.groupIndex;
  if (ak.categoryIndex !== bk.categoryIndex) return ak.categoryIndex - bk.categoryIndex;
  if (ak.groupLabel !== bk.groupLabel) return ak.groupLabel.localeCompare(bk.groupLabel);
  return ak.label.localeCompare(bk.label);
}

function byteSize(value) {
  return Buffer.byteLength(value, "utf8");
}

function gzipSize(value) {
  return gzipSync(Buffer.from(value)).length;
}

async function writeJson(filename, value, pretty = true) {
  await mkdir(path.dirname(filename), { recursive: true });
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  await writeFile(filename, `${json}\n`, "utf8");
  return {
    bytes: byteSize(json),
    gzipBytes: gzipSize(json),
  };
}

async function main() {
  const root = repoRoot();
  const args = parseArgs(process.argv.slice(2));
  const source = args.get("source") || process.env.DANBOORU_TAGS_JSON || SOURCE_PATH_FALLBACK;
  const outputDir = path.resolve(root, args.get("output") || DEFAULT_OUTPUT_DIR);

  if (!existsSync(source)) {
    throw new Error(`Source tags JSON not found: ${source}`);
  }

  const sourceRaw = await readFile(source, "utf8");
  const sourceItems = readJsonSafe(sourceRaw, source);
  assertSourceSchema(sourceItems);

  await rm(outputDir, { recursive: true, force: true });

  const groups = new Map();
  for (const item of sourceItems) {
    const category = getDictionaryCategory(item);
    if (!category.categoryLabel) continue;

    const entry = normalizeDictionaryEntry(item);
    if (!entry.english_name) continue;

    const groupId = slugify(category.groupLabel);
    const categoryId = AUTOCOMPLETE_CATEGORIES.has(category.categoryLabel)
      ? slugify(category.categoryLabel)
      : `${groupId}__${slugify(category.categoryLabel)}`;
    const key = `${groupId}/${categoryId}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id: categoryId,
        label: category.categoryLabel,
        groupId,
        groupLabel: category.groupLabel,
        mode: category.mode,
        entries: new Map(),
      });
    }

    const byEnglishName = groups.get(key).entries;
    const existing = byEnglishName.get(entry.english_name);
    if (!existing || entry.count > existing.count) {
      byEnglishName.set(entry.english_name, entry);
    }
  }

  const chunksDir = path.join(outputDir, "chunks");
  const categories = [];
  let totalEntries = 0;
  let totalBytes = 0;
  let totalGzipBytes = 0;

  for (const category of groups.values()) {
    const entries = Array.from(category.entries.values()).sort(sortEntries);
    const chunk = {
      id: category.id,
      label: category.label,
      groupId: category.groupId,
      groupLabel: category.groupLabel,
      mode: category.mode,
      count: entries.length,
      tags: entries,
    };
    const file = `chunks/${category.groupId}/${category.id}.json`;
    const sizes = await writeJson(path.join(outputDir, file), chunk, false);

    categories.push({
      id: category.id,
      label: category.label,
      groupId: category.groupId,
      groupLabel: category.groupLabel,
      mode: category.mode,
      count: entries.length,
      file,
      bytes: sizes.bytes,
      gzipBytes: sizes.gzipBytes,
    });

    totalEntries += entries.length;
    totalBytes += sizes.bytes;
    totalGzipBytes += sizes.gzipBytes;
  }

  categories.sort(sortCategories);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source,
    sourceCount: sourceItems.length,
    entryCount: totalEntries,
    categoryCount: categories.length,
    categoryRule:
      "minor_categories is used only at build time to split large major_categories into dictionary chunks.",
    categories,
  };
  const manifestSizes = await writeJson(path.join(outputDir, "manifest.json"), manifest);

  console.log(`source entries: ${sourceItems.length}`);
  console.log(`dictionary entries: ${totalEntries}`);
  console.log(`categories: ${categories.length}`);
  console.log(`chunks: ${path.relative(root, chunksDir)}`);
  console.log(`manifest: ${path.relative(root, path.join(outputDir, "manifest.json"))}`);
  console.log(`chunk bytes: ${Math.round(totalBytes / 1024)} KiB`);
  console.log(`chunk gzip bytes: ${Math.round(totalGzipBytes / 1024)} KiB`);
  console.log(`manifest bytes: ${manifestSizes.bytes}`);
  console.log(`manifest gzip bytes: ${manifestSizes.gzipBytes}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
