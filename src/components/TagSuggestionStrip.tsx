import { useTheme } from "../contexts/themeContextCore";
import { withAlpha } from "../styles/color";
import type { TagSuggestion } from "../catalog/providers/tagSuggestionProvider";

interface Props {
  suggestions: TagSuggestion[];
  onPick: (suggestion: TagSuggestion) => void;
  testIdPrefix: string;
}

/**
 * Autocomplete results for the partial token under the caret, as a single
 * horizontally scrollable row of chips below the textarea (no caret-anchored
 * popup — stays inside the mobile overlay's viewport clamp).
 */
export default function TagSuggestionStrip({ suggestions, onPick, testIdPrefix }: Props) {
  const theme = useTheme();
  if (suggestions.length === 0) return null;

  return (
    <div
      data-testid={`${testIdPrefix}-autocomplete`}
      role="listbox"
      style={{
        display: "flex",
        gap: "6px",
        overflowX: "auto",
        padding: "1px 0 5px",
        marginBottom: "4px",
        scrollbarWidth: "thin",
      }}
    >
      {suggestions.map((suggestion) => (
        <button
          key={`${suggestion.source}:${suggestion.english_name}`}
          type="button"
          data-testid={`${testIdPrefix}-autocomplete-option-${suggestion.english_name}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onTouchStart={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onPick(suggestion)}
          title={suggestion.korean_name ? `${suggestion.english_name} · ${suggestion.korean_name}` : suggestion.english_name}
          style={{
            alignItems: "flex-start",
            backgroundColor: withAlpha(theme.mantle, 0.9),
            border: `1px solid ${theme.surface1}`,
            borderRadius: "999px",
            color: theme.text,
            cursor: "pointer",
            display: "flex",
            flex: "0 0 auto",
            flexDirection: "column",
            fontSize: "12px",
            gap: "1px",
            lineHeight: 1.2,
            padding: "5px 10px",
            touchAction: "manipulation",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>{suggestion.english_name}</span>
          {suggestion.korean_name && (
            <span style={{ color: theme.subtext0, fontSize: "10px" }}>{suggestion.korean_name}</span>
          )}
        </button>
      ))}
    </div>
  );
}
