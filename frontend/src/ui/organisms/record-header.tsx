import Link from "next/link";
import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";
import { PageHeader } from "../molecules/page-header";

/**
 * Record head shared by U3 and T2: a PageHeader (back arrow, id, title, optional help entry and
 * sample chip) over the status card whose cells are `children` (status, dates). The id shows once.
 */
export function RecordHeader({
  back,
  id,
  title,
  subtitle,
  help,
  sample = false,
  children,
}: {
  back: { href: string; label: string };
  id: string;
  title: string;
  subtitle?: string;
  /** Icon-only link: `label` is its accessible name. */
  help?: { href: string; label: string };
  sample?: boolean;
  children?: ReactNode;
}) {
  const hasActions = sample || Boolean(help);
  return (
    <>
      <PageHeader
        title={title}
        eyebrowId={id}
        back={back}
        {...(subtitle ? { meta: subtitle } : {})}
        {...(hasActions
          ? {
              actions: (
                <>
                  {sample ? <span className="badge">{COPY.sampleData}</span> : null}
                  {help ? (
                    <Link className="icon-btn icon-btn--outline" href={help.href} aria-label={help.label}>
                      <Icon name="circle-help" />
                    </Link>
                  ) : null}
                </>
              ),
            }
          : {})}
      />
      <div className="card rec-head">{children}</div>
    </>
  );
}
