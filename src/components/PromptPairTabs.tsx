import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  PromptInsertTarget,
  PromptSelectionAfterRender,
} from "../prompt/promptInsertTarget";
import {
  promptTargetGroup,
  promptTargetKey,
} from "../prompt/promptInsertTarget";
import { useThemeStyles } from "../contexts/themeContextCore";
import { promptTonePalettes } from "../styles/promptTonePalettes";
import { withAlpha } from "../styles/color";
import HighlightedTextarea from "./HighlightedTextarea";

interface PromptPairField {
  label: string;
  tabLabel: string;
  target: PromptInsertTarget;
  value: string;
  placeholder: string;
  testId: string;
  labelTestId?: string;
  minHeight: string;
  onChange: (value: string) => void;
}

interface PromptPairTabsProps {
  primary: PromptPairField;
  secondary: PromptPairField;
  activePromptTarget: PromptInsertTarget;
  testIdPrefix: string;
  getSelectionAfterRender: (target: PromptInsertTarget) => PromptSelectionAfterRender | undefined;
  onPromptSelection: (target: PromptInsertTarget, selection: { start: number; end: number }) => void;
}

type ActivePanel = "primary" | "secondary";

function targetMatches(a: PromptInsertTarget, b: PromptInsertTarget): boolean {
  return promptTargetKey(a) === promptTargetKey(b);
}

export default function PromptPairTabs({
  primary,
  secondary,
  activePromptTarget,
  testIdPrefix,
  getSelectionAfterRender,
  onPromptSelection,
}: PromptPairTabsProps) {
  const { theme, inputStyle, smallBtnStyle } = useThemeStyles();
  const [selectedPanel, setSelectedPanel] = useState<ActivePanel>("primary");
  const [isSplit, setIsSplit] = useState(false);
  const targetPanel: ActivePanel | null = targetMatches(activePromptTarget, primary.target)
    ? "primary"
    : targetMatches(activePromptTarget, secondary.target)
      ? "secondary"
      : null;
  const activePanel = targetPanel ?? selectedPanel;
  const activeField = activePanel === "primary" ? primary : secondary;

  const activateField = (panel: ActivePanel) => {
    const field = panel === "primary" ? primary : secondary;
    setSelectedPanel(panel);
    onPromptSelection(field.target, {
      start: field.value.length,
      end: field.value.length,
    });
  };

  const renderTab = (panel: ActivePanel, field: PromptPairField) => {
    const selected = activePanel === panel;
    const palette = promptTonePalettes[promptTargetGroup(field.target)];

    return (
      <button
        type="button"
        data-testid={`${testIdPrefix}-${panel}-tab`}
        onClick={() => activateField(panel)}
        style={{
          ...smallBtnStyle,
          backgroundColor: selected ? palette.background : withAlpha(theme.mantle, 0.72),
          borderColor: selected ? palette.border : theme.surface1,
          color: selected ? palette.color : theme.text,
          flex: "1 1 0",
          fontWeight: selected ? 800 : 700,
          minHeight: "30px",
          minWidth: 0,
          overflow: "hidden",
          padding: "5px 7px",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {field.tabLabel}
      </button>
    );
  };

  const renderField = (field: PromptPairField, panel: ActivePanel, marginBottom = "8px") => {
    const tone = promptTargetGroup(field.target);
    const palette = promptTonePalettes[tone];
    const selectionAfterRender = getSelectionAfterRender(field.target);

    const labelStyle: CSSProperties = {
      alignSelf: "flex-start",
      backgroundColor: palette.background,
      border: `1px solid ${palette.border}`,
      borderRadius: "6px",
      color: palette.color,
      display: "inline-flex",
      fontSize: "12px",
      fontWeight: 800,
      lineHeight: 1,
      marginBottom: "6px",
      padding: "4px 7px",
    };

    const promptInputStyle: CSSProperties = {
      ...inputStyle,
      boxSizing: "border-box",
      fontSize: "13px",
      lineHeight: 1.45,
      marginBottom,
      minHeight: field.minHeight,
      resize: "vertical",
      width: "100%",
    };

    const handleSelection = (element: HTMLTextAreaElement) => {
      setSelectedPanel(panel);
      onPromptSelection(field.target, {
        start: element.selectionStart,
        end: element.selectionEnd,
      });
    };

    return (
      <div data-testid={`${field.testId}-panel`} style={{ minWidth: 0 }}>
        <label data-testid={field.labelTestId} style={labelStyle}>
          {field.label}
        </label>
        <HighlightedTextarea
          data-testid={field.testId}
          value={field.value}
          onChange={(event) => {
            field.onChange(event.target.value);
            handleSelection(event.target);
          }}
          onSelect={(event) => handleSelection(event.currentTarget)}
          onKeyUp={(event) => handleSelection(event.currentTarget)}
          onFocus={(event) => handleSelection(event.currentTarget)}
          selectionAfterRender={selectionAfterRender}
          placeholder={field.placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={promptInputStyle}
        />
      </div>
    );
  };

  const visibleFields = useMemo(() => {
    if (isSplit) return [primary, secondary];
    return [activeField];
  }, [activeField, isSplit, primary, secondary]);

  return (
    <div style={{ marginBottom: "8px", minWidth: 0 }}>
      <div
        aria-label="Prompt view"
        style={{
          alignItems: "center",
          display: "grid",
          gap: "5px",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
          marginBottom: "8px",
          minWidth: 0,
        }}
      >
        {renderTab("primary", primary)}
        {renderTab("secondary", secondary)}
        <button
          type="button"
          data-testid={`${testIdPrefix}-split-toggle`}
          title={isSplit ? "탭 보기" : "분리해서 보기"}
          onClick={() => setIsSplit((current) => !current)}
          style={{
            ...smallBtnStyle,
            backgroundColor: isSplit ? theme.actionAccent : withAlpha(theme.mantle, 0.72),
            borderColor: isSplit ? theme.actionAccent : theme.surface1,
            color: isSplit ? theme.actionAccentText : theme.text,
            fontWeight: 800,
            minHeight: "30px",
            padding: "5px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {isSplit ? "탭" : "분리"}
        </button>
      </div>

      {visibleFields.map((field, index) => (
        <div
          key={promptTargetKey(field.target)}
          style={{
            borderTop: isSplit && index > 0 ? `1px dashed ${theme.surface1}` : "none",
            paddingTop: isSplit && index > 0 ? "8px" : 0,
          }}
        >
          {renderField(
            field,
            field === primary ? "primary" : "secondary",
            index === visibleFields.length - 1 ? "8px" : "10px",
          )}
        </div>
      ))}
    </div>
  );
}
