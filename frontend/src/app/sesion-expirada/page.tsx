import Link from "next/link";
import { COPY } from "@/lib/copy";
import { Icon } from "@/ui/atoms/icon";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";
import { StateCard } from "@/ui/organisms/state-card";

// Public and static on purpose: it never calls the guard, so a stale cookie cannot loop back here.
export default function SesionExpiradaPage() {
  return (
    <StateCard title={COPY.sessionExpired.title} icon={<Icon name="clock" size="lg" />}>
      <p>{COPY.sessionExpired.body}</p>
      <Link className="btn btn-primary" href="/entrar">
        {COPY.sessionExpired.action}
      </Link>
      <PrototypeBanner />
    </StateCard>
  );
}
