import {
  getEffectiveWeight,
  roundWeight,
  type ChunkNode,
  type CompositionNode,
} from "../../domain/composition";
import { Panel } from "../../components/Panel";

interface CompositionPanelProps {
  composition: ChunkNode;
  prompt: string;
  promptDraft: string;
  isPromptFork: boolean;
  onWeightChange: (nodeId: string, weight: number) => void;
  onPromptChange: (prompt: string) => void;
  onPromptApply: () => void;
  onPromptReset: () => void;
}

interface NodeRowProps {
  node: CompositionNode;
  root: CompositionNode;
  depth: number;
  onWeightChange: (nodeId: string, weight: number) => void;
}

function NodeRow({ node, root, depth, onWeightChange }: NodeRowProps) {
  const effectiveWeight = getEffectiveWeight(root, node.id) ?? node.weight;
  const label = node.kind === "artist" ? node.tag : node.name;

  return (
    <>
      <div className={`node-row node-${node.kind}`} style={{ paddingLeft: `${depth * 14 + 8}px` }}>
        <div className="node-label">
          <span className="node-kind">{node.kind === "artist" ? "A" : "C"}</span>
          <span className="node-name">{label}</span>
        </div>
        <label className="weight-control">
          <span className="sr-only">{label} 로컬 가중치</span>
          <input
            type="number"
            step="0.05"
            value={node.weight}
            onChange={(event) => onWeightChange(node.id, Number(event.target.value))}
          />
        </label>
        <output>{roundWeight(effectiveWeight).toFixed(2)}</output>
      </div>
      {node.kind === "chunk" &&
        node.children.map((child) => (
          <NodeRow
            key={child.id}
            node={child}
            root={root}
            depth={depth + 1}
            onWeightChange={onWeightChange}
          />
        ))}
    </>
  );
}

export function CompositionPanel({
  composition,
  prompt,
  promptDraft,
  isPromptFork,
  onWeightChange,
  onPromptChange,
  onPromptApply,
  onPromptReset,
}: CompositionPanelProps) {
  const isPromptDirty = promptDraft.trim() !== prompt;

  return (
    <Panel className="composition-panel" title="Prompt" eyebrow="트리가 원본">
      <div className="prompt-tabs">
        <button className="active" type="button">Base</button>
        <button type="button">Undesired</button>
      </div>
      <div className="prompt-editor">
        <textarea
          aria-label="작가 프롬프트"
          spellCheck={false}
          value={promptDraft}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              onPromptApply();
            }
          }}
        />
        <div className="prompt-editor-footer">
          <span className={isPromptFork ? "prompt-fork-state active" : "prompt-fork-state"}>
            {isPromptFork ? "직접 편집 사본" : "라이브러리 원본"}
          </span>
          <div className="prompt-actions">
            {isPromptFork && (
              <button className="prompt-reset" type="button" onClick={onPromptReset}>
                원본으로
              </button>
            )}
            <button className="prompt-apply" type="button" disabled={!isPromptDirty} onClick={onPromptApply}>
              사본에 적용
            </button>
          </div>
        </div>
      </div>
      <div className="node-headings">
        <span>구성</span>
        <span>로컬</span>
        <span>최종</span>
      </div>
      <div className="node-tree">
        <NodeRow
          node={composition}
          root={composition}
          depth={0}
          onWeightChange={onWeightChange}
        />
      </div>
    </Panel>
  );
}
