export interface TagDictionaryEntry {
  english_name: string;
  korean_name: string;
  description: string;
  keyword: string;
  count: number;
}

export interface TagDictionaryCategoryMeta {
  id: string;
  label: string;
  groupId: string;
  groupLabel: string;
  mode: "select" | "autocomplete" | "sensitive-select";
  count: number;
  file: string;
  bytes: number;
  gzipBytes: number;
}

export interface TagDictionaryManifest {
  generatedAt: string;
  source: string;
  sourceCount: number;
  entryCount: number;
  categoryCount: number;
  categories: TagDictionaryCategoryMeta[];
}

export interface TagDictionaryChunkData {
  id: string;
  label: string;
  groupId: string;
  groupLabel: string;
  mode: "select" | "autocomplete" | "sensitive-select";
  count: number;
  tags: TagDictionaryEntry[];
}
