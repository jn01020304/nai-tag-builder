export function extractPngMetadata(buffer: ArrayBuffer): Record<string, string> {
    console.log('[PNG-DEBUG] extractPngMetadata called, buffer size:', buffer.byteLength);
    const dataView = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < signature.length; i++) {
        if (uint8View[i] !== signature[i]) {
            console.warn("Invalid PNG file or signature mismatch.");
            return {};
        }
    }

    const metadata: Record<string, string> = {};
    let offset = 8;
    const length = uint8View.length;
    const textDecoder = new TextDecoder();

    while (offset < length) {
        if (offset + 8 > length) break;

        // Chunk length (4 bytes)
        const chunkLength = dataView.getUint32(offset);
        offset += 4;

        // Chunk type (4 bytes)
        const typeString = String.fromCharCode(
            uint8View[offset],
            uint8View[offset + 1],
            uint8View[offset + 2],
            uint8View[offset + 3]
        );
        offset += 4;

        // Chunk data
        console.log('[PNG-DEBUG] Chunk:', typeString, 'length:', chunkLength);
        if (typeString === 'tEXt') {
            let keyword = '';
            let textStart = offset;

            // Read until null byte or end of chunk
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
                console.log('[PNG-DEBUG] Found tEXt key:', keyword, 'value length:', text.length);
            }
        }

        // Move past the data block and 4 bytes CRC
        offset += chunkLength + 4;
    }

    return metadata;
}

export function parseNovelAIPng(buffer: ArrayBuffer): { data: any, source?: string } | null {
    try {
        const meta = extractPngMetadata(buffer);
        console.log('[PNG-DEBUG] All extracted metadata keys:', Object.keys(meta));

        // NovelAI stores JSON payload in the "Comment" tEXt chunk
        if (meta['Comment']) {
            const data = JSON.parse(meta['Comment']);
            console.log('[PNG-DEBUG] Comment JSON keys:', Object.keys(data));
            console.log('[PNG-DEBUG] has prompt:', !!data.prompt, 'has v4_prompt:', !!data.v4_prompt);
            console.log('[PNG-DEBUG] Source chunk:', meta['Source']);
            console.log('[PNG-DEBUG] Description chunk:', meta['Description']?.substring(0, 100));

            // Fallback for missing prompt if stored in Description chunk
            if (!data.prompt && !data.v4_prompt && meta['Description']) {
                console.log('[PNG-DEBUG] Using Description fallback for prompt');
                data.prompt = meta['Description'];
            }

            return {
                data,
                source: meta['Source']
            };
        }

        console.warn("[PNG-DEBUG] No 'Comment' chunk found in PNG metadata.", Object.keys(meta));
        return null;
    } catch (e) {
        console.error("[PNG-DEBUG] Failed to parse NovelAI PNG metadata:", e);
        return null;
    }
}
