import type { ContractIntelligence } from "./chain/intelligence.ts";
import type { TransactionConsequence } from "./consequence.ts";
import { getAnalysisNetworkConfig, normalizeAnalysisNetwork, type AnalysisNetwork } from "./network.ts";
import type { SimulationEvidence } from "./okx/simulation.ts";
import type { RiskInput, RiskLevel, RiskResult, RiskSignal } from "./risk.ts";

export type AnalysisConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ExecutionStatus = "SUCCEEDED" | "REVERTED" | "UNAVAILABLE";
export type AnalysisVerdict = "ASSESSED" | "UNDETERMINED";
export type EvidenceConsistencyStatus = "CONSISTENT" | "INCONSISTENT" | "NOT_COMPARABLE";

export type EvidenceConsistency = {
  status: EvidenceConsistencyStatus;
  reasons: string[];
};

export type AnalysisEvidence = {
  network: { network: AnalysisNetwork; chainId: 1952 | 196 };
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
  simulation: SimulationEvidence;
  evidenceConsistency: EvidenceConsistency;
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

export function deriveEvidenceConsistency(intelligence: ContractIntelligence, simulation: SimulationEvidence): EvidenceConsistency {
  if (simulation.status !== "AVAILABLE" || intelligence.preflightStatus === "UNAVAILABLE") return { status: "NOT_COMPARABLE", reasons: [] };
  const simulationFailed = Boolean(simulation.failReason);
  if (intelligence.preflightStatus === "SUCCEEDED" && simulationFailed) {
    return { status: "INCONSISTENT", reasons: ["RPC preflight succeeded while OKX simulation returned a failure reason"] };
  }
  if (intelligence.preflightStatus === "REVERTED" && !simulationFailed) {
    return { status: "INCONSISTENT", reasons: ["RPC preflight reverted while OKX simulation returned no failure reason"] };
  }
  return { status: "CONSISTENT", reasons: [] };
}

export function deriveAnalysisDimensions(result: RiskResult, intelligence: ContractIntelligence, simulation?: SimulationEvidence): AnalysisDimensions {
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
  if (simulation) {
    const consistency = deriveEvidenceConsistency(intelligence, simulation);
    if (simulation.status === "AVAILABLE" && simulation.failReason) {
      if (analysisConfidence === "HIGH") analysisConfidence = "MEDIUM";
      confidenceReasons.push("OKX simulation returned a failure reason; this does not by itself imply maliciousness");
    }
    if (consistency.status === "INCONSISTENT") {
      if (analysisConfidence === "HIGH") analysisConfidence = "MEDIUM";
      confidenceReasons.push(...consistency.reasons, "RPC preflight and OKX simulation require manual reconciliation");
    }
  }
  return { analysisConfidence, analysisVerdict, executionStatus: intelligence.preflightStatus, confidenceReasons: Array.from(new Set(confidenceReasons)) };
}

export function buildAnalysisEvidence(
  input: RiskInput,
  deterministicRisk: RiskResult,
  consequences: TransactionConsequence[],
  intelligence: ContractIntelligence,
  simulation?: SimulationEvidence
): AnalysisEvidence {
  const network = normalizeAnalysisNetwork(input.analysisNetwork);
  const networkConfig = getAnalysisNetworkConfig(network);
  const normalizedSimulation: SimulationEvidence = simulation ?? {
    provider: "OKX_ONCHAINOS",
    network,
    chainId: networkConfig.chainId,
    chainIndex: networkConfig.okxChainIndex,
    status: networkConfig.simulationSupported ? "UNAVAILABLE" : "UNSUPPORTED",
    statusDetail: networkConfig.simulationSupported ? "OKX simulation was not requested" : "OKX Transaction Simulation is not supported for X Layer Testnet",
    intention: null,
    assetChanges: [],
    gasUsed: null,
    failReason: null,
    risks: [],
    observedAt: new Date(0).toISOString(),
    durationMs: 0,
    httpStatus: null,
    businessCode: null
  };
  return {
    network: { network, chainId: networkConfig.chainId },
    transaction: { from: input.from, to: input.to, value: input.value, data: input.data, context: input.context, analysisNetwork: network },
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
    },
    simulation: {
      ...normalizedSimulation,
      assetChanges: normalizedSimulation.assetChanges.map((item) => ({ ...item })),
      risks: normalizedSimulation.risks.map((item) => ({ ...item }))
    },
    evidenceConsistency: deriveEvidenceConsistency(intelligence, normalizedSimulation)
  };
}
