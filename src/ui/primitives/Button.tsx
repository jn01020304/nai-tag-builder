import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useThemeStyles } from "../../contexts/themeContextCore";

type ButtonTone = "neutral" | "primary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
  active?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    fontSize: "12px",
    padding: "4px 8px",
  },
  md: {
    fontSize: "13px",
    padding: "6px 10px",
  },
  lg: {
    fontSize: "14px",
    padding: "12px",
  },
};

export default function Button({
  tone = "neutral",
  size = "sm",
  active = false,
  fullWidth = false,
  style,
  children,
  ...props
}: ButtonProps) {
  const { theme, smallBtnStyle } = useThemeStyles();

  const toneStyle: CSSProperties = (() => {
    if (tone === "primary") {
      return {
        backgroundColor: theme.actionAccent,
        borderColor: theme.actionAccent,
        color: theme.actionAccentText,
        fontWeight: 800,
      };
    }

    if (tone === "danger") {
      return {
        color: theme.warningError,
      };
    }

    if (tone === "ghost") {
      return {
        background: "none",
        border: "none",
      };
    }

    return {
      backgroundColor: active ? theme.surface1 : "transparent",
    };
  })();

  return (
    <button
      type="button"
      {...props}
      style={{
        ...smallBtnStyle,
        ...sizeStyles[size],
        ...toneStyle,
        width: fullWidth ? "100%" : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
