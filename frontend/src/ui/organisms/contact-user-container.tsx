"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { Button } from "../atoms/button";
import { TicketRecord } from "./ticket-record";

type Record = components["schemas"]["ItTicketOut"];

/** T2 container: owns the record and the contact panel. State always comes back from the API. */
export function ContactUserContainer({
  initial,
  fetchImpl,
}: {
  initial: Record;
  fetchImpl?: typeof fetch;
}) {
  const [record, setRecord] = useState<Record>(initial);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => fetch(...args));

  async function send() {
    setBusy(true);
    setError(null);
    const trimmed = message.trim();
    const result = await apiPost(
      "/api/it/tickets/{display_id}/contact",
      trimmed ? { message: trimmed } : {},
      doFetch,
      { params: { display_id: record.id } },
    );
    setBusy(false);
    if (result.ok) {
      setRecord(result.data);
      setOpen(false);
      setMessage("");
      return;
    }
    setError(result.status === 409 ? COPY.it.contactFinished : COPY.it.contactError);
  }

  return (
    <div className="stack">
      <TicketRecord ticket={record} onContact={() => setOpen(true)} />
      {open ? (
        <section aria-labelledby="contact-title" className="card stack">
          <h2 id="contact-title">{`${COPY.it.contactTitle} ${record.requester_name}`}</h2>
          <p className="t-meta">{COPY.it.contactHelp}</p>
          <div className="field">
            <label htmlFor="contact-message">{COPY.it.contactLabel}</label>
            <textarea
              id="contact-message"
              className="input"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="callout">
              {error}
            </p>
          ) : null}
          <div className="actions">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {COPY.it.contactCancel}
            </Button>
            <Button busy={busy} busyLabel="Enviando…" onClick={() => void send()}>
              {COPY.it.contactSend}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
