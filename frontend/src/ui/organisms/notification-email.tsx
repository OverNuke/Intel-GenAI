import Link from "next/link";
import { COPY } from "@/lib/copy";
import type { NotificationEmail as Email } from "@/lib/notification-email";

/**
 * T4 presentational: a read-only preview of the email the system sends when a ticket is created.
 * It sends nothing and offers no action besides the link back to the record.
 */
export function NotificationEmail({ email }: { email: Email }) {
  const copy = COPY.notificationEmail;
  const head: [string, string][] = [
    [copy.rows.from, email.from],
    [copy.rows.to, email.to],
    [copy.rows.cc, email.cc],
    [copy.rows.subject, email.subject],
  ];
  const requester = [email.requester, email.area, email.location, email.contact].join(" · ");
  const fields: [string, string][] = [
    [copy.fields.summary, email.summary],
    [copy.fields.description, email.description],
    [copy.fields.requester, requester],
    [copy.fields.impact, email.impact],
    [copy.fields.urgency, email.urgency],
    [copy.fields.asset, email.asset],
    [copy.fields.attachments, email.attachments],
  ];
  return (
    <article className="card mail">
      <dl className="rail-rows mail-head">
        {head.map(([label, value]) => (
          <div key={label} className="rail-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mail-body">
        <p>{`${copy.created}${email.via}.`}</p>
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="t-meta">{label}</span>
            <p className="mail-pre">{value}</p>
          </div>
        ))}
        <p>
          <Link className="link" href={`/ti/tickets/${email.id}`}>
            {copy.viewTicket}
          </Link>
        </p>
        <p className="t-meta">{copy.footer}</p>
      </div>
    </article>
  );
}
