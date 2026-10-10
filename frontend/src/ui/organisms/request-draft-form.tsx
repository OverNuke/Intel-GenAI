"use client";

import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import type { DraftField, DraftFields, Touched } from "@/lib/merge-draft";

type Service = components["schemas"]["ServiceOut"];
type Level = "low" | "medium" | "high";

const LEVELS: Level[] = ["low", "medium", "high"];

function Origin({ value, touched }: { value: string | null; touched: boolean }) {
  if (!value) return <span className="t-meta">{COPY.request.toComplete}</span>;
  return touched ? null : <span className="t-meta">{COPY.chat.assistantFilled}</span>;
}

function LevelGroup({
  label,
  labels,
  value,
  touched,
  onPick,
}: {
  label: string;
  labels: Record<Level, string>;
  value: Level | null;
  touched: boolean;
  onPick: (level: Level) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="chip-row">
        {LEVELS.map((level) => (
          <label key={level} className="chip">
            <input
              type="radio"
              name={`level-${label}`}
              checked={value === level}
              onChange={() => onPick(level)}
            />
            {labels[level]}
          </label>
        ))}
      </div>
      <Origin value={value} touched={touched} />
    </div>
  );
}

/** "Tu solicitud": the editable draft. Edits are reported per field and win over later turns. */
export function RequestDraftForm({
  draft,
  touched,
  services,
  onEdit,
}: {
  draft: DraftFields;
  touched: Touched;
  services: Service[];
  onEdit: (field: DraftField, value: string | null) => void;
}) {
  return (
    <section aria-labelledby="draft-title" className="card stack">
      <h2 id="draft-title">{COPY.request.yourRequest}</h2>
      <p className="t-meta">{COPY.chat.draftNotSaved}</p>

      <div className="field">
        <label htmlFor="f-service">{COPY.chat.service}</label>
        <select
          id="f-service"
          className="input"
          value={draft.service ?? ""}
          onChange={(event) => onEdit("service", event.target.value || null)}
        >
          <option value="">{COPY.request.toComplete}</option>
          {services.map((service) => (
            <option key={service.key} value={service.key}>
              {service.label}
            </option>
          ))}
        </select>
        <Origin value={draft.service} touched={touched.service} />
      </div>

      <div className="field">
        <label htmlFor="f-summary">{COPY.request.summary}</label>
        <input
          id="f-summary"
          className="input"
          maxLength={200}
          value={draft.summary}
          onChange={(event) => onEdit("summary", event.target.value)}
        />
        <Origin value={draft.summary} touched={touched.summary} />
      </div>

      <div className="field">
        <label htmlFor="f-desc">{COPY.detail.description}</label>
        <textarea
          id="f-desc"
          className="input"
          rows={4}
          value={draft.description}
          onChange={(event) => onEdit("description", event.target.value)}
        />
        <Origin value={draft.description} touched={touched.description} />
      </div>

      <LevelGroup
        label={COPY.detail.impact}
        labels={COPY.impact}
        value={draft.impact}
        touched={touched.impact}
        onPick={(level) => onEdit("impact", level)}
      />
      <LevelGroup
        label={COPY.detail.urgency}
        labels={COPY.urgency}
        value={draft.urgency}
        touched={touched.urgency}
        onPick={(level) => onEdit("urgency", level)}
      />
    </section>
  );
}
