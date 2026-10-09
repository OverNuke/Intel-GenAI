import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
  busyLabel?: string;
};

export function Button({ variant = "primary", busy = false, busyLabel, children, onClick, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn-${variant}${className ? ` ${className}` : ""}`}
      aria-busy={busy ? "true" : undefined}
      onClick={busy ? undefined : onClick}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
