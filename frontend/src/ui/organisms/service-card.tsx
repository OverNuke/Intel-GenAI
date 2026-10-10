import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { AuthorizationNotice } from "./authorization-notice";

type Service = components["schemas"]["ServiceOut"];

export function ServiceCard({ service }: { service: Service }) {
  const titleId = `svc-${service.key}`;
  return (
    <article aria-labelledby={titleId} className="card stack service-full">
      <div>
        <h2 id={titleId}>{service.label}</h2>
        <p className="t-meta">{service.description}</p>
      </div>
      <div>
        <h3 className="t-label">{COPY.catalog.examples}</h3>
        <ul className="plain-list">
          {service.examples.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="t-label">{COPY.catalog.haveAtHand}</h3>
        <ul className="plain-list">
          {service.have_at_hand.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="t-meta">{`${COPY.catalog.handledBy}: ${service.handled_by}`}</p>
      {service.requires_manager_authorization ? <AuthorizationNotice /> : null}
      <Link
        className="btn btn-primary"
        href={`/solicitud/conversacion?servicio=${service.key}`}
        aria-describedby={titleId}
      >
        {COPY.home.startWithAriadna}
      </Link>
    </article>
  );
}
