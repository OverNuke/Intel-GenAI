import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/guard";
import { serverGet } from "@/lib/server-api";
import { readServerContext } from "@/lib/server-context";
import { AppShell } from "@/ui/organisms/app-shell";
import { LogoutButton } from "@/ui/organisms/logout-button";
import { SubmissionConfirmation } from "@/ui/organisms/submission-confirmation";

export const dynamic = "force-dynamic";

/** U7 Solicitud enviada. GET only: refreshing this page can never submit again. */
export default async function EnviadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAccess("new-request");
  const result = await serverGet("/api/tickets/{display_id}", { display_id: id }, await readServerContext());
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`Could not load the ticket (status ${result.status}).`);
  }
  return (
    <AppShell user={user} active="new-request" logout={<LogoutButton />}>
      <SubmissionConfirmation ticket={result.data} />
    </AppShell>
  );
}
