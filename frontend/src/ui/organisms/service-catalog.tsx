import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { ServiceCard } from "./service-card";

type Service = components["schemas"]["ServiceOut"];

/** U4 presentational: the services come from the catalog API (never duplicated here). */
export function ServiceCatalog({ services }: { services: Service[] }) {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 tabIndex={-1}>{COPY.whatDoYouNeed}</h1>
          <p>{COPY.catalog.intro}</p>
        </div>
        <Link className="btn btn-secondary" href="/solicitud/conversacion">
          {COPY.newTicket}
        </Link>
      </div>
      <div className="service-grid">
        {services.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </div>
    </div>
  );
}
