import type { ContractIntelligence } from "./chain/intelligence.ts";
import type { TransactionConsequence } from "./consequence.ts";
import type { RiskInput, RiskLevel, RiskResult, RiskSignal } from "./risk.ts";

export type AnalysisConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ExecutionStatus = "SUCCEEDED" | "REVERTED" | "UNAVAILABLE";
export type AnalysisVerdict = "ASSESSED" | "UNDETERMINED";

export type AnalysisEvidence = {
  transaction: RiskInput;
  decodedAction: RiskResult["decodedAction"];
  deterministicSignals: {
    score: number;
    level: RiskLevel;
    critical: RiskSignal[];
    advisory: RiskSignal[];
  };
  consequences: TransactionConsequence[];
  contract: {
    addressType: ContractIntelligence["addressType"];
    codePresent: boolean | null;
    codeSizeBytes: number | null;
    eip1967Implementation: string | null;
    proxyDetected: boolean | null;
  };
  execution: {
    status: ExecutionStatus;
    revertReason: string | null;
    estimatedGas: string | null;
    rpcStatus: ContractIntelligence["rpcStatus"];
  };
};

export type AnalysisDimensions = {
  analysisConfidence: AnalysisConfidence;
  analysisVerdict: AnalysisVerdict;
  executionStatus: ExecutionStatus;
};

function copySignal(signal: RiskSignal): RiskSignal {
  return { id: signal.id, source: signal.source, severity: signal.severity, title: signal.title, detail: signal.detail };
}

export function deriveAnalysisDimensions(result: RiskResult, intelligence: ContractIntelligence): AnalysisDimensions {
  const undecodable = result.decodedAction.status === "unknown" || result.decodedAction.status === "malformed";
  const analysisVerdict: AnalysisVerdict = undecodable ? "UNDETERMINED" : "ASSESSED";
  let analysisConfidence: AnalysisConfidence;
  if (undecodable) analysisConfidence = "LOW";
  else if (intelligence.rpcStatus !== "AVAILABLE" || intelligence.proxyDetected !== false) analysisConfidence = "MEDIUM";
  else analysisConfidence = "HIGH";
  return { analysisConfidence, analysisVerdict, executionStatus: intelligence.preflightStatus };
}

export function buildAnalysisEvidence(
  input: RiskInput,
  deterministicRisk: RiskResult,
  consequences: TransactionConsequence[],
  intelligence: ContractIntelligence
): AnalysisEvidence {
  return {
    transaction: { from: input.from, to: input.to, value: input.value, data: input.data, context: input.context },
    decodedAction: { ...deterministicRisk.decodedAction },
    deterministicSignals: {
      score: deterministicRisk.deterministicScore,
      level: deterministicRisk.level,
      critical: deterministicRisk.criticalSignals.map(copySignal),
      advisory: deterministicRisk.advisorySignals.map(copySignal)
    },
    consequences: consequences.map((item) => ({ ...item })),
    contract: {
      addressType: intelligence.addressType,
      codePresent: intelligence.codePresent,
      codeSizeBytes: intelligence.codeSizeBytes,
      eip1967Implementation: intelligence.implementationAddress ?? null,
      proxyDetected: intelligence.proxyDetected
    },
    execution: {
      status: intelligence.preflightStatus,
      revertReason: intelligence.revertReason ?? null,
      estimatedGas: intelligence.estimatedGas ?? null,
      rpcStatus: intelligence.rpcStatus
    }
  };
}
