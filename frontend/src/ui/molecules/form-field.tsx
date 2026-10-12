import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "../atoms/icon";
import { TextInput } from "../atoms/text-input";

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: string | undefined;
  trailing?: ReactNode;
  leadingIcon?: IconName;
  ref?: Ref<HTMLInputElement>;
};

export function FormField({ id, label, error, trailing, leadingIcon, ...input }: FormFieldProps) {
  const errorId = `${id}-err`;
  const control = <TextInput id={id} invalid={Boolean(error)} describedBy={errorId} {...input} />;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        {leadingIcon ? (
          <div className="input-wrap">
            <Icon name={leadingIcon} />
            {control}
          </div>
        ) : (
          control
        )}
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="field-msg is-error">
          <Icon name="circle-alert" size="sm" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
