import type { Hex } from "viem";

export type RecordPhase = "idle" | "awaiting-signature" | "submitted" | "confirming" | "confirmed" | "reverted" | "error";

export type RecordState = {
  phase: RecordPhase;
  hash?: Hex;
  error?: string;
};

export type RecordEvent =
  | { type: "RESET" }
  | { type: "SIGNATURE_REQUESTED" }
  | { type: "SUBMITTED"; hash: Hex }
  | { type: "CONFIRMING" }
  | { type: "CONFIRMED" }
  | { type: "REVERTED" }
  | { type: "FAILED"; error: string };

export const initialRecordState: RecordState = { phase: "idle" };

export function reduceRecordState(state: RecordState, event: RecordEvent): RecordState {
  if (event.type === "RESET") return initialRecordState;
  if (event.type === "SIGNATURE_REQUESTED") return { phase: "awaiting-signature" };
  if (event.type === "SUBMITTED") return { phase: "submitted", hash: event.hash };
  if (event.type === "CONFIRMING") return { phase: "confirming", hash: state.hash };
  if (event.type === "CONFIRMED") return { phase: "confirmed", hash: state.hash };
  if (event.type === "REVERTED") return { phase: "reverted", hash: state.hash, error: "Transaction reverted on X Layer Testnet." };
  return { phase: "error", hash: state.hash, error: event.error };
}

export function isRecordPending(state: RecordState) {
  return state.phase === "awaiting-signature" || state.phase === "submitted" || state.phase === "confirming";
}
