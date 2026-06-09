import { useState, useEffect, useRef } from "react";
import type { PromptState } from "../types/metadata";
import type { PromptInsertTarget } from "../prompt/promptInsertTarget";
import type { CoreCatalogEntry } from "../prompt/catalog/catalogTypes";
import CollapsibleSection from "./CollapsibleSection";
import ComposeCatalogChips from "./ComposeCatalogChips";
import { TagDictionaryBrowser } from "./TagDictionaryBrowser";
import { useThemeStyles } from "../contexts/themeContextCore";
import { withAlpha } from "../styles/color";

interface Props {
  prompt: PromptState;
  activePromptTarget: PromptInsertTarget;
  onToggleCatalogEntry: (entry: CoreCatalogEntry) => void;
  onReorderBasePrompt: (fromIndex: number, toIndex: number) => void;
  onInsertDictionaryTag: (tag: string, target: "prompt" | "negative") => void;
}

export default function TagDictionarySection({
  prompt,
  activePromptTarget,
  onToggleCatalogEntry,
  onReorderBasePrompt,
  onInsertDictionaryTag,
}: Props) {
  const { theme } = useThemeStyles();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activePromptValue = (() => {
    switch (activePromptTarget.kind) {
      case "base":
        return prompt.basePrompt;
      case "negativeBase":
        return prompt.negativeBase;
      case "character":
        return prompt.characters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
      case "negativeCharacter":
        return prompt.negativeCharacters.find((character) => character.id === activePromptTarget.id)?.caption ?? "";
    }
  })();

  const handleToggle = (entry: CoreCatalogEntry) => {
    onToggleCatalogEntry(entry);
    
    // Determine the actual target for the toast message
    let targetName = "Main Prompt";
    if (entry.target === 'negative' && activePromptTarget.kind === 'base') {
      targetName = "Negative Prompt";
    } else if (activePromptTarget.kind === 'character') {
      const idx = prompt.characters.findIndex((c) => c.id === activePromptTarget.id);
      if (entry.target === 'negative') {
        targetName = `Character ${idx + 1} Negative`;
      } else {
        targetName = `Character ${idx + 1} Prompt`;
      }
    } else if (activePromptTarget.kind === 'negativeBase') {
      targetName = "Negative Prompt";
    } else if (activePromptTarget.kind === 'negativeCharacter') {
      const idx = prompt.negativeCharacters.findIndex((c) => c.id === activePromptTarget.id);
      targetName = `Character ${idx + 1} Negative`;
    }

    setToastMessage(`+ ${entry.tag} → ${targetName}`);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 900);
  };

  const handleInsertDictionaryTag = (tag: string, dictTarget: "prompt" | "negative") => {
    onInsertDictionaryTag(tag, dictTarget);

    let targetName = "Main Prompt";
    if (dictTarget === 'negative' && activePromptTarget.kind === 'base') {
      targetName = "Negative Prompt";
    } else if (activePromptTarget.kind === 'character') {
      const idx = prompt.characters.findIndex((c) => c.id === activePromptTarget.id);
      if (dictTarget === 'negative') {
        targetName = `Character ${idx + 1} Negative`;
      } else {
        targetName = `Character ${idx + 1} Prompt`;
      }
    } else if (activePromptTarget.kind === 'negativeBase') {
      targetName = "Negative Prompt";
    } else if (activePromptTarget.kind === 'negativeCharacter') {
      const idx = prompt.negativeCharacters.findIndex((c) => c.id === activePromptTarget.id);
      targetName = `Character ${idx + 1} Negative`;
    }

    setToastMessage(`+ ${tag} → ${targetName}`);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const badgeText = (() => {
    if (activePromptTarget.kind === 'base') return 'Main Prompt';
    if (activePromptTarget.kind === 'negativeBase') return 'Negative Prompt';
    if (activePromptTarget.kind === 'character') {
      const idx = prompt.characters.findIndex((c) => c.id === activePromptTarget.id);
      return `Character ${idx + 1} Prompt`;
    }
    if (activePromptTarget.kind === 'negativeCharacter') {
      const idx = prompt.negativeCharacters.findIndex((c) => c.id === activePromptTarget.id);
      return `Character ${idx + 1} Negative`;
    }
    return '';
  })();

  const isNegativeTarget = activePromptTarget.kind === 'negativeBase' || activePromptTarget.kind === 'negativeCharacter';

  return (
    <CollapsibleSection title="Tag Dictionary" testId="tag-dictionary-section" defaultOpen={true}>
      <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ 
          fontSize: '11px', 
          color: theme.subtext1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: withAlpha(isNegativeTarget ? theme.tagNegativeBg : theme.tagPositiveBg, 0.4),
          borderRadius: '6px',
          border: `1px solid ${withAlpha(theme.surface0, 0.5)}`
        }}>
          <span style={{ fontWeight: 'bold' }}>활성 입력:</span> {badgeText}
        </div>
        {activePromptTarget.kind !== 'negativeBase' && activePromptTarget.kind !== 'negativeCharacter' && (
          <div style={{ fontSize: '10px', color: theme.subtext0, paddingLeft: '4px' }}>
            * Negative 계열 태그 클릭 시 자동으로 해당 타겟의 Negative로 이동합니다.
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <ComposeCatalogChips
          prompt={prompt}
          activePromptTarget={activePromptTarget}
          activePromptValue={activePromptValue}
          onToggle={handleToggle}
          onReorderBasePrompt={onReorderBasePrompt}
        />

        <TagDictionaryBrowser onInsertTag={handleInsertDictionaryTag} />
        
        {toastMessage && (
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: theme.text,
            color: theme.base,
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'fadeInOut 0.9s ease-in-out',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            {toastMessage}
          </div>
        )}
        <style>
          {`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translate(-50%, 10px); }
              15% { opacity: 1; transform: translate(-50%, 0); }
              85% { opacity: 1; transform: translate(-50%, 0); }
              100% { opacity: 0; transform: translate(-50%, -10px); }
            }
          `}
        </style>
      </div>
    </CollapsibleSection>
  );
}
