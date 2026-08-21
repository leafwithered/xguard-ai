import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import {
  ANALYSIS_ATTESTATION_ALGORITHM,
  ANALYSIS_ATTESTATION_TYPE,
  ANALYSIS_ATTESTATION_VERSION,
  analysisAttestationPayload,
  buildAnalysisReceiptBinding,
  type AnalysisAttestation,
  type AttestationKeyResponse
} from "../analysis-attestation.ts";
import { canonicalizeAnalysisReceipt, verifyAnalysisReceipt, type AnalysisReceipt } from "../analysis-receipt.ts";

export type AttestationSigningStatus = "AVAILABLE" | "UNAVAILABLE" | "INVALID_CONFIG";

export type AttestationSigningConfig = {
  privateKeyPemBase64?: string;
  keyId?: string;
};

export type AttestationSigningResult = {
  status: AttestationSigningStatus;
  attestation: AnalysisAttestation | null;
};

type ValidatedSigningKey = {
  privateKey: KeyObject;
  keyId: string;
  publicKeySpkiBase64: string;
  publicKeyFingerprint: string;
};

const keyIdPattern = /^[a-z0-9._-]{1,64}$/;

function validateSigningKey(config: AttestationSigningConfig): { status: AttestationSigningStatus; key: ValidatedSigningKey | null } {
  if (!config.privateKeyPemBase64 && !config.keyId) return { status: "UNAVAILABLE", key: null };
  if (!config.privateKeyPemBase64 || !config.keyId || !keyIdPattern.test(config.keyId) || config.privateKeyPemBase64.length > 32_768) return { status: "INVALID_CONFIG", key: null };
  try {
    const pem = Buffer.from(config.privateKeyPemBase64, "base64").toString("utf8");
    const privateKey = createPrivateKey({ key: pem, format: "pem", type: "pkcs8" });
    if (privateKey.asymmetricKeyType !== "ed25519") return { status: "INVALID_CONFIG", key: null };
    const publicKey = createPublicKey(privateKey);
    const publicKeySpki = publicKey.export({ format: "der", type: "spki" });
    return {
      status: "AVAILABLE",
      key: {
        privateKey,
        keyId: config.keyId,
        publicKeySpkiBase64: publicKeySpki.toString("base64"),
        publicKeyFingerprint: `sha256:${createHash("sha256").update(publicKeySpki).digest("hex")}`
      }
    };
  } catch {
    return { status: "INVALID_CONFIG", key: null };
  }
}

export async function createAnalysisAttestation(receipt: AnalysisReceipt, config: AttestationSigningConfig, signedAt = new Date().toISOString()): Promise<AttestationSigningResult> {
  const validated = validateSigningKey(config);
  if (!validated.key) return { status: validated.status, attestation: null };
  const parsedSignedAt = Date.parse(signedAt);
  const normalizedSignedAt = signedAt.includes(".") ? signedAt : signedAt.replace("Z", ".000Z");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(signedAt) || !Number.isFinite(parsedSignedAt) || new Date(parsedSignedAt).toISOString() !== normalizedSignedAt) return { status: "INVALID_CONFIG", attestation: null };
  try {
    if ((await verifyAnalysisReceipt(receipt)).status !== "INTEGRITY VERIFIED") return { status: "INVALID_CONFIG", attestation: null };
    const unsigned: Omit<AnalysisAttestation, "signature"> = {
      attestationType: ANALYSIS_ATTESTATION_TYPE,
      attestationVersion: ANALYSIS_ATTESTATION_VERSION,
      algorithm: ANALYSIS_ATTESTATION_ALGORITHM,
      keyId: validated.key.keyId,
      signedAt,
      receiptBinding: buildAnalysisReceiptBinding(receipt),
      publicKeyFingerprint: validated.key.publicKeyFingerprint
    };
    const placeholder = { ...unsigned, signature: "" } as AnalysisAttestation;
    const payload = canonicalizeAnalysisReceipt(analysisAttestationPayload(placeholder));
    const signature = sign(null, Buffer.from(payload, "utf8"), validated.key.privateKey).toString("base64url");
    return { status: "AVAILABLE", attestation: { ...unsigned, signature } };
  } catch {
    return { status: "INVALID_CONFIG", attestation: null };
  }
}

export async function attachAnalysisAttestation<T extends { analysisReceipt: AnalysisReceipt }>(result: T, config: AttestationSigningConfig) {
  const signing = await createAnalysisAttestation(result.analysisReceipt, config);
  return { ...result, analysisAttestation: signing.attestation, attestationAvailability: signing.status };
}

export function getPublicAttestationKey(config: AttestationSigningConfig): AttestationKeyResponse {
  const validated = validateSigningKey(config);
  if (!validated.key) return { status: validated.status === "AVAILABLE" ? "INVALID_CONFIG" : validated.status };
  return {
    status: "AVAILABLE",
    keyId: validated.key.keyId,
    algorithm: ANALYSIS_ATTESTATION_ALGORITHM,
    publicKeySpkiBase64: validated.key.publicKeySpkiBase64,
    publicKeyFingerprint: validated.key.publicKeyFingerprint
  };
}
