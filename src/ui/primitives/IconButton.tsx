import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button from "./Button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export default function IconButton({ children, style, ...props }: IconButtonProps) {
  return (
    <Button
      aria-label={props["aria-label"] ?? props.title}
      {...props}
      style={{
        alignItems: "center",
        display: "inline-flex",
        justifyContent: "center",
        lineHeight: 1,
        minWidth: "30px",
        padding: "6px 10px",
        ...style,
      }}
    >
      {children}
    </Button>
  );
}
