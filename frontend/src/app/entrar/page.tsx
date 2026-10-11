import { fetchAccounts } from "@/lib/accounts";
import { readServerContext } from "@/lib/server-context";
import { Icon } from "@/ui/atoms/icon";
import { PrototypeBanner } from "@/ui/atoms/prototype-banner";
import { SignInContainer } from "./sign-in-container";

export const dynamic = "force-dynamic";

async function loadAccounts() {
  try {
    return await fetchAccounts(await readServerContext());
  } catch {
    return null;
  }
}

export default async function EntrarPage() {
  // An accounts outage must not block credentials login: degrade to a disabled picker.
  const accounts = await loadAccounts();
  return (
    <div className="split-page">
      <aside aria-label="Ariadna" className="brand-aside">
        <div className="brand-aside-top">
          <span className="logo-slot logo-slot--on-inverted" aria-hidden="true">
            <Icon name="image" />
          </span>
          <div>
            <p className="wordmark">Ariadna</p>
            <p className="brand-aside-tagline">Tu guía para solicitudes de TI</p>
          </div>
        </div>
        <PrototypeBanner />
      </aside>
      <main className="split-main">
        <SignInContainer accounts={accounts} />
      </main>
    </div>
  );
}
