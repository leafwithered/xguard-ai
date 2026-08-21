import {
  ANALYSIS_RECEIPT_CANONICALIZATION,
  ANALYSIS_RECEIPT_HASH_ALGORITHM,
  ANALYSIS_RECEIPT_SCHEMA_VERSION,
  ANALYSIS_RECEIPT_TYPE,
  canonicalizeAnalysisReceipt,
  verifyAnalysisReceipt,
  type AnalysisReceipt,
  type AnalysisReceiptVerificationStatus
} from "./analysis-receipt.ts";

export const ANALYSIS_ATTESTATION_TYPE = "xguard.analysis-attestation" as const;
export const ANALYSIS_ATTESTATION_VERSION = "1.0.0" as const;
export const ANALYSIS_ATTESTATION_ALGORITHM = "Ed25519" as const;
export const ATTESTED_ANALYSIS_PACKAGE_TYPE = "xguard.attested-analysis" as const;
export const ATTESTED_ANALYSIS_PACKAGE_VERSION = "1.0.0" as const;
export const ATTESTED_ANALYSIS_MAX_FILE_BYTES = 1024 * 1024;
export const ANALYSIS_ATTESTATION_AUTHENTICITY_NOTICE = "Attestation verification confirms that this receipt fingerprint was signed by the Ed25519 key configured for this XGuard deployment. It does not prove the transaction is safe, that provider data is true, that the transaction reached blockchain finality, or that the receipt has been anchored on-chain.";

export type AnalysisReceiptBinding = {
  receiptType: typeof ANALYSIS_RECEIPT_TYPE;
  schemaVersion: typeof ANALYSIS_RECEIPT_SCHEMA_VERSION;
  analysisId: string;
  canonicalizationVersion: typeof ANALYSIS_RECEIPT_CANONICALIZATION;
  hashAlgorithm: typeof ANALYSIS_RECEIPT_HASH_ALGORITHM;
  fingerprint: string;
};

export type AnalysisAttestation = {
  attestationType: typeof ANALYSIS_ATTESTATION_TYPE;
  attestationVersion: typeof ANALYSIS_ATTESTATION_VERSION;
  algorithm: typeof ANALYSIS_ATTESTATION_ALGORITHM;
  keyId: string;
  signedAt: string;
  receiptBinding: AnalysisReceiptBinding;
  publicKeyFingerprint: string;
  signature: string;
};

export type AnalysisAttestationPayload = Omit<AnalysisAttestation, "signature">;

export type AttestedAnalysisPackage = {
  packageType: typeof ATTESTED_ANALYSIS_PACKAGE_TYPE;
  packageVersion: typeof ATTESTED_ANALYSIS_PACKAGE_VERSION;
  receipt: AnalysisReceipt;
  attestation: AnalysisAttestation;
};

export type TrustedAttestationKey = {
  keyId: string;
  algorithm: typeof ANALYSIS_ATTESTATION_ALGORITHM;
  publicKeySpkiBase64: string;
  publicKeyFingerprint: string;
};

export type AttestationKeyResponse =
  | ({ status: "AVAILABLE" } & TrustedAttestationKey)
  | { status: "UNAVAILABLE" | "INVALID_CONFIG" };

export type AttestationVerificationStatus =
  | "ATTESTATION VERIFIED"
  | "ATTESTATION CHECK FAILED"
  | "ATTESTATION UNAVAILABLE"
  | "UNKNOWN KEY ID"
  | "UNSUPPORTED ATTESTATION VERSION"
  | "INVALID ATTESTATION FORMAT";

export type TrustedKeyResolution =
  | { status: "AVAILABLE"; key: TrustedAttestationKey }
  | { status: "UNAVAILABLE" }
  | { status: "UNKNOWN_KEY_ID" };

export type AttestedPackageVerification = {
  receiptIntegrity: AnalysisReceiptVerificationStatus;
  attestation: AttestationVerificationStatus;
  package: AttestedAnalysisPackage | null;
};

const dangerousKeys = new Set(["__proto__", "constructor", "prototype"]);
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const keyIdPattern = /^[a-z0-9._-]{1,64}$/;
const signaturePattern = /^[A-Za-z0-9_-]{86}$/;
const spkiBase64Pattern = /^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function hasDangerousKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDangerousKey);
  if (!isRecord(value)) return false;
  return Object.keys(value).some((key) => dangerousKeys.has(key) || hasDangerousKey(value[key]));
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || !isoTimestampPattern.test(value)) return false;
  const parsed = Date.parse(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === normalized;
}

function decodeBase64(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeBase64Url(value: string) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  return decodeBase64(padded);
}

async function sha256Bytes(value: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildAnalysisReceiptBinding(receipt: AnalysisReceipt): AnalysisReceiptBinding {
  return {
    receiptType: receipt.receiptType,
    schemaVersion: receipt.schemaVersion,
    analysisId: receipt.analysisId,
    canonicalizationVersion: receipt.integrity.canonicalizationVersion,
    hashAlgorithm: receipt.integrity.hashAlgorithm,
    fingerprint: receipt.integrity.fingerprint
  };
}

export function analysisAttestationPayload(attestation: AnalysisAttestation): AnalysisAttestationPayload {
  const { signature: _signature, ...payload } = attestation;
  return payload;
}

export function canonicalizeAnalysisAttestation(attestation: AnalysisAttestation) {
  return canonicalizeAnalysisReceipt(analysisAttestationPayload(attestation));
}

export function isAnalysisAttestation(value: unknown): value is AnalysisAttestation {
  if (!isRecord(value) || hasDangerousKey(value) || !hasExactKeys(value, ["attestationType", "attestationVersion", "algorithm", "keyId", "signedAt", "receiptBinding", "publicKeyFingerprint", "signature"])) return false;
  if (value.attestationType !== ANALYSIS_ATTESTATION_TYPE || value.attestationVersion !== ANALYSIS_ATTESTATION_VERSION || value.algorithm !== ANALYSIS_ATTESTATION_ALGORITHM) return false;
  if (typeof value.keyId !== "string" || !keyIdPattern.test(value.keyId) || !validTimestamp(value.signedAt)) return false;
  if (typeof value.publicKeyFingerprint !== "string" || !fingerprintPattern.test(value.publicKeyFingerprint) || typeof value.signature !== "string" || !signaturePattern.test(value.signature)) return false;
  const binding = value.receiptBinding;
  if (!isRecord(binding) || !hasExactKeys(binding, ["receiptType", "schemaVersion", "analysisId", "canonicalizationVersion", "hashAlgorithm", "fingerprint"])) return false;
  if (binding.receiptType !== ANALYSIS_RECEIPT_TYPE || binding.schemaVersion !== ANALYSIS_RECEIPT_SCHEMA_VERSION || binding.canonicalizationVersion !== ANALYSIS_RECEIPT_CANONICALIZATION || binding.hashAlgorithm !== ANALYSIS_RECEIPT_HASH_ALGORITHM) return false;
  if (typeof binding.analysisId !== "string" || !binding.analysisId || typeof binding.fingerprint !== "string" || !fingerprintPattern.test(binding.fingerprint)) return false;
  try { canonicalizeAnalysisAttestation(value as AnalysisAttestation); } catch { return false; }
  return true;
}

export function attestationValidationStatus(value: unknown): Exclude<AttestationVerificationStatus, "ATTESTATION VERIFIED" | "ATTESTATION CHECK FAILED" | "ATTESTATION UNAVAILABLE" | "UNKNOWN KEY ID"> | null {
  if (!isRecord(value) || hasDangerousKey(value) || value.attestationType !== ANALYSIS_ATTESTATION_TYPE) return "INVALID ATTESTATION FORMAT";
  if (typeof value.attestationVersion !== "string" || typeof value.algorithm !== "string") return "INVALID ATTESTATION FORMAT";
  if (value.attestationVersion !== ANALYSIS_ATTESTATION_VERSION || value.algorithm !== ANALYSIS_ATTESTATION_ALGORITHM) return "UNSUPPORTED ATTESTATION VERSION";
  return isAnalysisAttestation(value) ? null : "INVALID ATTESTATION FORMAT";
}

export function isTrustedAttestationKey(value: unknown): value is TrustedAttestationKey {
  if (!isRecord(value) || hasDangerousKey(value) || !hasExactKeys(value, ["keyId", "algorithm", "publicKeySpkiBase64", "publicKeyFingerprint"])) return false;
  if (typeof value.keyId !== "string" || !keyIdPattern.test(value.keyId) || value.algorithm !== ANALYSIS_ATTESTATION_ALGORITHM) return false;
  if (typeof value.publicKeyFingerprint !== "string" || !fingerprintPattern.test(value.publicKeyFingerprint)) return false;
  if (typeof value.publicKeySpkiBase64 !== "string" || value.publicKeySpkiBase64.length > 1024 || !spkiBase64Pattern.test(value.publicKeySpkiBase64)) return false;
  try { return decodeBase64(value.publicKeySpkiBase64).length > 0; } catch { return false; }
}

export async function fingerprintPublicKeySpki(publicKeySpkiBase64: string) {
  if (publicKeySpkiBase64.length > 1024 || !spkiBase64Pattern.test(publicKeySpkiBase64)) throw new TypeError("Invalid public key format");
  return `sha256:${await sha256Bytes(decodeBase64(publicKeySpkiBase64))}`;
}

function receiptBindingMatches(receipt: AnalysisReceipt, binding: AnalysisReceiptBinding) {
  const expected = buildAnalysisReceiptBinding(receipt);
  return canonicalizeAnalysisReceipt(expected) === canonicalizeAnalysisReceipt(binding);
}

export async function verifyAnalysisAttestation(attestationValue: unknown, receipt: AnalysisReceipt, trustedKey: TrustedAttestationKey): Promise<AttestationVerificationStatus> {
  const invalidStatus = attestationValidationStatus(attestationValue);
  if (invalidStatus) return invalidStatus;
  if (!isTrustedAttestationKey(trustedKey)) return "ATTESTATION UNAVAILABLE";
  const attestation = attestationValue as AnalysisAttestation;
  if (attestation.keyId !== trustedKey.keyId) return "UNKNOWN KEY ID";
  if (!receiptBindingMatches(receipt, attestation.receiptBinding)) return "ATTESTATION CHECK FAILED";
  try {
    const derivedFingerprint = await fingerprintPublicKeySpki(trustedKey.publicKeySpkiBase64);
    if (derivedFingerprint !== trustedKey.publicKeyFingerprint || derivedFingerprint !== attestation.publicKeyFingerprint) return "ATTESTATION CHECK FAILED";
    const publicKey = await globalThis.crypto.subtle.importKey("spki", decodeBase64(trustedKey.publicKeySpkiBase64), { name: "Ed25519" }, false, ["verify"]);
    const verified = await globalThis.crypto.subtle.verify({ name: "Ed25519" }, publicKey, decodeBase64Url(attestation.signature), new TextEncoder().encode(canonicalizeAnalysisAttestation(attestation)));
    return verified ? "ATTESTATION VERIFIED" : "ATTESTATION CHECK FAILED";
  } catch {
    return "ATTESTATION CHECK FAILED";
  }
}

export function createAttestedAnalysisPackage(receipt: AnalysisReceipt, attestation: AnalysisAttestation): AttestedAnalysisPackage {
  return { packageType: ATTESTED_ANALYSIS_PACKAGE_TYPE, packageVersion: ATTESTED_ANALYSIS_PACKAGE_VERSION, receipt, attestation };
}

export function isAttestedAnalysisPackage(value: unknown): value is AttestedAnalysisPackage {
  return isRecord(value)
    && !hasDangerousKey(value)
    && hasExactKeys(value, ["packageType", "packageVersion", "receipt", "attestation"])
    && value.packageType === ATTESTED_ANALYSIS_PACKAGE_TYPE
    && value.packageVersion === ATTESTED_ANALYSIS_PACKAGE_VERSION
    && isAnalysisAttestation(value.attestation);
}

function isAttestedPackageEnvelope(value: unknown): value is Record<"receipt" | "attestation", unknown> & Record<string, unknown> {
  return isRecord(value)
    && !hasDangerousKey(value)
    && hasExactKeys(value, ["packageType", "packageVersion", "receipt", "attestation"])
    && value.packageType === ATTESTED_ANALYSIS_PACKAGE_TYPE
    && value.packageVersion === ATTESTED_ANALYSIS_PACKAGE_VERSION;
}

export async function verifyAttestedAnalysisPackage(value: unknown, resolveTrustedKey: (keyId: string) => Promise<TrustedKeyResolution>): Promise<AttestedPackageVerification> {
  if (!isAttestedPackageEnvelope(value)) return { receiptIntegrity: "INVALID RECEIPT FORMAT", attestation: "INVALID ATTESTATION FORMAT", package: null };
  const receiptVerification = await verifyAnalysisReceipt(value.receipt);
  const candidatePackage = value as unknown as AttestedAnalysisPackage;
  if (!receiptVerification.receipt) return { receiptIntegrity: receiptVerification.status, attestation: "ATTESTATION CHECK FAILED", package: candidatePackage };
  const invalidAttestation = attestationValidationStatus(value.attestation);
  if (invalidAttestation) return { receiptIntegrity: receiptVerification.status, attestation: invalidAttestation, package: candidatePackage };
  const attestation = value.attestation as AnalysisAttestation;
  if (receiptVerification.status !== "INTEGRITY VERIFIED") return { receiptIntegrity: receiptVerification.status, attestation: "ATTESTATION CHECK FAILED", package: candidatePackage };
  const resolution = await resolveTrustedKey(attestation.keyId);
  if (resolution.status === "UNAVAILABLE") return { receiptIntegrity: receiptVerification.status, attestation: "ATTESTATION UNAVAILABLE", package: candidatePackage };
  if (resolution.status === "UNKNOWN_KEY_ID") return { receiptIntegrity: receiptVerification.status, attestation: "UNKNOWN KEY ID", package: candidatePackage };
  return {
    receiptIntegrity: receiptVerification.status,
    attestation: await verifyAnalysisAttestation(attestation, receiptVerification.receipt, resolution.key),
    package: candidatePackage
  };
}
