import type { HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "./icon";

export type AlertTone = "info" | "error" | "warning" | "success";

const DEFAULT_ICON: Record<AlertTone, IconName> = {
  info: "info",
  error: "circle-alert",
  warning: "triangle-alert",
  success: "circle-check",
};

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  tone: AlertTone;
  icon?: IconName;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

/** One message about the whole form or screen: tinted block, tone icon, plain text. */
export function Alert({ tone, icon, children, ref, ...rest }: AlertProps) {
  return (
    <div ref={ref} className={`alert tone-${tone}`} {...rest}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} />
      <div className="alert-body">{children}</div>
    </div>
  );
}
