/**
 * Static sample asset names ("Datos de ejemplo"): the backend only exposes the asset id.
 * Keyed by the seed ids; any other id falls back to the raw id (see `assetLabel`).
 * adapted: the mock's AT-* ids are not in the seed, so names are keyed by the seed ids.
 */
export type AssetKind = "pc" | "printer" | "monitor" | "phone";
export type SampleAsset = { name: string; kind: AssetKind };

const SAMPLE_ASSETS: Record<string, SampleAsset> = {
  "PC-0412": { name: "Computadora de escritorio", kind: "pc" },
  "IMP-0107": { name: "Impresora", kind: "printer" },
  "MON-0238": { name: "Monitor", kind: "monitor" },
  "TEL-0061": { name: "Teléfono IP", kind: "phone" },
};

export function sampleAsset(id: string): SampleAsset | undefined {
  return Object.hasOwn(SAMPLE_ASSETS, id) ? SAMPLE_ASSETS[id] : undefined;
}

/** The sample name of an asset, or its raw id when it is not in the sample map. */
export function assetLabel(id: string): string {
  return sampleAsset(id)?.name ?? id;
}
