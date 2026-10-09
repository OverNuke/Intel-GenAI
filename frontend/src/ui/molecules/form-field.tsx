import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { TextInput } from "../atoms/text-input";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: string | undefined;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

export function FormField({ id, label, error, trailing, ...input }: FormFieldProps) {
  const errorId = `${id}-err`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        <TextInput id={id} invalid={Boolean(error)} describedBy={errorId} {...input} />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
