import type { RiskInput } from "./risk.ts";
import { normalizeAnalysisNetwork } from "./network.ts";

export type AnalysisSnapshot<T> = {
  result: T | null;
  lastInput: RiskInput | null;
  reviewed: boolean;
};

export const staleAnalysisNotice = "Transaction changed — analyze again.";

export function riskInputsEqual(left: RiskInput, right: RiskInput) {
  return left.from === right.from
    && left.to === right.to
    && left.value === right.value
    && left.data === right.data
    && left.context === right.context
    && normalizeAnalysisNetwork(left.analysisNetwork) === normalizeAnalysisNetwork(right.analysisNetwork);
}

export function currentAnalysisResult<T>(snapshot: AnalysisSnapshot<T>, currentInput: RiskInput) {
  return snapshot.result && snapshot.lastInput && riskInputsEqual(snapshot.lastInput, currentInput) ? snapshot.result : null;
}

export function invalidateStaleAnalysis<T>(snapshot: AnalysisSnapshot<T>, currentInput: RiskInput) {
  const hasAnalysis = snapshot.result !== null || snapshot.lastInput !== null;
  const changed = hasAnalysis && (!snapshot.lastInput || !riskInputsEqual(snapshot.lastInput, currentInput));
  if (!changed) return { invalidated: false as const, snapshot, notice: "" };
  return {
    invalidated: true as const,
    snapshot: { result: null, lastInput: null, reviewed: false } satisfies AnalysisSnapshot<T>,
    notice: staleAnalysisNotice
  };
}
