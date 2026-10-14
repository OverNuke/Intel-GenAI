import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "../atoms/icon";

/**
 * Page header shared by every screen: back arrow | title block | actions. The back track exists only
 * when there is a back link; otherwise it collapses so the title aligns flush with the content below.
 * The back control is icon-only; the destination travels in its accessible name.
 */
export function PageHeader({
  title,
  titleId,
  eyebrowId,
  meta,
  back,
  actions,
}: {
  title: string;
  titleId?: string;
  /** Record id, rendered once above the title. */
  eyebrowId?: string;
  meta?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className={back ? "page-header" : "page-header page-header--no-back"}>
      {back ? (
        <Link className="page-header__back icon-btn icon-btn--outline" href={back.href} aria-label={back.label}>
          <Icon name="arrow-left" />
        </Link>
      ) : null}
      <div className="page-header__title">
        {eyebrowId ? <p className="t-id">{eyebrowId}</p> : null}
        <h1 tabIndex={-1} {...(titleId ? { id: titleId } : {})}>
          {title}
        </h1>
        {meta ? <p className="t-meta">{meta}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
