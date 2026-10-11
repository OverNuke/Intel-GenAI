"use client";

import type { KeyboardEvent } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "@/lib/copy";
import { draftSteps, type DraftField, type DraftFields, type Touched } from "@/lib/merge-draft";
import { Icon, type IconName } from "../atoms/icon";
import { Stepper } from "../molecules/stepper";

type Service = components["schemas"]["ServiceOut"];
type Level = "low" | "medium" | "high";

const LEVELS: Level[] = ["low", "medium", "high"];
const IMPACT_ICONS: Record<Level, IconName> = { low: "user", medium: "users", high: "building-2" };
const URGENCY_ICONS: Record<Level, IconName> = { low: "signal-low", medium: "signal-medium", high: "signal-high" };

/** Assist / to-do tag shown in the field head; `id` is what the control's aria-describedby points at. */
function Origin({ id, value, touched }: { id: string; value: string | null; touched: boolean }) {
  let tag = null;
  if (!value) {
    tag = <span className="todo-tag">{COPY.request.toComplete}</span>;
  } else if (!touched) {
    tag = (
      <span className="assist-tag">
        <Icon name="sparkles" size="sm" />
        {COPY.chat.assistantFilled}
      </span>
    );
  }
  return <span id={id}>{tag}</span>;
}

function LevelGroup({
  prefix,
  label,
  hint,
  labels,
  descriptions,
  icons,
  value,
  touched,
  onPick,
}: {
  prefix: string;
  label: string;
  hint: string;
  labels: Record<Level, string>;
  descriptions: Record<Level, string>;
  icons: Record<Level, IconName>;
  value: Level | null;
  touched: boolean;
  onPick: (level: Level) => void;
}) {
  // Arrow keys move the selection like a native radio group (also where the browser does not).
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const next = (index + (forward ? 1 : LEVELS.length - 1)) % LEVELS.length;
    onPick(LEVELS[next]!);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    group?.querySelectorAll<HTMLInputElement>("input[type=radio]")[next]?.focus();
  }

  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label" id={`${prefix}-label`}>
          {label}
        </span>
        <Origin id={`${prefix}-tag`} value={value} touched={touched} />
      </div>
      <p className="t-meta" id={`${prefix}-hint`}>
        {hint}
      </p>
      <div
        id={`${prefix}-group`}
        role="radiogroup"
        aria-labelledby={`${prefix}-label`}
        aria-describedby={`${prefix}-hint`}
        className="opt-group"
      >
        {LEVELS.map((level, index) => (
          <label key={level} className="opt-tile">
            <input
              type="radio"
              name={`level-${label}`}
              checked={value === level}
              aria-labelledby={`${prefix}-${level}-name`}
              aria-describedby={`${prefix}-${level}-desc`}
              onChange={() => onPick(level)}
              onKeyDown={(event) => onKeyDown(event, index)}
            />
            <Icon name={icons[level]} />
            <span className="opt-name" id={`${prefix}-${level}-name`}>
              {labels[level]}
              <span className="opt-check">
                <Icon name="circle-check" size="sm" />
              </span>
            </span>
            <span className="opt-desc" id={`${prefix}-${level}-desc`}>
              {descriptions[level]}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** "Tu solicitud": the editable draft. Edits are reported per field and win over later turns. */
export function RequestDraftForm({
  draft,
  touched,
  services,
  requesterName,
  onEdit,
}: {
  draft: DraftFields;
  touched: Touched;
  services: Service[];
  requesterName: string;
  onEdit: (field: DraftField, value: string | null) => void;
}) {
  const steps = draftSteps(draft).map((step, index) => ({
    ...step,
    num: index + 1,
    word: COPY.stepWords[step.state],
  }));

  return (
    <section aria-labelledby="draft-title" className="form-panel">
      <div className="sec-head">
        <h2 id="draft-title">{COPY.request.yourRequest}</h2>
        <span className="t-meta">{COPY.request.notSentYet}</span>
      </div>
      <p className="t-meta">{COPY.chat.draftNotSaved}</p>

      <div className="band">
        <Stepper steps={steps} variant="full" label={COPY.request.bandLabel} />
      </div>

      <div className="form-grid">
        <div className="field field--span">
          <div className="field-head">
            <label className="field-label" htmlFor="f-requester">
              {COPY.detail.requester}
            </label>
            <span className="t-meta row">
              <Icon name="lock" size="sm" />
              {COPY.request.readOnly}
            </span>
          </div>
          <input id="f-requester" className="input" value={requesterName} readOnly />
        </div>

        <div className="field field--span">
          <div className="field-head">
            <label className="field-label" htmlFor="f-service">
              {COPY.chat.service}
            </label>
            <Origin id="tag-service" value={draft.service} touched={touched.service} />
          </div>
          <select
            id="f-service"
            className="input"
            aria-describedby="tag-service"
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
        </div>

        <div className="field field--span">
          <div className="field-head">
            <label className="field-label" htmlFor="f-summary">
              {COPY.request.summary}
            </label>
            <Origin id="tag-summary" value={draft.summary} touched={touched.summary} />
          </div>
          <div className="input-wrap">
            <Icon name="ticket" />
            <input
              id="f-summary"
              className="input"
              aria-describedby="tag-summary"
              maxLength={200}
              value={draft.summary}
              onChange={(event) => onEdit("summary", event.target.value)}
            />
          </div>
        </div>

        <div className="field field--span">
          <div className="field-head">
            <label className="field-label" htmlFor="f-desc">
              {COPY.detail.description}
            </label>
            <Origin id="tag-desc" value={draft.description} touched={touched.description} />
          </div>
          <textarea
            id="f-desc"
            className="input"
            aria-describedby="tag-desc"
            rows={4}
            value={draft.description}
            onChange={(event) => onEdit("description", event.target.value)}
          />
        </div>

        <LevelGroup
          prefix="impact"
          label={COPY.detail.impact}
          hint={COPY.request.impactHint}
          labels={COPY.impact}
          descriptions={COPY.request.impactDesc}
          icons={IMPACT_ICONS}
          value={draft.impact}
          touched={touched.impact}
          onPick={(level) => onEdit("impact", level)}
        />
        <LevelGroup
          prefix="urgency"
          label={COPY.detail.urgency}
          hint={COPY.request.urgencyHint}
          labels={COPY.urgency}
          descriptions={COPY.request.urgencyDesc}
          icons={URGENCY_ICONS}
          value={draft.urgency}
          touched={touched.urgency}
          onPick={(level) => onEdit("urgency", level)}
        />
      </div>
    </section>
  );
}
