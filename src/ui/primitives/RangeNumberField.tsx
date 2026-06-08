import type { CSSProperties, InputHTMLAttributes } from "react";
import { useThemeStyles } from "../../contexts/themeContextCore";

interface RangeNumberFieldProps {
  label: string;
  value: number | string;
  min: number;
  max: number;
  step?: number;
  testId?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "step" | "onChange">;
  onNumberChange: (value: string) => void;
  onRangeChange: (value: string) => void;
  onBlur?: () => void;
  style?: CSSProperties;
}

export default function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  testId,
  inputProps,
  onNumberChange,
  onRangeChange,
  onBlur,
  style,
}: RangeNumberFieldProps) {
  const { theme, parameterInputStyle } = useThemeStyles();

  const labelStyle: CSSProperties = {
    alignSelf: "flex-start",
    backgroundColor: theme.crust,
    border: `1px solid ${theme.surface1}`,
    borderRadius: "6px",
    color: theme.text,
    display: "inline-flex",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: "6px",
    maxWidth: "100%",
    overflow: "hidden",
    padding: "4px 7px",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        display: "flex",
        flex: "1 1 110px",
        flexDirection: "column",
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <label style={labelStyle} title={label}>{label}</label>
        <input
          {...inputProps}
          data-testid={testId}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onNumberChange(event.target.value)}
          onBlur={onBlur}
          style={{
            ...parameterInputStyle,
            padding: "2px 4px",
            textAlign: "center",
            width: "48px",
          }}
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onRangeChange(event.target.value)}
        style={{
          accentColor: theme.blue,
          marginTop: "4px",
          width: "100%",
        }}
      />
    </div>
  );
}
