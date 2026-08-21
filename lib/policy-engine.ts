import type { AnalysisConfidence, AnalysisVerdict, EvidenceConsistencyStatus, ExecutionStatus } from "./evidence.ts";
import type { IntentComparison } from "./intent.ts";
import type { AnalysisNetwork } from "./network.ts";
import type { SimulationStatus } from "./okx/simulation.ts";

export const XGUARD_POLICY_ID = "xguard-pre-sign-policy-v1" as const;
export const XGUARD_POLICY_VERSION = "1.0.0" as const;

export const policyDecisions = ["ALLOW", "WARN", "REQUIRE_REVIEW", "BLOCK_RECOMMENDED"] as const;
export type PolicyDecisionState = typeof policyDecisions[number];

export const policyReasonCodes = [
  "DETERMINISTIC_HIGH_RISK",
  "DETERMINISTIC_ELEVATED_RISK",
  "LOW_CONFIDENCE",
  "MEDIUM_CONFIDENCE",
  "VERDICT_UNDETERMINED",
  "EXECUTION_REVERTED",
  "EXECUTION_UNAVAILABLE",
  "INTENT_MISMATCH",
  "INTENT_PARTIAL",
  "EVIDENCE_INCONSISTENT",
  "MAINNET_SIMULATION_UNAVAILABLE",
  "ALLOW_BASELINE"
] as const;

export type PolicyReasonCode = typeof policyReasonCodes[number];

export type PolicyInputs = {
  deterministicScore: number;
  analysisConfidence: AnalysisConfidence;
  analysisVerdict: AnalysisVerdict;
  executionStatus: ExecutionStatus;
  intentStatus: IntentComparison["status"];
  userIntentPresent: boolean;
  evidenceConsistency: EvidenceConsistencyStatus;
  simulationStatus: SimulationStatus;
  analysisNetwork: AnalysisNetwork;
};

export type PolicyDecision = {
  policyId: typeof XGUARD_POLICY_ID;
  policyVersion: typeof XGUARD_POLICY_VERSION;
  decision: PolicyDecisionState;
  reasonCodes: PolicyReasonCode[];
  inputs: PolicyInputs;
  aiInfluencedDecision: false;
};

export function evaluatePreSignPolicy(inputs: PolicyInputs): PolicyDecision {
  const reasonCodes: PolicyReasonCode[] = [];
  if (inputs.deterministicScore >= 70) reasonCodes.push("DETERMINISTIC_HIGH_RISK");
  else if (inputs.deterministicScore >= 30) reasonCodes.push("DETERMINISTIC_ELEVATED_RISK");
  if (inputs.analysisConfidence === "LOW") reasonCodes.push("LOW_CONFIDENCE");
  else if (inputs.analysisConfidence === "MEDIUM") reasonCodes.push("MEDIUM_CONFIDENCE");
  if (inputs.analysisVerdict === "UNDETERMINED") reasonCodes.push("VERDICT_UNDETERMINED");
  if (inputs.executionStatus === "REVERTED") reasonCodes.push("EXECUTION_REVERTED");
  else if (inputs.executionStatus === "UNAVAILABLE") reasonCodes.push("EXECUTION_UNAVAILABLE");
  if (inputs.userIntentPresent && inputs.intentStatus === "MISMATCH") reasonCodes.push("INTENT_MISMATCH");
  else if (inputs.userIntentPresent && inputs.intentStatus === "PARTIAL") reasonCodes.push("INTENT_PARTIAL");
  if (inputs.evidenceConsistency === "INCONSISTENT") reasonCodes.push("EVIDENCE_INCONSISTENT");
  if (inputs.analysisNetwork === "XLAYER_MAINNET" && inputs.simulationStatus !== "AVAILABLE") reasonCodes.push("MAINNET_SIMULATION_UNAVAILABLE");

  let decision: PolicyDecisionState;
  if (inputs.deterministicScore >= 70) decision = "BLOCK_RECOMMENDED";
  else if (reasonCodes.some((code) => ["LOW_CONFIDENCE", "VERDICT_UNDETERMINED", "EXECUTION_REVERTED", "EXECUTION_UNAVAILABLE", "INTENT_MISMATCH", "EVIDENCE_INCONSISTENT", "MAINNET_SIMULATION_UNAVAILABLE"].includes(code))) decision = "REQUIRE_REVIEW";
  else if (reasonCodes.some((code) => ["DETERMINISTIC_ELEVATED_RISK", "MEDIUM_CONFIDENCE", "INTENT_PARTIAL"].includes(code))) decision = "WARN";
  else {
    decision = "ALLOW";
    reasonCodes.push("ALLOW_BASELINE");
  }

  return {
    policyId: XGUARD_POLICY_ID,
    policyVersion: XGUARD_POLICY_VERSION,
    decision,
    reasonCodes,
    inputs: {
      deterministicScore: inputs.deterministicScore,
      analysisConfidence: inputs.analysisConfidence,
      analysisVerdict: inputs.analysisVerdict,
      executionStatus: inputs.executionStatus,
      intentStatus: inputs.intentStatus,
      userIntentPresent: inputs.userIntentPresent,
      evidenceConsistency: inputs.evidenceConsistency,
      simulationStatus: inputs.simulationStatus,
      analysisNetwork: inputs.analysisNetwork
    },
    aiInfluencedDecision: false
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export function isPolicyDecision(value: unknown): value is PolicyDecision {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["policyId", "policyVersion", "decision", "reasonCodes", "inputs", "aiInfluencedDecision"])) return false;
  if (value.policyId !== XGUARD_POLICY_ID || value.policyVersion !== XGUARD_POLICY_VERSION || value.aiInfluencedDecision !== false || !policyDecisions.includes(value.decision as PolicyDecisionState)) return false;
  if (!Array.isArray(value.reasonCodes) || value.reasonCodes.length === 0 || !value.reasonCodes.every((code) => policyReasonCodes.includes(code as PolicyReasonCode))) return false;
  if (!isPlainRecord(value.inputs) || !hasOnlyKeys(value.inputs, ["deterministicScore", "analysisConfidence", "analysisVerdict", "executionStatus", "intentStatus", "userIntentPresent", "evidenceConsistency", "simulationStatus", "analysisNetwork"])) return false;
  const inputs = value.inputs;
  const validInputs = typeof inputs.deterministicScore === "number" && Number.isInteger(inputs.deterministicScore) && inputs.deterministicScore >= 0 && inputs.deterministicScore <= 100
    && ["HIGH", "MEDIUM", "LOW"].includes(String(inputs.analysisConfidence))
    && ["ASSESSED", "UNDETERMINED"].includes(String(inputs.analysisVerdict))
    && ["SUCCEEDED", "REVERTED", "UNAVAILABLE"].includes(String(inputs.executionStatus))
    && ["MATCH", "PARTIAL", "MISMATCH", "UNKNOWN"].includes(String(inputs.intentStatus))
    && typeof inputs.userIntentPresent === "boolean"
    && ["CONSISTENT", "INCONSISTENT", "NOT_COMPARABLE"].includes(String(inputs.evidenceConsistency))
    && ["AVAILABLE", "UNAVAILABLE", "UNSUPPORTED", "ERROR"].includes(String(inputs.simulationStatus))
    && ["XLAYER_TESTNET", "XLAYER_MAINNET"].includes(String(inputs.analysisNetwork));
  if (!validInputs) return false;
  const expected = evaluatePreSignPolicy(inputs as PolicyInputs);
  return value.decision === expected.decision
    && value.reasonCodes.length === expected.reasonCodes.length
    && value.reasonCodes.every((code, index) => code === expected.reasonCodes[index]);
}
