"use client";

import { useState, type KeyboardEvent } from "react";
import { COPY } from "@/lib/copy";
import { Button } from "../atoms/button";

export type ChatLine = { role: "user" | "assistant"; content: string };

/** Chat thread + composer. New turns are announced politely (aria-live) to screen readers. */
export function Chat({
  messages,
  busy,
  onSend,
}: {
  messages: ChatLine[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    send();
  }

  return (
    <div className="stack">
      <div role="log" aria-live="polite" aria-relevant="additions" className="chat-thread">
        <ol className="plain-list">
          {messages.map((message, index) => (
            <li key={index} className={`chat-message is-${message.role}`}>
              <span className="t-meta">{message.role === "assistant" ? COPY.chat.ariadna : COPY.chat.you}</span>
              <span>{message.content}</span>
            </li>
          ))}
        </ol>
        {busy ? <p className="t-meta">{COPY.chat.typing}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="chat-input">{COPY.chat.yourAnswer}</label>
        <textarea
          id="chat-input"
          className="input"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="actions">
        <Button busy={busy} onClick={send}>
          {COPY.chat.reply}
        </Button>
      </div>
    </div>
  );
}
