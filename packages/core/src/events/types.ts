/**
 * Event and summary types for vNext streaming and final outputs.
 */
import type { Hint, ProviderId } from "../contracts/provider.js";

/** NDJSON event (streaming). Consumed by the extension and CI. */
export interface OpdEvent {
  readonly action: "plan" | "doctor" | "deploy" | "start" | "up" | "error";
  readonly provider?: ProviderId;
  readonly phase?: string; // e.g., 'detect', 'build', 'deploy', 'logsUrl', 'done'
  readonly ok?: boolean;
  readonly message?: string;
  readonly url?: string;
  readonly logsUrl?: string;
  readonly hint?: Hint; // optional single hint per event
  readonly timestamp?: string; // ISO string when --timestamps
}

/** Final JSON summary (one per command when --summary-only). */
export interface OpdSummary {
  readonly ok: boolean;
  readonly action: "plan" | "doctor" | "deploy" | "start" | "up" | "error";
  readonly provider?: ProviderId;
  readonly framework?: string;
  readonly publishDir?: string;
  readonly url?: string;
  readonly logsUrl?: string;
  readonly hints?: readonly Hint[];
  readonly final: true;
}
