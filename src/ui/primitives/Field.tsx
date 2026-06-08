import type { CSSProperties, ReactNode } from "react";
import { useTheme } from "../../contexts/themeContextCore";

interface FieldProps {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
}

export default function Field({ label, children, style, labelStyle }: FieldProps) {
  const theme = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 110px",
        minWidth: 0,
        ...style,
      }}
    >
      <label
        style={{
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
          padding: "4px 7px",
          ...labelStyle,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
