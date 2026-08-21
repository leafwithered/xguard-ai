import { analyzeTransaction, type AiAdvisoryRiskResult } from "./ai/provider.ts";
import { inspectContract, signalsFromIntelligence, type ContractIntelligence } from "./chain/intelligence.ts";
import { buildTransactionConsequences, type TransactionConsequence } from "./consequence.ts";
import { buildAnalysisEvidence, deriveAnalysisDimensions, deriveEvidenceConsistency, type AnalysisConfidence, type AnalysisEvidence, type AnalysisVerdict, type EvidenceConsistency, type ExecutionStatus } from "./evidence.ts";
import { applyIntentRisk, compareIntentToReality, type IntentComparison } from "./intent.ts";
import { signalsFromSimulation, simulateTransaction, type SimulationEvidence } from "./okx/simulation.ts";
import { localRiskAnalysis, type RiskInput, type RiskResult, type RiskSignal } from "./risk.ts";
import { mergeRiskResults } from "./risk-fusion.ts";
import { createAnalysisReceipt, type AnalysisReceipt } from "./analysis-receipt.ts";

export type AnalysisPipelineResult = RiskResult & {
  analysisConfidence: AnalysisConfidence;
  analysisVerdict: AnalysisVerdict;
  executionStatus: ExecutionStatus;
  confidenceReasons: string[];
  analysisTimings: { rpcMs: number; simulationMs: number; aiMs: number; totalMs: number };
  consequences: TransactionConsequence[];
  intentComparison: IntentComparison;
  contractIntelligence: ContractIntelligence;
  simulationEvidence: SimulationEvidence;
  evidenceConsistency: EvidenceConsistency;
  analysisReceipt: AnalysisReceipt;
};

export type AnalysisPipelineDependencies = {
  inspectContract?: (input: RiskInput) => Promise<ContractIntelligence>;
  simulate?: (input: RiskInput) => Promise<SimulationEvidence>;
  analyzeAi?: (evidence: AnalysisEvidence) => Promise<AiAdvisoryRiskResult | null>;
};

function uniqueSignals(signals: RiskSignal[]) {
  const seen = new Set<string>();
  return signals.filter((item) => {
    const key = `${item.id}:${item.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyFinalSemantics(result: RiskResult, intelligence: ContractIntelligence, simulation: SimulationEvidence, consistency: EvidenceConsistency): RiskResult {
  let adjusted = result;
  if (result.decodedAction.status === "unknown") {
    adjusted = {
      ...result,
      summary: "Transaction behavior is not fully determined because the method selector is unsupported.",
      recommendation: "XGuard cannot fully decode this transaction. A low heuristic score must not be interpreted as confirmation of safety. Verify the method and contract independently before signing."
    };
  } else if (result.decodedAction.status === "malformed") {
    adjusted = {
      ...result,
      summary: "Transaction behavior is undetermined because known calldata is malformed.",
      recommendation: "XGuard cannot safely decode the malformed calldata. Do not rely on its heuristic score; verify or correct the complete encoded arguments before signing."
    };
  } else if (result.decodedAction.assetStandard === "UNKNOWN" && (result.decodedAction.method === "approve(address,uint256)" || result.decodedAction.method === "transferFrom(address,address,uint256)")) {
    adjusted = {
      ...result,
      summary: "Transaction behavior is only partially determined because the shared selector has unresolved token-standard semantics.",
      recommendation: "XGuard cannot confirm whether the uint256 represents fungible-token units or an ERC721 token ID. A low heuristic score must not be interpreted as confirmation of safety; verify the target standard and intended permission or transfer before signing."
    };
  }
  if (intelligence.preflightStatus === "REVERTED") {
    const reason = intelligence.revertReason ? ` ${intelligence.revertReason}.` : "";
    adjusted = {
      ...adjusted,
      summary: `Current-state preflight indicates this call would revert.${reason}`,
      recommendation: `Current-state preflight indicates this call would revert.${reason} This execution result does not by itself imply maliciousness. ${adjusted.recommendation}`
    };
  }
  if (simulation.status === "AVAILABLE" && simulation.failReason) {
    adjusted = {
      ...adjusted,
      summary: `OKX simulation indicates the transaction may fail under the simulated state. ${adjusted.summary}`,
      recommendation: `Review the OKX simulation failure evidence before signing. Simulation failure does not by itself imply maliciousness. ${adjusted.recommendation}`
    };
  }
  if (consistency.status === "INCONSISTENT") {
    adjusted = {
      ...adjusted,
      summary: `RPC preflight and OKX simulation evidence are inconsistent. ${adjusted.summary}`,
      recommendation: `Do not treat this transaction as confirmed safe. Reconcile the RPC preflight and OKX simulation evidence before signing. ${adjusted.recommendation}`
    };
  }
  return adjusted;
}

export async function runAnalysisPipeline(input: RiskInput, dependencies: AnalysisPipelineDependencies = {}): Promise<AnalysisPipelineResult> {
  const inspect = dependencies.inspectContract ?? inspectContract;
  const simulate = dependencies.simulate ?? simulateTransaction;
  const analyzeAi = dependencies.analyzeAi ?? analyzeTransaction;

  const startedAt = Date.now();
  const preliminaryRisk = localRiskAnalysis(input);
  const rpcStartedAt = Date.now();
  const intelligencePromise = inspect(input).then((value) => ({ value, durationMs: Date.now() - rpcStartedAt }));
  const simulationStartedAt = Date.now();
  const simulationPromise = simulate(input).then((value) => ({ value, durationMs: Date.now() - simulationStartedAt }));
  const [intelligenceResult, simulationResult] = await Promise.all([intelligencePromise, simulationPromise]);
  const intelligence = intelligenceResult.value;
  const simulation = simulationResult.value;
  const rpcMs = intelligenceResult.durationMs;
  const simulationMs = simulationResult.durationMs;
  const local = intelligence.tokenStandard === "UNKNOWN"
    ? preliminaryRisk
    : localRiskAnalysis(input, { tokenStandard: intelligence.tokenStandard });
  const onChainSignals = signalsFromIntelligence(intelligence);
  const simulationSignals = signalsFromSimulation(simulation);
  const localWithEvidence: RiskResult = { ...local, advisorySignals: uniqueSignals([...local.advisorySignals, ...onChainSignals, ...simulationSignals]) };
  const consequences = buildTransactionConsequences(input, { decodedAction: local.decodedAction, intelligence, simulation });
  const evidence = buildAnalysisEvidence(input, localWithEvidence, consequences, intelligence, simulation);
  const dimensions = deriveAnalysisDimensions(localWithEvidence, intelligence, simulation);
  const evidenceConsistency = deriveEvidenceConsistency(intelligence, simulation);

  const aiStartedAt = Date.now();
  const aiResult = await analyzeAi(evidence);
  const aiMs = Date.now() - aiStartedAt;
  const intentComparison = compareIntentToReality(input, localWithEvidence.decodedAction, consequences, aiResult?.normalizedIntent);
  const riskWithFinalIntent = applyIntentRisk(localWithEvidence, intentComparison);
  const fusedRisk = mergeRiskResults(riskWithFinalIntent, aiResult);
  const riskResult = applyFinalSemantics(fusedRisk, intelligence, simulation, evidenceConsistency);

  const analysisResult = { ...riskResult, ...dimensions, analysisTimings: { rpcMs, simulationMs, aiMs, totalMs: Date.now() - startedAt }, consequences, intentComparison, contractIntelligence: intelligence, simulationEvidence: simulation, evidenceConsistency };
  const analysisReceipt = await createAnalysisReceipt(input, analysisResult);
  return { ...analysisResult, analysisReceipt };
}
