"use client";

import { useState, type KeyboardEvent } from "react";
import { COPY } from "@/lib/copy";
import { Icon } from "../atoms/icon";

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
            <li key={index} className={message.role === "user" ? "msg msg--user" : "msg"}>
              <span className="msg-who">
                {message.role === "assistant" ? (
                  <>
                    <Icon name="sparkles" size="sm" />
                    {COPY.chat.ariadna}
                  </>
                ) : (
                  COPY.chat.you
                )}
              </span>
              <span className="msg-text">{message.content}</span>
            </li>
          ))}
        </ol>
        {busy ? <p className="t-meta">{COPY.chat.typing}</p> : null}
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
    </div>
  );
}
