import { expect } from "chai";
import type { Address } from "viem";
import {
  ANALYSIS_RECEIPT_INTEGRITY_NOTICE,
  canonicalizeAnalysisReceipt,
  fingerprintAnalysisReceipt,
  receiptValidationStatus,
  verifyAnalysisReceipt,
  type AnalysisReceipt
} from "../lib/analysis-receipt.ts";
import { invalidateStaleAnalysis } from "../lib/analysis-state.ts";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { AiAdvisoryRiskResult } from "../lib/ai/provider.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import type { SimulationEvidence } from "../lib/okx/simulation.ts";
import type { RiskInput } from "../lib/risk.ts";

const from = "0x1111111111111111111111111111111111111111" as Address;
const target = "0x2222222222222222222222222222222222222222" as Address;
const input: RiskInput = { from, to: target, value: "0", data: "0x", context: "private context canary", analysisNetwork: "XLAYER_MAINNET" };

function intelligence(): ContractIntelligence {
  return { network: "XLAYER_MAINNET", chainId: 196, address: target, addressType: "EOA", codePresent: false, codeSizeBytes: 0, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "21000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" };
}

function simulation(): SimulationEvidence {
  return { provider: "OKX_ONCHAINOS", network: "XLAYER_MAINNET", chainId: 196, chainIndex: "196", status: "AVAILABLE", statusDetail: null, intention: "Native Transfer", assetChanges: [], gasUsed: "21000", failReason: null, risks: [], observedAt: "2026-08-21T00:00:00.000Z", durationMs: 10, httpStatus: 200, businessCode: "0" };
}

function ai(score = 12): AiAdvisoryRiskResult {
  return { score, level: "LOW", summary: "Advisory only", reasons: ["Review evidence"], recommendation: "Review before signing.", mode: "AI", providerProtocol: "responses", normalizedIntent: null };
}

async function analyze(sourceInput = input, aiResult: AiAdvisoryRiskResult | null = ai()) {
  return runAnalysisPipeline(sourceInput, { inspectContract: async () => intelligence(), simulate: async () => simulation(), analyzeAi: async () => aiResult });
}

function clone(receipt: AnalysisReceipt): AnalysisReceipt {
  return JSON.parse(JSON.stringify(receipt)) as AnalysisReceipt;
}

describe("V5 Analysis Receipt", function () {
  let receipt: AnalysisReceipt;

  before(async function () {
    receipt = (await analyze()).analysisReceipt;
  });

  it("produces the same fingerprint for the same receipt", async function () {
    expect(await fingerprintAnalysisReceipt(receipt)).to.equal(await fingerprintAnalysisReceipt(receipt));
  });

  it("canonicalizes property insertion order independently", function () {
    expect(canonicalizeAnalysisReceipt({ z: 1, a: { y: true, b: null } })).to.equal(canonicalizeAnalysisReceipt({ a: { b: null, y: true }, z: 1 }));
  });

  it("changes the fingerprint when a security-relevant value changes", async function () {
    const modified = clone(receipt);
    modified.assessment.finalRisk.score += 1;
    expect(await fingerprintAnalysisReceipt(modified)).not.to.equal(receipt.integrity.fingerprint);
  });

  it("preserves array order during canonicalization", function () {
    expect(canonicalizeAnalysisReceipt({ values: [1, 2, 3] })).not.to.equal(canonicalizeAnalysisReceipt({ values: [3, 2, 1] }));
  });

  it("excludes only the fingerprint field from its own hash", async function () {
    const modified = clone(receipt);
    modified.integrity.fingerprint = `sha256:${"f".repeat(64)}`;
    expect(await fingerprintAnalysisReceipt(modified)).to.equal(receipt.integrity.fingerprint);
  });

  it("includes the canonicalization identifier in the fingerprint payload", async function () {
    const modified = clone(receipt);
    modified.integrity.canonicalizationVersion = "future-c14n" as AnalysisReceipt["integrity"]["canonicalizationVersion"];
    expect(await fingerprintAnalysisReceipt(modified)).not.to.equal(receipt.integrity.fingerprint);
  });

  it("includes the hash algorithm identifier in the fingerprint payload", async function () {
    const modified = clone(receipt);
    modified.integrity.hashAlgorithm = "FUTURE" as AnalysisReceipt["integrity"]["hashAlgorithm"];
    expect(await fingerprintAnalysisReceipt(modified)).not.to.equal(receipt.integrity.fingerprint);
  });

  it("omits undefined object properties deterministically", function () {
    expect(canonicalizeAnalysisReceipt({ a: 1, omitted: undefined })).to.equal('{"a":1}');
  });

  it("rejects undefined array entries", function () {
    expect(() => canonicalizeAnalysisReceipt([1, undefined])).to.throw("undefined array entries");
  });

  it("rejects non-finite numbers", function () {
    expect(() => canonicalizeAnalysisReceipt({ score: Number.NaN })).to.throw("non-finite");
  });

  it("rejects malformed receipts", async function () {
    expect((await verifyAnalysisReceipt({ receiptType: "xguard.analysis-receipt" })).status).to.equal("INVALID RECEIPT FORMAT");
  });

  it("rejects unsupported schema versions cleanly", async function () {
    const modified = clone(receipt) as unknown as Record<string, unknown>;
    modified.schemaVersion = "2.0.0";
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("UNSUPPORTED RECEIPT VERSION");
  });

  it("rejects unsupported canonicalization versions cleanly", async function () {
    const modified = clone(receipt) as unknown as { integrity: Record<string, unknown> };
    modified.integrity.canonicalizationVersion = "future-c14n";
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("UNSUPPORTED RECEIPT VERSION");
  });

  it("rejects unsupported hash algorithms cleanly", async function () {
    const modified = clone(receipt) as unknown as { integrity: Record<string, unknown> };
    modified.integrity.hashAlgorithm = "FUTURE";
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("UNSUPPORTED RECEIPT VERSION");
  });

  it("rejects malformed fingerprints", function () {
    const modified = clone(receipt) as unknown as { integrity: Record<string, unknown> };
    modified.integrity.fingerprint = "sha256:not-a-hash";
    expect(receiptValidationStatus(modified)).to.equal("INVALID RECEIPT FORMAT");
  });

  it("rejects dangerous imported object keys", async function () {
    const modified = JSON.parse(JSON.stringify(receipt)) as Record<string, unknown>;
    const polluted = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    modified.evidence = { ...(modified.evidence as Record<string, unknown>), polluted };
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("INVALID RECEIPT FORMAT");
  });

  it("verifies an original generated receipt", async function () {
    expect((await verifyAnalysisReceipt(receipt)).status).to.equal("INTEGRITY VERIFIED");
  });

  it("fails verification after undigested tampering", async function () {
    const modified = clone(receipt);
    modified.transaction.to = "0x3333333333333333333333333333333333333333";
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("INTEGRITY CHECK FAILED");
  });

  it("accepts recomputed modified content only as internally consistent", async function () {
    const modified = clone(receipt);
    modified.assessment.verdict = "UNDETERMINED";
    modified.integrity.fingerprint = await fingerprintAnalysisReceipt(modified);
    expect((await verifyAnalysisReceipt(modified)).status).to.equal("INTEGRITY VERIFIED");
    expect(ANALYSIS_RECEIPT_INTEGRITY_NOTICE).to.include("does not prove the transaction is safe").and.to.include("signed by XGuard");
  });

  it("exports no user context, prompt or authorization metadata", function () {
    const exported = JSON.stringify(receipt);
    expect(exported).not.to.include(input.context);
    expect(exported).not.to.match(/"(?:authorization|headers|apiKey|secretKey|passphrase|prompt)"\s*:/i);
  });

  it("keeps AI advisory separate and unable to lower the deterministic floor", async function () {
    const riskyInput = { ...input, to: "0x0000000000000000000000000000000000000000" as Address };
    const result = await analyze(riskyInput, ai(0));
    expect(result.analysisReceipt.assessment.aiAdvisory?.score).to.equal(0);
    expect(result.analysisReceipt.assessment.finalRisk.score).to.equal(result.analysisReceipt.assessment.deterministicKnownRisk.score).and.to.be.at.least(65);
  });

  it("does not turn an empty OKX risk array into a safety claim", function () {
    expect(receipt.evidence.simulationEvidence.risks).to.deep.equal([]);
    expect(receipt.provenance.sources.find((source) => source.type === "OKX_ONCHAINOS")?.status).to.equal("AVAILABLE");
    expect(receipt.assessment.recommendation.toLowerCase()).not.to.include("confirmed safe");
  });

  it("invalidates the receipt with stale analysis after network or input edits", function () {
    const result = { analysisReceipt: receipt };
    for (const changed of [{ ...input, value: "1" }, { ...input, analysisNetwork: "XLAYER_TESTNET" as const }]) {
      const freshness = invalidateStaleAnalysis({ result, lastInput: input, reviewed: true }, changed);
      expect(freshness.snapshot.result).to.equal(null);
    }
  });

  it("replaces the analysis ID and receipt on every completed analysis", async function () {
    const next = await analyze();
    expect(next.analysisReceipt.analysisId).not.to.equal(receipt.analysisId);
    expect(next.analysisReceipt.integrity.fingerprint).not.to.equal(receipt.integrity.fingerprint);
  });
});
