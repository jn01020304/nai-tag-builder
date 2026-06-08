import { useMemo, useState } from "react";
import { coreCatalog } from "../prompt/catalog/coreCatalog.generated";
import type { CoreCatalogEntry, ProductCategory } from "../prompt/catalog/catalogTypes";
import type { PromptInsertTarget } from "../prompt/promptInsertTarget";
import { promptTargetGroup } from "../prompt/promptInsertTarget";
import type { PromptState } from "../types/metadata";
import { useTheme } from "../contexts/themeContextCore";
import { promptTonePalettes } from "../styles/promptTonePalettes";
import { readableTextColor, withAlpha } from "../styles/color";
import { hasCatalogTag, splitPromptTags } from "../prompt/catalog/promptTagText";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  headcount: "인원수",
  background: "배경",
  framing: "구도",
  pose: "자세",
  expression: "표정",
  appearance: "외형",
  outfit: "의상",
  style_quality: "품질",
  negative_safety: "네거티브",
  character_scope: "캐릭터",
  utility: "기타",
};

const CATEGORY_ORDER: ProductCategory[] = [
  "headcount",
  "background",
  "framing",
  "pose",
  "expression",
  "appearance",
  "outfit",
  "style_quality",
  "negative_safety",
];

interface Props {
  prompt: PromptState;
  activePromptTarget: PromptInsertTarget;
  activePromptValue: string;
  onToggle: (entry: CoreCatalogEntry) => void;
  onReorderBasePrompt: (fromIndex: number, toIndex: number) => void;
}

export default function ComposeCatalogChips({
  prompt,
  activePromptTarget,
  activePromptValue,
  onToggle,
  onReorderBasePrompt,
}: Props) {
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = useState<ProductCategory>("headcount");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const entriesByCategory = useMemo(() => {
    const groups = new Map<ProductCategory, readonly CoreCatalogEntry[]>();
    for (const category of CATEGORY_ORDER) {
      groups.set(category, coreCatalog.filter((entry) => entry.productCategory === category && entry.defaultVisible));
    }
    return groups;
  }, []);

  const visibleEntries = entriesByCategory.get(activeCategory) ?? [];
  const selectedPromptTags = splitPromptTags(activePromptValue);
  const activeTargetGroup = promptTargetGroup(activePromptTarget);
  const canReorderSelectedTags = activePromptTarget.kind === "base";

  type TargetGroup = ReturnType<typeof promptTargetGroup>;

  interface TagAssignment {
    key: string;
    label: string;
    group: TargetGroup;
  }

  const getEntryAssignments = (entry: CoreCatalogEntry): TagAssignment[] => {
    const assignments: TagAssignment[] = [];

    if (hasCatalogTag(prompt.basePrompt, entry)) {
      assignments.push({ key: "base", label: "m", group: "base" });
    }

    if (hasCatalogTag(prompt.negativeBase, entry)) {
      assignments.push({ key: "negativeBase", label: "n", group: "negative" });
    }

    for (const [index, character] of prompt.characters.entries()) {
      if (hasCatalogTag(character.caption, entry)) {
        assignments.push({
          key: `character:${character.id}`,
          label: `c${index + 1}`,
          group: "character",
        });
      }
    }

    for (const [index, character] of prompt.negativeCharacters.entries()) {
      if (hasCatalogTag(character.caption, entry)) {
        assignments.push({
          key: `negativeCharacter:${character.id}`,
          label: `nc${index + 1}`,
          group: "negativeCharacter",
        });
      }
    }

    return assignments;
  };

  const tabBaseStyle: React.CSSProperties = {
    backgroundColor: withAlpha(theme.mantle, 0.72),
    border: `1px solid ${theme.surface1}`,
    borderRadius: "999px",
    color: theme.text,
    cursor: "pointer",
    flex: "0 0 auto",
    fontSize: "12px",
    lineHeight: 1,
    minHeight: "30px",
    padding: "0 10px",
    whiteSpace: "nowrap",
  };

  return (
    <section style={{ marginBottom: "10px" }}>
      <div
        aria-label="Prompt categories"
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "8px",
          overflowX: "auto",
          paddingBottom: "2px",
          scrollbarWidth: "thin",
        }}
      >
        {CATEGORY_ORDER.map((category) => {
          const selected = category === activeCategory;
          const count = entriesByCategory.get(category)?.length ?? 0;
          return (
            <button
              key={category}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setActiveCategory(category)}
              style={{
                ...tabBaseStyle,
                backgroundColor: selected ? theme.actionAccent : withAlpha(theme.mantle, 0.72),
                borderColor: selected ? theme.actionAccent : theme.surface1,
                color: selected ? theme.actionAccentText : theme.text,
              }}
            >
              {CATEGORY_LABELS[category]} {count}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
          gap: "6px",
          marginBottom: "6px",
        }}
      >
        {visibleEntries.map((entry) => {
          const assignments = getEntryAssignments(entry);
          const active = assignments.length > 0;
          const activeInCurrentTarget = hasCatalogTag(activePromptValue, entry);
          const currentAssignmentPalette = promptTonePalettes[activeTargetGroup];
          const firstAssignmentPalette = assignments[0] ? promptTonePalettes[assignments[0].group] : currentAssignmentPalette;
          const chipPalette = activeInCurrentTarget ? currentAssignmentPalette : firstAssignmentPalette;
          return (
            <button
              key={entry.id}
              type="button"
              data-testid={`catalog-chip-${entry.id}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onToggle(entry)}
              title={entry.koreanLabel ? `${entry.tag} · ${entry.koreanLabel}` : entry.tag}
              aria-pressed={active}
              style={{
                alignItems: "center",
                backgroundColor: active ? chipPalette.background : "#f5f0a8",
                border: `1px solid ${active ? chipPalette.border : "#e4de8c"}`,
                borderRadius: "6px",
                boxShadow: active ? `0 0 0 2px ${chipPalette.shadow}` : "none",
                color: active ? chipPalette.color : "#111222",
                cursor: "pointer",
                display: "flex",
                fontSize: "12px",
                justifyContent: "center",
                lineHeight: 1.2,
                minHeight: "34px",
                overflow: "hidden",
                padding: assignments.length > 0 ? "10px 7px 5px" : "5px 7px",
                position: "relative",
                textAlign: "center",
                textOverflow: "ellipsis",
                touchAction: "manipulation",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {assignments.length > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    gap: "2px",
                    maxWidth: "calc(100% - 6px)",
                    overflow: "hidden",
                    position: "absolute",
                    right: "3px",
                    top: "2px",
                  }}
                >
                  {assignments.map((assignment) => {
                    const palette = promptTonePalettes[assignment.group];
                    return (
                      <span
                        key={assignment.key}
                        data-testid={`catalog-chip-${entry.id}-badge-${assignment.label}`}
                        style={{
                          backgroundColor: palette.border,
                          borderRadius: "999px",
                          color: "#101224",
                          fontSize: "8px",
                          fontWeight: 800,
                          lineHeight: 1,
                          minWidth: assignment.label.length > 1 ? "14px" : "10px",
                          padding: "1px 3px",
                          textTransform: "lowercase",
                        }}
                      >
                        {assignment.label}
                      </span>
                    );
                  })}
                </span>
              )}
              {entry.tag}
            </button>
          );
        })}
      </div>

      {selectedPromptTags.length > 0 && (
        <div
          aria-label="Prompt tag order"
          data-testid="selected-prompt-tags"
          style={{
            borderTop: `1px solid ${theme.surface1}`,
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            marginTop: "8px",
            maxHeight: "88px",
            overflowY: "auto",
            paddingTop: "8px",
            scrollbarWidth: "thin",
          }}
        >
          {selectedPromptTags.map((tag, index) => (
            <button
              key={`${tag}-${index}`}
              type="button"
              data-testid={`selected-tag-${index}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!canReorderSelectedTags) return;
                setDragIndex(index);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (canReorderSelectedTags && dragIndex != null) {
                  onReorderBasePrompt(dragIndex, index);
                  setDragIndex(null);
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!canReorderSelectedTags) return;
                setDragIndex(index);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                if (canReorderSelectedTags && dragIndex != null) {
                  onReorderBasePrompt(dragIndex, index);
                  setDragIndex(null);
                }
              }}
              style={{
                alignItems: "center",
                backgroundColor: dragIndex === index ? theme.actionAccent : withAlpha(theme.mantle, 0.72),
                border: `1px solid ${dragIndex === index ? theme.actionAccent : theme.surface1}`,
                borderRadius: "999px",
                color: dragIndex === index
                  ? theme.actionAccentText
                  : readableTextColor(withAlpha(theme.mantle, 0.72), "#111222", theme.text),
                cursor: canReorderSelectedTags ? "grab" : "default",
                display: "inline-flex",
                fontSize: "11px",
                lineHeight: 1.15,
                maxWidth: "100%",
                minHeight: "28px",
                overflow: "hidden",
                padding: "0 8px",
                textOverflow: "ellipsis",
                touchAction: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span aria-hidden="true" style={{ marginRight: "5px", opacity: 0.7 }}>≡</span>
              {tag}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
