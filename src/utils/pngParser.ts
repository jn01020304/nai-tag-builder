import type { MetadataState } from '../types/metadata';
import { translateNovelAiMetadata } from './metadataTranslator';
import { decodeStealthMetadataFromImage } from './stealthLsbDecoder';
import { inflate } from 'pako';

export type ImageMetadataSource = 'png-text' | 'png-itxt' | 'png-ztxt' | 'stealth-lsb';

export interface ParsedImageMetadata {
    data: unknown;
    source?: string;
    extraction: ImageMetadataSource;
}

export interface ImageImportPatch {
    fileName: string;
    metadata: ParsedImageMetadata;
    state: MetadataState;
}

export interface BatchImageImportResult {
    patches: ImageImportPatch[];
    mergedState: MetadataState | null;
    failedFiles: string[];
}

export function extractPngMetadata(buffer: ArrayBuffer): Record<string, string> {
    const dataView = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < signature.length; i++) {
        if (uint8View[i] !== signature[i]) return {};
    }

    const metadata: Record<string, string> = {};
    let offset = 8;
    const length = uint8View.length;
    const textDecoder = new TextDecoder();

    while (offset < length) {
        if (offset + 8 > length) break;

        const chunkLength = dataView.getUint32(offset);
        offset += 4;

        const typeString = String.fromCharCode(
            uint8View[offset],
            uint8View[offset + 1],
            uint8View[offset + 2],
            uint8View[offset + 3]
        );
        offset += 4;

        if (typeString === 'tEXt' || typeString === 'zTXt' || typeString === 'iTXt') {
            const parsed = parseTextChunk(typeString, uint8View.slice(offset, offset + chunkLength), textDecoder);
            if (parsed) {
                metadata[parsed.keyword] = parsed.text;
            }
        }

        offset += chunkLength + 4;
    }

    return metadata;
}

function readNullTerminated(bytes: Uint8Array, start: number, decoder: TextDecoder): { value: string; next: number } | null {
    const end = bytes.indexOf(0, start);
    if (end < 0) return null;
    return {
        value: decoder.decode(bytes.slice(start, end)),
        next: end + 1,
    };
}

function parseTextChunk(
    type: string,
    bytes: Uint8Array,
    decoder: TextDecoder,
): { keyword: string; text: string } | null {
    const keyword = readNullTerminated(bytes, 0, decoder);
    if (!keyword?.value) return null;

    if (type === 'tEXt') {
        return {
            keyword: keyword.value,
            text: decoder.decode(bytes.slice(keyword.next)),
        };
    }

    if (type === 'zTXt') {
        const compressionMethod = bytes[keyword.next];
        if (compressionMethod !== 0) return null;
        return {
            keyword: keyword.value,
            text: decoder.decode(inflate(bytes.slice(keyword.next + 1))),
        };
    }

    const compressionFlag = bytes[keyword.next];
    const compressionMethod = bytes[keyword.next + 1];
    const language = readNullTerminated(bytes, keyword.next + 2, decoder);
    if (!language) return null;
    const translated = readNullTerminated(bytes, language.next, decoder);
    if (!translated) return null;
    const textBytes = bytes.slice(translated.next);
    if (compressionFlag === 1) {
        if (compressionMethod !== 0) return null;
        return {
            keyword: keyword.value,
            text: decoder.decode(inflate(textBytes)),
        };
    }

    return {
        keyword: keyword.value,
        text: decoder.decode(textBytes),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeNovelAiMetadata(raw: unknown, extraction: ImageMetadataSource): ParsedImageMetadata | null {
    if (!isRecord(raw)) {
        return { data: raw, extraction };
    }

    const source = typeof raw['Source'] === 'string'
        ? raw['Source']
        : typeof raw['source'] === 'string'
            ? raw['source']
            : undefined;
    const comment = raw['Comment'];

    if (typeof comment === 'string') {
        try {
            const data: unknown = JSON.parse(comment);
            if (isRecord(data) && !data.prompt && !data.v4_prompt && typeof raw['Description'] === 'string') {
                data.prompt = raw['Description'];
            }
            return { data, source, extraction };
        } catch {
            return null;
        }
    }

    if (isRecord(comment)) {
        if (!comment.prompt && !comment.v4_prompt && typeof raw['Description'] === 'string') {
            comment.prompt = raw['Description'];
        }
        return { data: comment, source, extraction };
    }

    if (!raw.prompt && !raw.v4_prompt && typeof raw['Description'] === 'string') {
        raw.prompt = raw['Description'];
    }

    return { data: raw, source, extraction };
}

export function parseNovelAIPng(buffer: ArrayBuffer): { data: unknown, source?: string } | null {
    try {
        const meta = extractPngMetadata(buffer);

        if (meta['Comment']) {
            const normalized = normalizeNovelAiMetadata({
                Comment: meta['Comment'],
                Description: meta['Description'],
                Source: meta['Source'],
            }, 'png-text');

            return normalized ? { data: normalized.data, source: normalized.source } : null;
        }

        return null;
    } catch (e) {
        console.error("Failed to parse NovelAI PNG metadata:", e);
        return null;
    }
}

export async function parseNovelAIImage(file: Blob): Promise<ParsedImageMetadata | null> {
    const buffer = await file.arrayBuffer();
    const meta = extractPngMetadata(buffer);

    if (meta['Comment']) {
        const normalized = normalizeNovelAiMetadata({
            Comment: meta['Comment'],
            Description: meta['Description'],
            Source: meta['Source'],
        }, 'png-text');
        if (normalized) return normalized;
    }

    const stealth = await decodeStealthMetadataFromImage(file);
    if (stealth) {
        return normalizeNovelAiMetadata(stealth, 'stealth-lsb');
    }

    return null;
}

function cloneStateWithNewCharacterIds(state: MetadataState, fileIndex: number): MetadataState {
    return {
        ...state,
        prompt: {
            ...state.prompt,
            characters: state.prompt.characters.map((character, index) => ({
                ...character,
                id: `batch_${fileIndex}_char_${index}_${Date.now()}`,
            })),
            negativeCharacters: state.prompt.negativeCharacters.map((character, index) => ({
                ...character,
                id: `batch_${fileIndex}_neg_${index}_${Date.now()}`,
            })),
        },
    };
}

function mergeImportedStates(states: MetadataState[]): MetadataState | null {
    if (states.length === 0) return null;

    const [first, ...rest] = states;
    return {
        ...first,
        prompt: {
            ...first.prompt,
            characters: states.flatMap((state) => state.prompt.characters),
            negativeCharacters: states.flatMap((state) => state.prompt.negativeCharacters),
            basePrompt: first.prompt.basePrompt || rest.find((state) => state.prompt.basePrompt)?.prompt.basePrompt || '',
            negativeBase: first.prompt.negativeBase || rest.find((state) => state.prompt.negativeBase)?.prompt.negativeBase || '',
        },
    };
}

export async function parseNovelAIImageFiles(files: readonly File[]): Promise<BatchImageImportResult> {
    const patches: ImageImportPatch[] = [];
    const failedFiles: string[] = [];

    for (const [index, file] of files.entries()) {
        const metadata = await parseNovelAIImage(file);
        if (!metadata) {
            failedFiles.push(file.name);
            continue;
        }

        patches.push({
            fileName: file.name,
            metadata,
            state: cloneStateWithNewCharacterIds(translateNovelAiMetadata(metadata.data, metadata.source), index),
        });
    }

    return {
        patches,
        failedFiles,
        mergedState: mergeImportedStates(patches.map((patch) => patch.state)),
    };
}
