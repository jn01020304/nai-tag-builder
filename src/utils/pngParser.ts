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

        if (typeString === 'tEXt') {
            let keyword = '';
            let textStart = offset;

            for (let i = offset; i < offset + chunkLength; i++) {
                if (uint8View[i] === 0) {
                    keyword = textDecoder.decode(uint8View.slice(offset, i));
                    textStart = i + 1;
                    break;
                }
            }

            if (keyword) {
                const text = textDecoder.decode(uint8View.slice(textStart, offset + chunkLength));
                metadata[keyword] = text;
            }
        }

        offset += chunkLength + 4;
    }

    return metadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function parseNovelAIPng(buffer: ArrayBuffer): { data: unknown, source?: string } | null {
    try {
        const meta = extractPngMetadata(buffer);

        if (meta['Comment']) {
            const data: unknown = JSON.parse(meta['Comment']);

            if (isRecord(data) && !data.prompt && !data.v4_prompt && meta['Description']) {
                data.prompt = meta['Description'];
            }

            return {
                data,
                source: meta['Source']
            };
        }

        return null;
    } catch (e) {
        console.error("Failed to parse NovelAI PNG metadata:", e);
        return null;
    }
}
