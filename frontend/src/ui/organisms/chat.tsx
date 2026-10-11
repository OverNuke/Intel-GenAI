"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";

export type ChatLine = { role: "user" | "assistant"; content: string };

/** Chat thread + composer. New turns are announced politely (aria-live) to screen readers. */
export function Chat({
  messages,
  busy,
  onSend,
  footer,
}: {
  messages: ChatLine[];
  busy: boolean;
  onSend: (text: string) => void;
  /** Rendered under the composer inside the chat shell (U6: the IT handoff actions). */
  footer?: ReactNode;
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

  const who = (
    <>
      <Icon name="sparkles" size="sm" />
      {COPY.chat.ariadna}
    </>
  );

  return (
    <div className="conversation">
      <div role="log" aria-live="polite" aria-relevant="additions" className="chat-thread">
        <ol className="plain-list">
          {messages.map((message, index) => {
            const isNew = messages.length > 1 && index === messages.length - 1;
            const classes = ["msg", message.role === "user" ? "msg--user" : "", isNew ? "is-new" : ""];
            return (
              <li key={index} className={classes.filter(Boolean).join(" ")}>
                <span className="msg-who">{message.role === "assistant" ? who : COPY.chat.you}</span>
                <span className="msg-text">{message.content}</span>
              </li>
            );
          })}
          {busy ? (
            <li className="msg is-new">
              <span className="msg-who">{who}</span>
              <span className="msg-text">{COPY.chat.typing}</span>
            </li>
          ) : null}
        </ol>
      </div>
      <div className="composer">
        <label className="sr" htmlFor="chat-input">
          {COPY.chat.yourAnswer}
        </label>
        <textarea
          id="chat-input"
          className="input"
          rows={1}
          placeholder={COPY.chat.replyPlaceholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="icon-btn icon-btn--outline"
          aria-label={COPY.chat.sendReply}
          aria-busy={busy ? "true" : undefined}
          onClick={busy ? undefined : send}
        >
          <Icon name="send-horizontal" />
        </button>
      </div>
      {footer ? <div className="conversation-footer">{footer}</div> : null}
    </div>
  );
}
