import { useRef } from "react";
import { useThemeStyles } from "../contexts/themeContextCore";

interface Props {
  saveName: string;
  onSaveNameChange: (name: string) => void;
  onSave: () => void;
  onImportJson: (file: File) => void;
  onExportJson: () => void;
  onImportImages: (files: File[]) => void;
  onQueueImages: (files: File[]) => void;
}

export default function PresetActions({
  saveName,
  onSaveNameChange,
  onSave,
  onImportJson,
  onExportJson,
  onImportImages,
  onQueueImages,
}: Props) {
  const { theme, inputStyle, smallBtnStyle } = useThemeStyles();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const queueImageInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
        <input
          type="text"
          value={saveName}
          onChange={(event) => onSaveNameChange(event.target.value)}
          placeholder="Preset name..."
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={onSave}
          style={{ ...smallBtnStyle, color: theme.green }}
        >
          Save
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          marginBottom: "8px",
        }}
      >
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onImportJson(file);
          }}
          style={{ display: "none" }}
        />
        <input
          ref={imageInputRef}
          data-testid="load-image-input"
          type="file"
          accept="image/png,image/webp,image/*"
          multiple
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length > 0) onImportImages(files);
          }}
          style={{ display: "none" }}
        />
        <input
          ref={queueImageInputRef}
          data-testid="queue-images-input"
          type="file"
          accept="image/png,image/webp,image/*"
          multiple
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length > 0) onQueueImages(files);
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => jsonInputRef.current?.click()}
          style={{ ...smallBtnStyle, flex: "1 1 42%", color: theme.blue }}
        >
          📥 JSON
        </button>
        <button
          type="button"
          onClick={onExportJson}
          style={{ ...smallBtnStyle, flex: "1 1 42%", color: theme.yellow }}
        >
          📤 JSON
        </button>
        <button
          type="button"
          data-testid="load-image-button"
          onClick={() => imageInputRef.current?.click()}
          style={{ ...smallBtnStyle, flex: "1 1 42%", color: theme.text }}
        >
          🖼️ Load Image
        </button>
        <button
          type="button"
          data-testid="queue-images-button"
          onClick={() => queueImageInputRef.current?.click()}
          style={{ ...smallBtnStyle, flex: "1 1 42%", color: theme.green }}
        >
          Queue Images
        </button>
      </div>
    </>
  );
}
