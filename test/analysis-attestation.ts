import { expect } from "chai";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Address } from "viem";
import {
  ANALYSIS_ATTESTATION_AUTHENTICITY_NOTICE,
  ATTESTED_ANALYSIS_MAX_FILE_BYTES,
  analysisAttestationPayload,
  attestationValidationStatus,
  canonicalizeAnalysisAttestation,
  createAttestedAnalysisPackage,
  fingerprintPublicKeySpki,
  isAnalysisAttestation,
  verifyAnalysisAttestation,
  verifyAttestedAnalysisPackage,
  type AnalysisAttestation,
  type AttestedAnalysisPackage,
  type TrustedAttestationKey,
  type TrustedKeyResolution
} from "../lib/analysis-attestation.ts";
import { fingerprintAnalysisReceipt, verifyAnalysisReceipt, type AnalysisReceipt } from "../lib/analysis-receipt.ts";
import { invalidateStaleAnalysis } from "../lib/analysis-state.ts";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { AiAdvisoryRiskResult } from "../lib/ai/provider.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import type { SimulationEvidence } from "../lib/okx/simulation.ts";
import type { RiskInput } from "../lib/risk.ts";
import { attachAnalysisAttestation, createAnalysisAttestation, getPublicAttestationKey, type AttestationSigningConfig } from "../lib/server/analysis-attestation-core.ts";

const from = "0x1111111111111111111111111111111111111111" as Address;
const target = "0x2222222222222222222222222222222222222222" as Address;
const input: RiskInput = { from, to: target, value: "0", data: "0x", context: "private context canary", analysisNetwork: "XLAYER_MAINNET" };
const signedAt = "2026-08-21T00:00:00.000Z";

function intelligence(): ContractIntelligence {
  return { network: "XLAYER_MAINNET", chainId: 196, address: target, addressType: "EOA", codePresent: false, codeSizeBytes: 0, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "21000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" };
}

function simulation(): SimulationEvidence {
  return { provider: "OKX_ONCHAINOS", network: "XLAYER_MAINNET", chainId: 196, chainIndex: "196", status: "AVAILABLE", statusDetail: null, intention: "Native Transfer", assetChanges: [], gasUsed: "21000", failReason: null, risks: [], observedAt: signedAt, durationMs: 10, httpStatus: 200, businessCode: "0" };
}

function ai(score = 12): AiAdvisoryRiskResult {
  return { score, level: score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW", summary: "Advisory only", reasons: ["Review evidence"], recommendation: "Review before signing.", mode: "AI", providerProtocol: "responses", normalizedIntent: null };
}

async function analyze(sourceInput = input, aiResult: AiAdvisoryRiskResult | null = ai()) {
  return runAnalysisPipeline(sourceInput, { inspectContract: async () => intelligence(), simulate: async () => simulation(), analyzeAi: async () => aiResult });
}

function ephemeralConfig(keyId = "xguard-preview-test"): AttestationSigningConfig {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  return { privateKeyPemBase64: Buffer.from(pem).toString("base64"), keyId };
}

function trustedKey(config: AttestationSigningConfig): TrustedAttestationKey {
  const response = getPublicAttestationKey(config);
  if (response.status !== "AVAILABLE") throw new Error("Ephemeral attestation test key was unavailable");
  const { status: _status, ...key } = response;
  return key;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolver(key: TrustedAttestationKey): (keyId: string) => Promise<TrustedKeyResolution> {
  return async (keyId) => keyId === key.keyId ? { status: "AVAILABLE", key } : { status: "UNKNOWN_KEY_ID" };
}

describe("V6 Signed Analysis Attestation", function () {
  let receipt: AnalysisReceipt;
  let config: AttestationSigningConfig;
  let key: TrustedAttestationKey;
  let attestation: AnalysisAttestation;
  let attestedPackage: AttestedAnalysisPackage;

  before(async function () {
    receipt = (await analyze()).analysisReceipt;
    receipt.analysisId = "123e4567-e89b-42d3-a456-426614174000";
    receipt.observedAt = signedAt;
    receipt.provenance.sources.forEach((source) => { source.observedAt = signedAt; });
    receipt.integrity.fingerprint = await fingerprintAnalysisReceipt(receipt);
    config = ephemeralConfig();
    key = trustedKey(config);
    const result = await createAnalysisAttestation(receipt, config, signedAt);
    if (!result.attestation) throw new Error("Ephemeral attestation signing failed");
    attestation = result.attestation;
    attestedPackage = createAttestedAnalysisPackage(receipt, attestation);
  });

  it("preserves the known V5 receipt fingerprint byte-for-byte", function () {
    expect(receipt.integrity.fingerprint).to.equal("sha256:98aa567bd73427cefda86c9fd16e8b998bc95649aab3915a34fb862109e37114");
  });

  it("generates an ephemeral Ed25519 keypair entirely in memory", function () {
    expect(getPublicAttestationKey(config).status).to.equal("AVAILABLE");
    expect(key.algorithm).to.equal("Ed25519");
  });

  it("signs a valid V5 receipt", function () {
    expect(attestation.signature).to.match(/^[A-Za-z0-9_-]{86}$/);
    expect(attestation.receiptBinding.fingerprint).to.equal(receipt.integrity.fingerprint);
  });

  it("verifies a valid attestation", async function () {
    expect(await verifyAnalysisAttestation(attestation, receipt, key)).to.equal("ATTESTATION VERIFIED");
  });

  it("rejects the wrong public key", async function () {
    const wrongKey = trustedKey(ephemeralConfig(key.keyId));
    expect(await verifyAnalysisAttestation(attestation, receipt, wrongKey)).to.equal("ATTESTATION CHECK FAILED");
  });

  it("rejects a modified signature", async function () {
    const modified = clone(attestation);
    modified.signature = `${modified.signature[0] === "A" ? "B" : "A"}${modified.signature.slice(1)}`;
    expect(await verifyAnalysisAttestation(modified, receipt, key)).to.equal("ATTESTATION CHECK FAILED");
  });

  it("rejects a modified key ID", async function () {
    const modified = clone(attestation);
    modified.keyId = "unknown-key";
    expect(await verifyAnalysisAttestation(modified, receipt, key)).to.equal("UNKNOWN KEY ID");
  });

  it("rejects a modified signing timestamp", async function () {
    const modified = clone(attestation);
    modified.signedAt = "2026-08-21T00:00:01.000Z";
    expect(await verifyAnalysisAttestation(modified, receipt, key)).to.equal("ATTESTATION CHECK FAILED");
  });

  it("rejects a modified receipt analysis binding", async function () {
    const modified = clone(attestation);
    modified.receiptBinding.analysisId = "223e4567-e89b-42d3-a456-426614174000";
    expect(await verifyAnalysisAttestation(modified, receipt, key)).to.equal("ATTESTATION CHECK FAILED");
  });

  it("rejects a modified signed receipt fingerprint", async function () {
    const modified = clone(attestation);
    modified.receiptBinding.fingerprint = `sha256:${"f".repeat(64)}`;
    expect(await verifyAnalysisAttestation(modified, receipt, key)).to.equal("ATTESTATION CHECK FAILED");
  });

  it("verifies original receipt integrity and authenticity independently", async function () {
    const result = await verifyAttestedAnalysisPackage(attestedPackage, resolver(key));
    expect(result.receiptIntegrity).to.equal("INTEGRITY VERIFIED");
    expect(result.attestation).to.equal("ATTESTATION VERIFIED");
  });

  it("fails receipt integrity after tampering without recomputing", async function () {
    const modified = clone(attestedPackage);
    modified.receipt.assessment.finalRisk.score += 1;
    const result = await verifyAttestedAnalysisPackage(modified, resolver(key));
    expect(result.receiptIntegrity).to.equal("INTEGRITY CHECK FAILED");
    expect(result.attestation).to.equal("ATTESTATION CHECK FAILED");
  });

  it("keeps recomputed V5 integrity valid while rejecting the retained attestation", async function () {
    const modified = clone(attestedPackage);
    modified.receipt.assessment.verdict = "UNDETERMINED";
    modified.receipt.integrity.fingerprint = await fingerprintAnalysisReceipt(modified.receipt);
    const result = await verifyAttestedAnalysisPackage(modified, resolver(key));
    expect(result.receiptIntegrity).to.equal("INTEGRITY VERIFIED");
    expect(result.attestation).to.equal("ATTESTATION CHECK FAILED");
  });

  it("rejects unknown key IDs", async function () {
    const modified = clone(attestedPackage);
    modified.attestation.keyId = "unknown-key";
    expect((await verifyAttestedAnalysisPackage(modified, resolver(key))).attestation).to.equal("UNKNOWN KEY ID");
  });

  it("rejects unsupported algorithms", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.algorithm = "Ed448";
    expect(attestationValidationStatus(modified)).to.equal("UNSUPPORTED ATTESTATION VERSION");
  });

  it("rejects unsupported attestation versions", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.attestationVersion = "2.0.0";
    expect(attestationValidationStatus(modified)).to.equal("UNSUPPORTED ATTESTATION VERSION");
  });

  it("rejects malformed base64url signatures", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.signature = "not+base64url=";
    expect(attestationValidationStatus(modified)).to.equal("INVALID ATTESTATION FORMAT");
  });

  it("rejects malformed public-key fingerprints", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.publicKeyFingerprint = "sha256:not-a-fingerprint";
    expect(attestationValidationStatus(modified)).to.equal("INVALID ATTESTATION FORMAT");
  });

  it("degrades gracefully when the private key is absent", async function () {
    const signed = await createAnalysisAttestation(receipt, {});
    expect(signed).to.deep.equal({ status: "UNAVAILABLE", attestation: null });
  });

  it("degrades gracefully for invalid key configuration", async function () {
    const signed = await createAnalysisAttestation(receipt, { privateKeyPemBase64: "bm90IGEga2V5", keyId: "test-key" });
    expect(signed).to.deep.equal({ status: "INVALID_CONFIG", attestation: null });
  });

  it("never exports a private key from the public key helper", function () {
    expect(Object.keys(getPublicAttestationKey(config)).some((name) => /private|pem|secret/i.test(name))).to.equal(false);
  });

  it("never includes a private key in the safe key endpoint shape", function () {
    expect(Object.keys(getPublicAttestationKey(config)).sort()).to.deep.equal(["algorithm", "keyId", "publicKeyFingerprint", "publicKeySpkiBase64", "status"].sort());
  });

  it("never includes a private key or credential field in package JSON", function () {
    expect(JSON.stringify(attestedPackage)).not.to.match(/"(?:privateKey|privateKeyPemBase64|apiKey|secretKey|passphrase|authorization|headers)"\s*:/i);
  });

  it("defines no NEXT_PUBLIC private-key variable", function () {
    const sources = [".env.example", "app/api/analyze/route.ts", "app/api/attestation-key/route.ts", "lib/analysis-attestation.ts", "lib/server/analysis-attestation.ts", "lib/server/analysis-attestation-core.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.to.match(/NEXT_PUBLIC_[A-Z0-9_]*(?:PRIVATE|SECRET)[A-Z0-9_]*/);
  });

  it("preserves V5 AI advisory separation", function () {
    expect(receipt.assessment.aiAdvisory?.score).to.equal(12);
    expect(receipt.assessment.finalRisk.score).to.not.equal(undefined);
  });

  it("preserves the deterministic risk floor", async function () {
    const risky = await analyze({ ...input, to: "0x0000000000000000000000000000000000000000" as Address }, ai(0));
    expect(risky.finalScore).to.equal(risky.deterministicScore).and.to.be.at.least(65);
  });

  it("does not turn empty OKX risks into a safety claim", function () {
    expect(receipt.evidence.simulationEvidence.risks).to.deep.equal([]);
    expect(receipt.assessment.recommendation.toLowerCase()).not.to.include("confirmed safe");
  });

  it("does not equate verified attestation with transaction safety", function () {
    expect(ANALYSIS_ATTESTATION_AUTHENTICITY_NOTICE).to.include("does not prove the transaction is safe").and.to.include("provider data is true");
  });

  it("invalidates stale receipt and attestation after network or input changes", function () {
    const result = { analysisReceipt: receipt, analysisAttestation: attestation };
    for (const changed of [{ ...input, value: "1" }, { ...input, analysisNetwork: "XLAYER_TESTNET" as const }]) {
      expect(invalidateStaleAnalysis({ result, lastInput: input, reviewed: true }, changed).snapshot.result).to.equal(null);
    }
  });

  it("replaces both receipt and attestation on a new analysis", async function () {
    const nextAnalysis = await analyze();
    const nextSigned = await createAnalysisAttestation(nextAnalysis.analysisReceipt, config, "2026-08-21T00:00:01.000Z");
    expect(nextAnalysis.analysisReceipt.analysisId).not.to.equal(receipt.analysisId);
    expect(nextSigned.attestation?.receiptBinding.fingerprint).not.to.equal(attestation.receiptBinding.fingerprint);
  });

  it("isolates missing signing configuration from analysis semantics", async function () {
    const analysis = await analyze();
    const attached = await attachAnalysisAttestation(analysis, {});
    expect(attached.analysisAttestation).to.equal(null);
    expect(attached.attestationAvailability).to.equal("UNAVAILABLE");
    expect(attached.finalScore).to.equal(analysis.finalScore);
    expect(attached.analysisVerdict).to.equal(analysis.analysisVerdict);
  });

  it("rejects arbitrary public keys embedded in an uploaded package", async function () {
    const modified = { ...clone(attestedPackage), publicKey: key };
    const result = await verifyAttestedAnalysisPackage(modified, resolver(key));
    expect(result.attestation).to.equal("INVALID ATTESTATION FORMAT");
  });

  it("rejects prototype-pollution keys", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.extra = JSON.parse('{"__proto__":{"polluted":true}}');
    expect(isAnalysisAttestation(modified)).to.equal(false);
    expect(({} as { polluted?: boolean }).polluted).to.equal(undefined);
  });

  it("rejects unexpected critical attestation keys", function () {
    const modified = { ...clone(attestation), publicKey: key.publicKeySpkiBase64 };
    expect(isAnalysisAttestation(modified)).to.equal(false);
  });

  it("bounds imported package files", function () {
    expect(ATTESTED_ANALYSIS_MAX_FILE_BYTES).to.be.greaterThan(0).and.to.be.at.most(1024 * 1024);
  });

  it("binds every metadata field except the signature", function () {
    const modified = clone(attestation);
    modified.signature = `${"A".repeat(86)}`;
    expect(canonicalizeAnalysisAttestation(modified)).to.equal(canonicalizeAnalysisAttestation(attestation));
    expect(Object.keys(analysisAttestationPayload(attestation))).to.have.members(["attestationType", "attestationVersion", "algorithm", "keyId", "signedAt", "receiptBinding", "publicKeyFingerprint"]);
  });

  it("derives the public-key fingerprint from SPKI bytes", async function () {
    expect(await fingerprintPublicKeySpki(key.publicKeySpkiBase64)).to.equal(key.publicKeyFingerprint);
  });

  it("rejects invalid timestamps", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.signedAt = "not-a-date";
    expect(attestationValidationStatus(modified)).to.equal("INVALID ATTESTATION FORMAT");
  });

  it("rejects impossible calendar timestamps", function () {
    const modified = clone(attestation) as unknown as Record<string, unknown>;
    modified.signedAt = "2026-02-31T00:00:00.000Z";
    expect(attestationValidationStatus(modified)).to.equal("INVALID ATTESTATION FORMAT");
  });

  it("keeps standalone V5 receipt exports unchanged", async function () {
    const standalone = clone(receipt);
    expect((standalone as unknown as Record<string, unknown>).analysisAttestation).to.equal(undefined);
    expect((await verifyAnalysisReceipt(standalone)).status).to.equal("INTEGRITY VERIFIED");
  });
});
