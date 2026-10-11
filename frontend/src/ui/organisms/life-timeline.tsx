import { COPY } from "@/lib/copy";
import type { LifeStage } from "@/lib/life-stages";
import { Stepper } from "../molecules/stepper";

/** U3 timeline: the five life stages with date and who took the ticket (list named "Línea de tiempo"). */
export function LifeTimeline({ stages }: { stages: LifeStage[] }) {
  const steps = stages.map((stage) => ({
    label: stage.label,
    state: stage.state,
    word: stage.word,
    ...(stage.note ? { note: stage.note } : {}),
  }));
  return <Stepper steps={steps} variant="vertical" label={COPY.detail.timeline} />;
}
