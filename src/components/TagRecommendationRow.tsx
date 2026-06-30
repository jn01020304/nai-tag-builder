import { useState } from "react";
import { useTheme } from "../contexts/themeContextCore";
import { withAlpha } from "../styles/color";
import type { TagSuggestion } from "../catalog/providers/tagSuggestionProvider";

interface Props {
  recommendations: TagSuggestion[];
  onPick: (suggestion: TagSuggestion) => void;
  testIdPrefix: string;
}

/**
 * Related-tag suggestions for the field content, as a collapsible wrapped row.
 * Backed by the offline relations asset, with a category/recent heuristic
 * fallback for tags outside the asset's seed coverage.
 */
export default function TagRecommendationRow({ recommendations, onPick, testIdPrefix }: Props) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  if (recommendations.length === 0) return null;

  return (
    <div data-testid={`${testIdPrefix}-recommendations`} style={{ marginBottom: "6px" }}>
      <button
        type="button"
        data-testid={`${testIdPrefix}-recommendations-toggle`}
        onClick={() => setCollapsed((current) => !current)}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          alignItems: "center",
          background: "none",
          border: "none",
          color: theme.subtext0,
          cursor: "pointer",
          display: "flex",
          fontSize: "11px",
          fontWeight: 700,
          gap: "4px",
          padding: "2px 0",
        }}
      >
        <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
        추천 {recommendations.length}
      </button>

      {!collapsed && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "2px" }}>
          {recommendations.map((suggestion) => (
            <button
              key={`${suggestion.source}:${suggestion.english_name}`}
              type="button"
              data-testid={`${testIdPrefix}-recommendation-option-${suggestion.english_name}`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onTouchStart={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onPick(suggestion)}
              title={suggestion.korean_name ? `${suggestion.english_name} · ${suggestion.korean_name}` : suggestion.english_name}
              style={{
                backgroundColor: withAlpha(theme.mantle, 0.6),
                border: `1px dashed ${theme.surface1}`,
                borderRadius: "999px",
                color: theme.text,
                cursor: "pointer",
                flex: "0 0 auto",
                fontSize: "12px",
                lineHeight: 1.2,
                padding: "4px 9px",
                touchAction: "manipulation",
                whiteSpace: "nowrap",
              }}
            >
              + {suggestion.english_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
