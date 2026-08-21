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
    tokenStandard: ContractIntelligence["tokenStandard"];
    tokenStandardSource: ContractIntelligence["tokenStandardSource"];
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
  confidenceReasons: string[];
};

function copySignal(signal: RiskSignal): RiskSignal {
  return { id: signal.id, source: signal.source, severity: signal.severity, title: signal.title, detail: signal.detail };
}

export function deriveAnalysisDimensions(result: RiskResult, intelligence: ContractIntelligence): AnalysisDimensions {
  const undecodable = result.decodedAction.status === "unknown" || result.decodedAction.status === "malformed";
  const standardAmbiguity = result.decodedAction.assetStandard === "UNKNOWN"
    && (result.decodedAction.method === "approve(address,uint256)" || result.decodedAction.method === "transferFrom(address,address,uint256)");
  const analysisVerdict: AnalysisVerdict = undecodable || standardAmbiguity ? "UNDETERMINED" : "ASSESSED";
  let analysisConfidence: AnalysisConfidence;
  const confidenceReasons: string[] = [];
  if (result.decodedAction.status === "unknown") {
    analysisConfidence = "LOW";
    confidenceReasons.push("Unsupported selector prevents deterministic method interpretation");
  } else if (result.decodedAction.status === "malformed") {
    analysisConfidence = "LOW";
    confidenceReasons.push("Malformed calldata prevents safe argument decoding");
  } else if (standardAmbiguity) {
    analysisConfidence = "LOW";
    confidenceReasons.push("Token standard could not be confirmed and changes uint256 semantics");
  }
  else if (intelligence.rpcStatus !== "AVAILABLE" || intelligence.proxyDetected !== false) analysisConfidence = "MEDIUM";
  else analysisConfidence = "HIGH";
  if (analysisConfidence === "HIGH") {
    confidenceReasons.push("Method semantics decoded", "RPC evidence available", "No unresolved proxy or token-standard ambiguity");
  } else if (!undecodable && !standardAmbiguity) {
    confidenceReasons.push(intelligence.rpcStatus === "UNAVAILABLE" ? "RPC evidence unavailable" : intelligence.rpcStatus === "PARTIAL" ? "RPC evidence is partial" : "RPC evidence available");
    if (intelligence.proxyDetected === true) confidenceReasons.push("EIP-1967 implementation detected; implementation behavior is not fully inspected");
    else if (intelligence.proxyDetected === null) confidenceReasons.push("EIP-1967 implementation observation is incomplete");
  }
  if (intelligence.preflightStatus === "SUCCEEDED") confidenceReasons.push("Current-state preflight call succeeded");
  else if (intelligence.preflightStatus === "REVERTED") confidenceReasons.push("Current-state preflight call reverted");
  else confidenceReasons.push("Current-state execution could not be evaluated");
  return { analysisConfidence, analysisVerdict, executionStatus: intelligence.preflightStatus, confidenceReasons: Array.from(new Set(confidenceReasons)) };
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
      proxyDetected: intelligence.proxyDetected,
      tokenStandard: intelligence.tokenStandard,
      tokenStandardSource: intelligence.tokenStandardSource
    },
    execution: {
      status: intelligence.preflightStatus,
      revertReason: intelligence.revertReason ?? null,
      estimatedGas: intelligence.estimatedGas ?? null,
      rpcStatus: intelligence.rpcStatus
    }
  };
}
