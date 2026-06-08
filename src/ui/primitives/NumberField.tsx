import type { InputHTMLAttributes } from "react";
import { useThemeStyles } from "../../contexts/themeContextCore";
import Field from "./Field";

interface NumberFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function NumberField({ label, style, ...props }: NumberFieldProps) {
  const { parameterInputStyle } = useThemeStyles();

  return (
    <Field label={label}>
      <input
        type="number"
        {...props}
        style={{
          ...parameterInputStyle,
          width: "100%",
          ...style,
        }}
      />
    </Field>
  );
}
