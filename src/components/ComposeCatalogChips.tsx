import { useMemo, useState } from "react";
import { coreCatalog } from "../prompt/catalog/coreCatalog.generated";
import type { CoreCatalogEntry, ProductCategory } from "../prompt/catalog/catalogTypes";
import { useTheme } from "../contexts/themeContextCore";
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
  basePrompt: string;
  negativePrompt: string;
  onToggle: (entry: CoreCatalogEntry) => void;
  onReorderBasePrompt: (fromIndex: number, toIndex: number) => void;
}

function isEntryActive(entry: CoreCatalogEntry, basePrompt: string, negativePrompt: string): boolean {
  const sourceText = entry.target === "negative" ? negativePrompt : basePrompt;
  return hasCatalogTag(sourceText, entry);
}

export default function ComposeCatalogChips({
  basePrompt,
  negativePrompt,
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
  const selectedPromptTags = splitPromptTags(basePrompt);

  const tabBaseStyle: React.CSSProperties = {
    backgroundColor: "#15172f",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    borderRadius: "999px",
    color: "#ffffff",
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
                backgroundColor: selected ? "#f5f0a8" : "#15172f",
                borderColor: selected ? "#f5f0a8" : "rgba(255, 255, 255, 0.25)",
                color: selected ? "#111222" : "#ffffff",
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
          const active = isEntryActive(entry, basePrompt, negativePrompt);
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
                backgroundColor: active ? "#15172f" : "#f5f0a8",
                border: `1px solid ${active ? "#15172f" : "#e4de8c"}`,
                borderRadius: "6px",
                color: active ? "#ffffff" : "#111222",
                cursor: "pointer",
                display: "flex",
                fontSize: "12px",
                justifyContent: "center",
                lineHeight: 1.2,
                minHeight: "34px",
                overflow: "hidden",
                padding: "5px 7px",
                textAlign: "center",
                textOverflow: "ellipsis",
                touchAction: "manipulation",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
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
                setDragIndex(index);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (dragIndex != null) {
                  onReorderBasePrompt(dragIndex, index);
                  setDragIndex(null);
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragIndex(index);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                if (dragIndex != null) {
                  onReorderBasePrompt(dragIndex, index);
                  setDragIndex(null);
                }
              }}
              style={{
                alignItems: "center",
                backgroundColor: dragIndex === index ? "#f5f0a8" : "#15172f",
                border: `1px solid ${dragIndex === index ? "#f5f0a8" : "rgba(255, 255, 255, 0.25)"}`,
                borderRadius: "999px",
                color: dragIndex === index ? "#111222" : "#ffffff",
                cursor: "grab",
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
