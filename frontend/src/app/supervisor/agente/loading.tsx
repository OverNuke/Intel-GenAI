import { COPY } from "@/lib/copy";
import { EmptyState } from "@/ui/molecules/empty-state";

/** Streaming fallback while the two metric reports load. */
export default function Loading() {
  return <EmptyState message={COPY.metrics.loading} busy />;
}
