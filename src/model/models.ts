export const KNOWN_MODELS = [
    {
        label: "Anime V4 Full",
        source: "NovelAI Diffusion V4.5 4BDE2A90",
        software: "NovelAI Diffusion V4.5"
    },
    {
        label: "Anime V4 Curated",
        source: "NovelAI Diffusion V4.5 C02D4F98",
        software: "NovelAI Diffusion V4.5"
    },
    {
        label: "Anime V3",
        source: "NovelAI Diffusion V3 Anime",
        software: "NovelAI Diffusion V3"
    },
    {
        label: "Furry V3",
        source: "NovelAI Diffusion V3 Furry",
        software: "NovelAI Diffusion V3"
    }
];

export function getModelBySource(source?: string) {
    if (!source) return undefined;
    return KNOWN_MODELS.find(m => m.source === source);
}
