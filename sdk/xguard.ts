import { isPolicyDecision, type PolicyDecision, type PolicyDecisionState } from "../lib/policy-engine.ts";
import type { RiskInput } from "../lib/risk.ts";

export type XGuardAnalysisResponse = Record<string, unknown> & {
  policyDecision: PolicyDecision;
};

export type AnalyzeWithXGuardOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export async function analyzeWithXGuard(input: RiskInput, options: AnalyzeWithXGuardOptions = {}): Promise<XGuardAnalysisResponse> {
  const response = await (options.fetchImpl ?? fetch)(options.endpoint ?? "/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: options.signal
  });
  if (!response.ok) throw new Error(`XGuard analysis failed with HTTP ${response.status}`);
  const result = await response.json() as Record<string, unknown>;
  if (!isPolicyDecision(result.policyDecision)) throw new Error("XGuard returned an invalid policy decision");
  return result as XGuardAnalysisResponse;
}

export function getPolicyAction(result: Pick<XGuardAnalysisResponse, "policyDecision">): PolicyDecisionState {
  if (!isPolicyDecision(result.policyDecision)) throw new Error("XGuard policy decision is invalid");
  return result.policyDecision.decision;
}

export { isPolicyDecision } from "../lib/policy-engine.ts";
export type { PolicyDecision, PolicyDecisionState, PolicyReasonCode } from "../lib/policy-engine.ts";
export type { RiskInput } from "../lib/risk.ts";
