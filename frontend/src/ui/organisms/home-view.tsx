import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { firstName } from "@/lib/ticket-labels";
import { EmptyState } from "../molecules/empty-state";
import { SummaryCards } from "./summary-cards";
import { TicketList } from "./ticket-list";

type Ticket = components["schemas"]["TicketOut"];
type User = components["schemas"]["UserOut"];
type Summary = components["schemas"]["MySummaryOut"];

export type HomeService = { key: string; label: string; description: string };

const OPEN = new Set(["new", "assigned", "in_progress"]);
const PREVIEW = 5;

/** Distinct assets of the user's tickets with the tickets that mention them (UT-10). */
function equipmentFrom(tickets: Ticket[]): { asset: string; ticketIds: string[] }[] {
  const byAsset = new Map<string, string[]>();
  for (const ticket of tickets) {
    if (!ticket.asset) continue;
    byAsset.set(ticket.asset, [...(byAsset.get(ticket.asset) ?? []), ticket.id]);
  }
  return [...byAsset].map(([asset, ticketIds]) => ({ asset, ticketIds }));
}

/** U1 presentational: everything arrives as props; the page container fetches. */
export function HomeView({
  user,
  summary,
  tickets,
  services,
}: {
  user: User;
  summary: Summary;
  tickets: Ticket[];
  services: HomeService[];
}) {
  const open = tickets.filter((t) => OPEN.has(t.status));
  const closed = tickets.filter((t) => !OPEN.has(t.status));
  const equipment = equipmentFrom(tickets);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 tabIndex={-1}>Hola, {firstName(user.name)}</h1>
          <p>{COPY.home.subtitle}</p>
        </div>
        <Link className="btn btn-primary" href="/solicitud/conversacion">
          {COPY.newTicket}
        </Link>
      </div>

      <SummaryCards
        items={[
          { label: COPY.home.summaryOpen, value: summary.open },
          { label: COPY.home.summaryAwaiting, value: summary.awaiting },
          { label: COPY.home.summaryResolved, value: summary.resolved },
          { label: COPY.home.summaryClosed, value: summary.closed },
        ]}
      />

      <section aria-labelledby="home-tickets" className="stack">
        <div className="page-head">
          <h2 id="home-tickets">{COPY.myTickets}</h2>
          <Link href="/tickets">{`${COPY.home.seeAll} (${tickets.length})`}</Link>
        </div>
        {open.length > 0 ? (
          <TicketList tickets={open.slice(0, PREVIEW)} label="Tickets abiertos" />
        ) : (
          <EmptyState message="No tienes tickets abiertos." />
        )}
        {closed.length > 0 ? <TicketList tickets={closed.slice(0, PREVIEW)} label="Tickets cerrados" /> : null}
      </section>

      <section aria-labelledby="home-services" className="stack">
        <div className="page-head">
          <h2 id="home-services">{COPY.whatDoYouNeed}</h2>
          <Link href="/solicitud">{`${COPY.home.seeAll} (${services.length})`}</Link>
        </div>
        <ul className="service-grid">
          {services.map((service) => (
            <li key={service.key}>
              <Link className="service-card" href={`/solicitud/conversacion?servicio=${service.key}`}>
                <span className="service-name">{service.label}</span>
                <span className="t-meta">{service.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-team" className="stack">
        <h2 id="home-team">{COPY.myTeam}</h2>
        {equipment.length > 0 ? (
          <ul aria-label={COPY.myTeam} className="ticket-list">
            {equipment.map((item) => (
              <li key={item.asset} className="ticket-row">
                <span className="t-id">{item.asset}</span>
                <span className="t-meta">Tickets: {item.ticketIds.join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-meta">{COPY.home.noEquipment}</p>
        )}
      </section>
    </div>
  );
}
