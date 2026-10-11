import Link from "next/link";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { assetLabel, sampleAsset, type AssetKind } from "@/lib/sample-assets";
import { firstName } from "@/lib/ticket-labels";
import { Icon, type IconName } from "../atoms/icon";
import { EmptyState } from "../molecules/empty-state";
import { StatusPill } from "../molecules/status-pill";
import { SummaryCards } from "./summary-cards";
import { TicketList } from "./ticket-list";

type Ticket = components["schemas"]["TicketOut"];
type User = components["schemas"]["UserOut"];
type Summary = components["schemas"]["MySummaryOut"];

export type HomeService = { key: string; label: string; description: string };

const OPEN = new Set(["new", "assigned", "in_progress"]);
const PREVIEW = 5;

type Equipment = { asset: string; ticketIds: string[]; latest: Ticket };

const KIND_ICONS: Record<AssetKind, IconName> = {
  pc: "laptop",
  printer: "printer",
  monitor: "monitor",
  // adapted: the mock's phone icon is not in the extracted sprite; headset stands in.
  phone: "headset",
};

/**
 * Distinct assets of the user's tickets with the tickets that mention them (UT-10) and the
 * most recently updated one (ties keep the API order), whose status the card shows.
 */
function equipmentFrom(tickets: Ticket[]): Equipment[] {
  const byAsset = new Map<string, Equipment>();
  for (const ticket of tickets) {
    if (!ticket.asset) continue;
    const found = byAsset.get(ticket.asset);
    if (!found) {
      byAsset.set(ticket.asset, { asset: ticket.asset, ticketIds: [ticket.id], latest: ticket });
      continue;
    }
    found.ticketIds.push(ticket.id);
    if (Date.parse(ticket.updated_at) > Date.parse(found.latest.updated_at)) found.latest = ticket;
  }
  return [...byAsset.values()];
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
        <div className="sec-head">
          <div className="sec-head-l">
            <h2 id="home-team">{COPY.myTeam}</h2>
            {equipment.length > 0 ? <span className="badge">{equipment.length}</span> : null}
            <span className="badge">{COPY.sampleData}</span>
          </div>
        </div>
        {equipment.length > 0 ? (
          <ul aria-label={COPY.myTeam} className="asset-grid">
            {equipment.map((item) => {
              const sample = sampleAsset(item.asset);
              return (
                <li key={item.asset} className="asset-card">
                  <span className="asset-icon">
                    <Icon name={KIND_ICONS[sample?.kind ?? "pc"]} />
                  </span>
                  <span className="asset-text">
                    <span className="service-name">{assetLabel(item.asset)}</span>
                    {sample ? <span className="t-id">{item.asset}</span> : null}
                  </span>
                  <span className="asset-foot">
                    <StatusPill status={item.latest.status} awaitingUser={item.latest.awaiting_user} />
                    <span className="t-meta">Tickets: {item.ticketIds.join(", ")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="t-meta">{COPY.home.noEquipment}</p>
        )}
      </section>
    </div>
  );
}
