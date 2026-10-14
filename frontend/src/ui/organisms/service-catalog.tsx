import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { PageHeader } from "../molecules/page-header";
import { ServiceCard } from "./service-card";

type Service = components["schemas"]["ServiceOut"];

/** U4 presentational: the services come from the catalog API (never duplicated here). */
export function ServiceCatalog({ services }: { services: Service[] }) {
  return (
    <div className="stack">
      <PageHeader
        title={COPY.whatDoYouNeed}
        meta={COPY.catalog.intro}
        actions={
          <Link className="btn btn-secondary" href="/solicitud/conversacion">
            {COPY.newTicket}
          </Link>
        }
      />
      <div className="service-grid">
        {services.map((service) => (
          <ServiceCard key={service.key} service={service} />
        ))}
      </div>
    </div>
  );
}
