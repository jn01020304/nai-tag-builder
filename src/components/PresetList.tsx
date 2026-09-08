import { useThemeStyles } from "../contexts/themeContextCore";
import type { Preset } from "../types/preset";

interface Props {
  presets: Preset[];
  queue: string[];
  queuedPresets: Preset[];
  onLoad: (preset: Preset) => void;
  onToggleQueue: (id: string) => void;
  onMoveQueue: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
}

export default function PresetList({
  presets,
  queue,
  queuedPresets,
  onLoad,
  onToggleQueue,
  onMoveQueue,
  onDelete,
}: Props) {
  const { theme, smallBtnStyle } = useThemeStyles();
  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    border: `1px solid ${theme.surface1}`,
    background: theme.surface0,
    color: theme.text,
  };
  const tinyBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    color: theme.subtext0,
    cursor: "pointer",
    fontSize: "10px",
    padding: "0 2px",
  };

  return (
    <>
      {presets.length === 0 && (
        <div
          style={{
            fontSize: "11px",
            color: theme.overlay0,
            marginBottom: "6px",
          }}
        >
          No presets saved yet.
        </div>
      )}

      {presets.map((preset) => {
        const inQueue = queue.includes(preset.id);
        return (
          <div
            key={preset.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 0",
              borderBottom: `1px solid ${theme.surface0}`,
              fontSize: "12px",
            }}
          >
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: theme.text,
              }}
            >
              {preset.name}
            </span>
            <button
              type="button"
              onClick={() => onLoad(preset)}
              title="Load into editor"
              style={{ ...smallBtnStyle, fontSize: "11px", padding: "2px 6px" }}
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => onToggleQueue(preset.id)}
              title={inQueue ? "Remove from queue" : "Add to queue"}
              style={{
                ...smallBtnStyle,
                fontSize: "11px",
                padding: "2px 6px",
                color: inQueue ? theme.yellow : theme.blue,
                borderColor: inQueue ? theme.yellow : theme.surface1,
              }}
            >
              {inQueue ? "Q ✓" : "Q +"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(preset.id)}
              title="Delete"
              style={{
                ...smallBtnStyle,
                fontSize: "11px",
                padding: "2px 6px",
                color: theme.warningError,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {queue.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <div
            data-testid="queued-presets-list"
            style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
          >
            {queuedPresets.map((preset, index) => (
              <span
                key={preset.id}
                data-testid={`queued-preset-${index}`}
                style={chipStyle}
              >
                <span style={{ color: theme.overlay0, fontSize: "10px" }}>
                  {index + 1}.
                </span>
                {preset.name}
                <button
                  type="button"
                  onClick={() => onMoveQueue(preset.id, -1)}
                  style={tinyBtn}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onMoveQueue(preset.id, 1)}
                  style={tinyBtn}
                  title="Move down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onToggleQueue(preset.id)}
                  style={{ ...tinyBtn, color: theme.warningError }}
                  title="Remove"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
