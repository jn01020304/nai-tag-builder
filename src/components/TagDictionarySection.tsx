import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import type { PromptInsertTarget } from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import ComposeCatalogChips from "./ComposeCatalogChips";
import CollapsiblePanel from "./CollapsiblePanel";

interface Props {
  prompt: PromptState;
  activePromptTarget: PromptInsertTarget;
  activePromptValue: string;
  onToggle: (entry: CoreCatalogEntry) => void;
  onReorderBasePrompt: (fromIndex: number, toIndex: number) => void;
}

export default function TagDictionarySection({
  prompt,
  activePromptTarget,
  activePromptValue,
  onToggle,
  onReorderBasePrompt,
}: Props) {
  return (
    <CollapsiblePanel title="Tag Dictionary" defaultOpen={false} testId="tag-dictionary-section">
      <ComposeCatalogChips
        prompt={prompt}
        activePromptTarget={activePromptTarget}
        activePromptValue={activePromptValue}
        onToggle={onToggle}
        onReorderBasePrompt={onReorderBasePrompt}
      />
    </CollapsiblePanel>
  );
}
