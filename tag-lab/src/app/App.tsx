import { useMemo, useState } from "react";
import { CompositionPanel } from "../features/composition/CompositionPanel";
import { WeightFloor } from "../features/composition/WeightFloor";
import {
  createArtist,
  createChunk,
  flattenComposition,
  forkCompositionFromPrompt,
  serializeArtistPrompt,
  updateNodeWeight,
  type ChunkNode,
} from "../domain/composition";
import { Panel } from "../components/Panel";

const libraryComposition = createChunk(
  "prompt",
  "새벽의 잔광",
  [
    createArtist("artist-1", "ciloranko", 1.2),
    createChunk(
      "chunk-1",
      "선명한 색면",
      [
        createArtist("artist-2", "todoroki_masaru", 0.85),
        createArtist("artist-3", "ciloranko", 0.25),
      ],
      1.1,
    ),
    createArtist("artist-4", "toosaka_asagi", -0.2),
  ],
  1,
);

export default function App() {
  const [composition, setComposition] = useState<ChunkNode>(libraryComposition);
  const [promptDraft, setPromptDraft] = useState(() => serializeArtistPrompt(libraryComposition));
  const [isPromptFork, setIsPromptFork] = useState(false);
  const artists = useMemo(() => flattenComposition(composition), [composition]);
  const prompt = useMemo(() => serializeArtistPrompt(composition), [composition]);

  const handleWeightChange = (nodeId: string, weight: number) => {
    const nextComposition = updateNodeWeight(composition, nodeId, weight) as ChunkNode;
    setComposition(nextComposition);
    setPromptDraft(serializeArtistPrompt(nextComposition));
  };

  const handlePromptApply = () => {
    const nextComposition = forkCompositionFromPrompt(
      libraryComposition,
      promptDraft,
      "prompt-fork",
      `${libraryComposition.name} · 직접 편집`,
    );
    setComposition(nextComposition);
    setPromptDraft(serializeArtistPrompt(nextComposition));
    setIsPromptFork(true);
  };

  const handlePromptReset = () => {
    setComposition(libraryComposition);
    setPromptDraft(serializeArtistPrompt(libraryComposition));
    setIsPromptFork(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-mark">TL</span>
          <strong>Tag Lab</strong>
          <span className="version-label">foundation 01</span>
        </div>
        <div className="topbar-status">모델 연결됨 · 작가 {artists.length}명</div>
      </header>

      <section className="workspace">
        <CompositionPanel
          composition={composition}
          prompt={prompt}
          promptDraft={promptDraft}
          isPromptFork={isPromptFork}
          onWeightChange={handleWeightChange}
          onPromptChange={setPromptDraft}
          onPromptApply={handlePromptApply}
          onPromptReset={handlePromptReset}
        />

        <Panel className="generation-panel" title="이미지 생성" eyebrow="Seed 38129411">
          <div className="image-placeholder">
            <span>NovelAI generation adapter</span>
            <small>연결 전 · UI와 도메인 모델은 독립 실행</small>
          </div>
          <button className="primary-action" type="button" disabled>
            Generate
          </button>
        </Panel>

        <Panel className="artist-panel" title="작가 도감" eyebrow="로컬 카탈로그">
          <div className="artist-hero" />
          <div className="artist-copy">
            <strong>ciloranko</strong>
            <span>카탈로그 연결은 다음 단계에서 지연 로딩한다.</span>
          </div>
        </Panel>

        <Panel className="history-panel" title="History" eyebrow="0 records">
          <div className="empty-state">생성 기록이 아직 없어.</div>
        </Panel>

        <WeightFloor artists={artists} />
      </section>
    </main>
  );
}
