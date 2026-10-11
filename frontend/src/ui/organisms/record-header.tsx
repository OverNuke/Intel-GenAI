import Link from "next/link";
import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";

/**
 * Breadcrumb + record head card shared by U3 and T2: id, title, optional help entry and sample
 * chip in the first cell; `children` are the remaining cells (status, dates).
 */
export function RecordHeader({
  crumb,
  id,
  title,
  subtitle,
  help,
  sample = false,
  crumbId = true,
  children,
}: {
  crumb: { href: string; label: string };
  id: string;
  title: string;
  subtitle?: string;
  /** Icon-only link: `label` is its accessible name. */
  help?: { href: string; label: string };
  sample?: boolean;
  /** Repeat the id in the breadcrumb (default); T2 turns it off so the id is a single text node. */
  crumbId?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="crumb">
        <Link href={crumb.href}>
          <Icon name="arrow-left" size="sm" />
          {crumb.label}
        </Link>
        {crumbId ? (
          <>
            <span className="t-meta" aria-hidden="true">
              /
            </span>
            <span className="t-id">{id}</span>
          </>
        ) : null}
      </div>
      <div className="card rec-head">
        <div className="stack">
          <div className="page-head">
            <div>
              <p className="t-id">{id}</p>
              <h1 tabIndex={-1}>{title}</h1>
              {subtitle ? <p className="t-meta">{subtitle}</p> : null}
            </div>
            {help ? (
              <Link className="icon-btn icon-btn--outline" href={help.href} aria-label={help.label}>
                <Icon name="circle-help" />
              </Link>
            ) : null}
          </div>
          {sample ? <span className="badge">{COPY.sampleData}</span> : null}
        </div>
        {children}
      </div>
    </>
  );
}
