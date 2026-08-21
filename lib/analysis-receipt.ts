import type { ContractIntelligence } from "./chain/intelligence.ts";
import type { TransactionConsequence } from "./consequence.ts";
import type { AnalysisConfidence, AnalysisVerdict, EvidenceConsistency, ExecutionStatus } from "./evidence.ts";
import type { IntentComparison } from "./intent.ts";
import { getAnalysisNetworkConfig, normalizeAnalysisNetwork, type AnalysisNetwork } from "./network.ts";
import type { SimulationEvidence } from "./okx/simulation.ts";
import { riskLevelForScore, type RiskInput, type RiskLevel, type RiskResult } from "./risk.ts";

export const ANALYSIS_RECEIPT_TYPE = "xguard.analysis-receipt" as const;
export const ANALYSIS_RECEIPT_SCHEMA_VERSION = "1.0.0" as const;
export const ANALYSIS_RECEIPT_CANONICALIZATION = "xguard-c14n-v1" as const;
export const ANALYSIS_RECEIPT_HASH_ALGORITHM = "SHA-256" as const;
export const ANALYSIS_RECEIPT_MAX_FILE_BYTES = 512 * 1024;
export const ANALYSIS_RECEIPT_INTEGRITY_NOTICE = "Integrity verification confirms that this receipt’s content matches its fingerprint. It does not prove the transaction is safe or that the receipt was signed by XGuard.";

export type AnalysisReceiptSourceType = "DETERMINISTIC_DECODER" | "XLAYER_RPC" | "OKX_ONCHAINOS" | "AI_ADVISORY";

export type AnalysisReceipt = {
  receiptType: typeof ANALYSIS_RECEIPT_TYPE;
  schemaVersion: typeof ANALYSIS_RECEIPT_SCHEMA_VERSION;
  analysisId: string;
  engine: {
    xguardVersion: string;
    ruleVersion: string;
    decoderVersion: string;
  };
  observedAt: string;
  network: {
    analysisNetwork: AnalysisNetwork;
    chainId: 1952 | 196;
  };
  transaction: {
    from: string | null;
    to: string;
    value: string;
    calldata: string;
  };
  assessment: {
    deterministicKnownRisk: { score: number; level: RiskLevel };
    aiAdvisory: { score: number; level: RiskLevel } | null;
    finalRisk: { score: number; level: RiskLevel };
    confidence: AnalysisConfidence;
    verdict: AnalysisVerdict;
    execution: ExecutionStatus;
    recommendation: string;
  };
  evidence: {
    decodedAction: RiskResult["decodedAction"];
    consequences: TransactionConsequence[];
    intentComparison: Omit<IntentComparison, "userIntent">;
    contractIntelligence: ContractIntelligence;
    simulationEvidence: SimulationEvidence;
    evidenceConsistency: EvidenceConsistency;
  };
  provenance: {
    sources: Array<{
      type: AnalysisReceiptSourceType;
      provider: string;
      status: string;
      observedAt: string;
      network: AnalysisNetwork;
    }>;
  };
  integrity: {
    canonicalizationVersion: typeof ANALYSIS_RECEIPT_CANONICALIZATION;
    hashAlgorithm: typeof ANALYSIS_RECEIPT_HASH_ALGORITHM;
    fingerprint: string;
  };
};

export type AnalysisReceiptVerificationStatus = "INTEGRITY VERIFIED" | "INTEGRITY CHECK FAILED" | "UNSUPPORTED RECEIPT VERSION" | "INVALID RECEIPT FORMAT";

export type AnalysisReceiptVerification = {
  status: AnalysisReceiptVerificationStatus;
  receipt: AnalysisReceipt | null;
};

export type AnalysisReceiptSource = RiskResult & {
  analysisConfidence: AnalysisConfidence;
  analysisVerdict: AnalysisVerdict;
  executionStatus: ExecutionStatus;
  consequences: TransactionConsequence[];
  intentComparison: IntentComparison;
  contractIntelligence: ContractIntelligence;
  simulationEvidence: SimulationEvidence;
  evidenceConsistency: EvidenceConsistency;
};

const dangerousKeys = new Set(["__proto__", "constructor", "prototype"]);
const topLevelKeys = ["receiptType", "schemaVersion", "analysisId", "engine", "observedAt", "network", "transaction", "assessment", "evidence", "provenance", "integrity"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasDangerousKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDangerousKey);
  if (!isRecord(value)) return false;
  return Object.keys(value).some((key) => dangerousKeys.has(key) || hasDangerousKey(value[key]));
}

function canonicalizeValue(value: unknown, inArray: boolean): string | undefined {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("xguard-c14n-v1 rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (value === undefined && !inArray) return undefined;
  if (value === undefined) throw new TypeError("xguard-c14n-v1 rejects undefined array entries");
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeValue(item, true)).join(",")}]`;
  if (!isRecord(value)) throw new TypeError("xguard-c14n-v1 supports only JSON-compatible values");
  const entries: string[] = [];
  for (const key of Object.keys(value).sort()) {
    if (dangerousKeys.has(key)) throw new TypeError("xguard-c14n-v1 rejects dangerous object keys");
    const serialized = canonicalizeValue(value[key], false);
    if (serialized !== undefined) entries.push(`${JSON.stringify(key)}:${serialized}`);
  }
  return `{${entries.join(",")}}`;
}

export function canonicalizeAnalysisReceipt(value: unknown) {
  const canonical = canonicalizeValue(value, false);
  if (canonical === undefined) throw new TypeError("xguard-c14n-v1 cannot canonicalize undefined");
  return canonical;
}

function fingerprintPayload(receipt: AnalysisReceipt) {
  const { fingerprint: _fingerprint, ...integrity } = receipt.integrity;
  return { ...receipt, integrity };
}

async function sha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintAnalysisReceipt(receipt: AnalysisReceipt) {
  return `sha256:${await sha256(canonicalizeAnalysisReceipt(fingerprintPayload(receipt)))}`;
}

function validRisk(value: unknown): value is { score: number; level: RiskLevel } {
  if (!isRecord(value) || !hasOnlyKeys(value, ["score", "level"])) return false;
  return Number.isInteger(value.score) && Number(value.score) >= 0 && Number(value.score) <= 100 && ["LOW", "MEDIUM", "HIGH"].includes(String(value.level));
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && isoTimestampPattern.test(value) && Number.isFinite(Date.parse(value));
}

function validEvidence(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, ["decodedAction", "consequences", "intentComparison", "contractIntelligence", "simulationEvidence", "evidenceConsistency"])) return false;
  const decoded = value.decodedAction;
  if (!isRecord(decoded) || !["empty", "decoded", "unknown", "malformed"].includes(String(decoded.status)) || typeof decoded.method !== "string" || typeof decoded.action !== "string") return false;
  if (!Array.isArray(value.consequences) || !value.consequences.every((item) => isRecord(item)
    && typeof item.id === "string" && typeof item.title === "string" && typeof item.description === "string"
    && ["INFO", "CAUTION", "CRITICAL"].includes(String(item.severity))
    && ["DECODER", "VALUE", "ON_CHAIN", "SIMULATION"].includes(String(item.evidenceSource))
    && ["HIGH", "MEDIUM"].includes(String(item.confidence)))) return false;
  const intent = value.intentComparison;
  if (!isRecord(intent) || !hasOnlyKeys(intent, ["status", "observedTransaction", "why", "normalizationSource", "confidence", "deterministicMismatch", "mismatchType"])
    || !["MATCH", "PARTIAL", "MISMATCH", "UNKNOWN"].includes(String(intent.status))
    || typeof intent.observedTransaction !== "string" || typeof intent.why !== "string"
    || !["DETERMINISTIC", "AI_ASSISTED", "NONE"].includes(String(intent.normalizationSource))
    || !["HIGH", "MEDIUM", "LOW"].includes(String(intent.confidence)) || typeof intent.deterministicMismatch !== "boolean"
    || !(intent.mismatchType === null || ["CLAIM_PERMISSION", "APPROVAL_SCOPE", "NATIVE_AMOUNT", "ACTION", "REVOKE_PERMISSION"].includes(String(intent.mismatchType)))) return false;
  const contract = value.contractIntelligence;
  if (!isRecord(contract) || !["XLAYER_TESTNET", "XLAYER_MAINNET"].includes(String(contract.network)) || ![1952, 196].includes(Number(contract.chainId))
    || typeof contract.address !== "string" || !["EOA", "SMART_CONTRACT", "UNAVAILABLE"].includes(String(contract.addressType))
    || !["SUCCEEDED", "REVERTED", "UNAVAILABLE"].includes(String(contract.preflightStatus)) || !["AVAILABLE", "PARTIAL", "UNAVAILABLE"].includes(String(contract.rpcStatus))) return false;
  const simulation = value.simulationEvidence;
  if (!isRecord(simulation) || simulation.provider !== "OKX_ONCHAINOS" || !["XLAYER_TESTNET", "XLAYER_MAINNET"].includes(String(simulation.network))
    || ![1952, 196].includes(Number(simulation.chainId)) || !["AVAILABLE", "UNAVAILABLE", "UNSUPPORTED", "ERROR"].includes(String(simulation.status))
    || !Array.isArray(simulation.assetChanges) || !Array.isArray(simulation.risks) || !validTimestamp(simulation.observedAt)
    || typeof simulation.durationMs !== "number" || !Number.isFinite(simulation.durationMs) || simulation.durationMs < 0) return false;
  const consistency = value.evidenceConsistency;
  return isRecord(consistency) && hasOnlyKeys(consistency, ["status", "reasons"])
    && ["CONSISTENT", "INCONSISTENT", "NOT_COMPARABLE"].includes(String(consistency.status))
    && Array.isArray(consistency.reasons) && consistency.reasons.every((reason) => typeof reason === "string");
}

function validateSupportedReceipt(value: unknown): value is AnalysisReceipt {
  if (!isRecord(value) || hasDangerousKey(value) || !hasOnlyKeys(value, topLevelKeys)) return false;
  if (value.receiptType !== ANALYSIS_RECEIPT_TYPE || value.schemaVersion !== ANALYSIS_RECEIPT_SCHEMA_VERSION || typeof value.analysisId !== "string" || !uuidPattern.test(value.analysisId) || !validTimestamp(value.observedAt)) return false;
  if (!isRecord(value.engine) || !hasOnlyKeys(value.engine, ["xguardVersion", "ruleVersion", "decoderVersion"]) || Object.values(value.engine).some((item) => typeof item !== "string" || !item)) return false;
  if (!isRecord(value.network) || !hasOnlyKeys(value.network, ["analysisNetwork", "chainId"]) || !["XLAYER_TESTNET", "XLAYER_MAINNET"].includes(String(value.network.analysisNetwork))) return false;
  if ((value.network.analysisNetwork === "XLAYER_TESTNET" && value.network.chainId !== 1952) || (value.network.analysisNetwork === "XLAYER_MAINNET" && value.network.chainId !== 196)) return false;
  if (!isRecord(value.transaction) || !hasOnlyKeys(value.transaction, ["from", "to", "value", "calldata"])) return false;
  if (!((typeof value.transaction.from === "string" && value.transaction.from.length > 0) || value.transaction.from === null) || typeof value.transaction.to !== "string" || typeof value.transaction.value !== "string" || typeof value.transaction.calldata !== "string") return false;
  if (!isRecord(value.assessment) || !hasOnlyKeys(value.assessment, ["deterministicKnownRisk", "aiAdvisory", "finalRisk", "confidence", "verdict", "execution", "recommendation"])) return false;
  if (!validRisk(value.assessment.deterministicKnownRisk) || !(value.assessment.aiAdvisory === null || validRisk(value.assessment.aiAdvisory)) || !validRisk(value.assessment.finalRisk)) return false;
  if (!["HIGH", "MEDIUM", "LOW"].includes(String(value.assessment.confidence)) || !["ASSESSED", "UNDETERMINED"].includes(String(value.assessment.verdict)) || !["SUCCEEDED", "REVERTED", "UNAVAILABLE"].includes(String(value.assessment.execution)) || typeof value.assessment.recommendation !== "string") return false;
  if (!validEvidence(value.evidence)) return false;
  if (!isRecord(value.provenance) || !hasOnlyKeys(value.provenance, ["sources"]) || !Array.isArray(value.provenance.sources) || value.provenance.sources.length !== 4) return false;
  const sourceTypes = new Set<AnalysisReceiptSourceType>();
  for (const source of value.provenance.sources) {
    if (!isRecord(source) || !hasOnlyKeys(source, ["type", "provider", "status", "observedAt", "network"]) || !["DETERMINISTIC_DECODER", "XLAYER_RPC", "OKX_ONCHAINOS", "AI_ADVISORY"].includes(String(source.type)) || typeof source.provider !== "string" || typeof source.status !== "string" || !validTimestamp(source.observedAt) || !["XLAYER_TESTNET", "XLAYER_MAINNET"].includes(String(source.network))) return false;
    sourceTypes.add(source.type as AnalysisReceiptSourceType);
  }
  if (sourceTypes.size !== 4) return false;
  if (!isRecord(value.integrity) || !hasOnlyKeys(value.integrity, ["canonicalizationVersion", "hashAlgorithm", "fingerprint"]) || value.integrity.canonicalizationVersion !== ANALYSIS_RECEIPT_CANONICALIZATION || value.integrity.hashAlgorithm !== ANALYSIS_RECEIPT_HASH_ALGORITHM || typeof value.integrity.fingerprint !== "string" || !fingerprintPattern.test(value.integrity.fingerprint)) return false;
  try { canonicalizeAnalysisReceipt(value); } catch { return false; }
  return true;
}

export function receiptValidationStatus(value: unknown): Exclude<AnalysisReceiptVerificationStatus, "INTEGRITY VERIFIED" | "INTEGRITY CHECK FAILED"> | null {
  if (!isRecord(value) || hasDangerousKey(value) || value.receiptType !== ANALYSIS_RECEIPT_TYPE) return "INVALID RECEIPT FORMAT";
  if (typeof value.schemaVersion !== "string") return "INVALID RECEIPT FORMAT";
  if (value.schemaVersion !== ANALYSIS_RECEIPT_SCHEMA_VERSION) return "UNSUPPORTED RECEIPT VERSION";
  const integrity = value.integrity;
  if (!isRecord(integrity) || typeof integrity.canonicalizationVersion !== "string" || typeof integrity.hashAlgorithm !== "string") return "INVALID RECEIPT FORMAT";
  if (integrity.canonicalizationVersion !== ANALYSIS_RECEIPT_CANONICALIZATION || integrity.hashAlgorithm !== ANALYSIS_RECEIPT_HASH_ALGORITHM) return "UNSUPPORTED RECEIPT VERSION";
  return validateSupportedReceipt(value) ? null : "INVALID RECEIPT FORMAT";
}

export function isAnalysisReceipt(value: unknown): value is AnalysisReceipt {
  return receiptValidationStatus(value) === null;
}

export async function verifyAnalysisReceipt(value: unknown): Promise<AnalysisReceiptVerification> {
  const invalidStatus = receiptValidationStatus(value);
  if (invalidStatus) return { status: invalidStatus, receipt: null };
  const receipt = value as AnalysisReceipt;
  const fingerprint = await fingerprintAnalysisReceipt(receipt);
  return { status: fingerprint === receipt.integrity.fingerprint ? "INTEGRITY VERIFIED" : "INTEGRITY CHECK FAILED", receipt };
}

export async function createAnalysisReceipt(input: RiskInput, result: AnalysisReceiptSource): Promise<AnalysisReceipt> {
  const observedAt = new Date().toISOString();
  const analysisNetwork = normalizeAnalysisNetwork(input.analysisNetwork);
  const network = getAnalysisNetworkConfig(analysisNetwork);
  const aiAdvisory = typeof result.aiScore === "number" ? { score: result.aiScore, level: riskLevelForScore(result.aiScore) } : null;
  const receipt: AnalysisReceipt = {
    receiptType: ANALYSIS_RECEIPT_TYPE,
    schemaVersion: ANALYSIS_RECEIPT_SCHEMA_VERSION,
    analysisId: globalThis.crypto.randomUUID(),
    engine: { xguardVersion: "5.0.0-preview", ruleVersion: "v4.1", decoderVersion: "v4.1" },
    observedAt,
    network: { analysisNetwork, chainId: network.chainId },
    transaction: { from: input.from || null, to: input.to, value: input.value, calldata: input.data },
    assessment: {
      deterministicKnownRisk: { score: result.deterministicScore, level: riskLevelForScore(result.deterministicScore) },
      aiAdvisory,
      finalRisk: { score: result.finalScore, level: result.level },
      confidence: result.analysisConfidence,
      verdict: result.analysisVerdict,
      execution: result.executionStatus,
      recommendation: result.recommendation
    },
    evidence: {
      decodedAction: { ...result.decodedAction },
      consequences: result.consequences.map((item) => ({ ...item })),
      intentComparison: {
        status: result.intentComparison.status,
        observedTransaction: result.intentComparison.observedTransaction,
        why: result.intentComparison.why,
        normalizationSource: result.intentComparison.normalizationSource,
        confidence: result.intentComparison.confidence,
        deterministicMismatch: result.intentComparison.deterministicMismatch,
        mismatchType: result.intentComparison.mismatchType
      },
      contractIntelligence: { ...result.contractIntelligence },
      simulationEvidence: { ...result.simulationEvidence, assetChanges: result.simulationEvidence.assetChanges.map((item) => ({ ...item })), risks: result.simulationEvidence.risks.map((item) => ({ ...item })) },
      evidenceConsistency: { ...result.evidenceConsistency, reasons: [...result.evidenceConsistency.reasons] }
    },
    provenance: {
      sources: [
        { type: "DETERMINISTIC_DECODER", provider: "XGuard deterministic decoder", status: result.decodedAction.status.toUpperCase(), observedAt, network: analysisNetwork },
        { type: "XLAYER_RPC", provider: "X Layer RPC", status: result.contractIntelligence.rpcStatus, observedAt, network: analysisNetwork },
        { type: "OKX_ONCHAINOS", provider: "OKX OnchainOS", status: result.simulationEvidence.status, observedAt: result.simulationEvidence.observedAt, network: analysisNetwork },
        { type: "AI_ADVISORY", provider: "Configured AI provider", status: aiAdvisory ? "AVAILABLE" : "UNAVAILABLE", observedAt, network: analysisNetwork }
      ]
    },
    integrity: { canonicalizationVersion: ANALYSIS_RECEIPT_CANONICALIZATION, hashAlgorithm: ANALYSIS_RECEIPT_HASH_ALGORITHM, fingerprint: "sha256:" + "0".repeat(64) }
  };
  receipt.integrity.fingerprint = await fingerprintAnalysisReceipt(receipt);
  return receipt;
}
