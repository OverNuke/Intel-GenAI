import type { InputHTMLAttributes, Ref } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  describedBy?: string;
  ref?: Ref<HTMLInputElement>;
};

export function TextInput({ invalid = false, describedBy, className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      className={`input${className ? ` ${className}` : ""}`}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={invalid ? describedBy : undefined}
    />
  );
}
