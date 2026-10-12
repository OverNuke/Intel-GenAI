import { fetchAccounts } from "@/lib/accounts";
import { readServerContext } from "@/lib/server-context";
import { AriadnaMark } from "@/ui/atoms/ariadna-mark";
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
    <div className="auth">
      <aside aria-label="Ariadna" className="auth-aside">
        <div className="auth-brand">
          <AriadnaMark />
          <p className="wordmark">Ariadna</p>
          <p className="t-meta">Tu guía para solicitudes de TI</p>
        </div>
        <PrototypeBanner />
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <SignInContainer accounts={accounts} />
        </div>
      </main>
    </div>
  );
}
