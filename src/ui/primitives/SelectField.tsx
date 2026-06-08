import type { SelectHTMLAttributes } from "react";
import { useThemeStyles } from "../../contexts/themeContextCore";
import Field from "./Field";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export default function SelectField({ label, style, children, ...props }: SelectFieldProps) {
  const { inputStyle } = useThemeStyles();

  return (
    <Field label={label}>
      <select
        {...props}
        style={{
          ...inputStyle,
          width: "100%",
          ...style,
        }}
      >
        {children}
      </select>
    </Field>
  );
}
