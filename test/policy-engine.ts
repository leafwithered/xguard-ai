import { expect } from "chai";
import { readFileSync } from "node:fs";
import type { Address } from "viem";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import { evaluatePreSignPolicy, isPolicyDecision, policyReasonCodes, XGUARD_POLICY_ID, XGUARD_POLICY_VERSION, type PolicyInputs } from "../lib/policy-engine.ts";
import { judgePresets } from "../lib/presets.ts";
import { getPolicyAction } from "../sdk/xguard.ts";

const baseline: PolicyInputs = {
  deterministicScore: 8,
  analysisConfidence: "HIGH",
  analysisVerdict: "ASSESSED",
  executionStatus: "SUCCEEDED",
  intentStatus: "MATCH",
  userIntentPresent: true,
  evidenceConsistency: "CONSISTENT",
  simulationStatus: "AVAILABLE",
  analysisNetwork: "XLAYER_MAINNET"
};

function decide(overrides: Partial<PolicyInputs> = {}) {
  return evaluatePreSignPolicy({ ...baseline, ...overrides });
}

function intelligence(address: string, overrides: Partial<ContractIntelligence> = {}): ContractIntelligence {
  return {
    network: "XLAYER_TESTNET",
    chainId: 1952,
    address: address as Address,
    addressType: "EOA",
    codePresent: false,
    codeSizeBytes: 0,
    proxyDetected: false,
    preflightStatus: "SUCCEEDED",
    estimatedGas: "21000",
    rpcStatus: "AVAILABLE",
    tokenStandard: "UNKNOWN",
    tokenStandardSource: "UNAVAILABLE",
    ...overrides
  };
}

async function runPreset(index: number, rpc = intelligence(judgePresets[index].input.to)) {
  return runAnalysisPipeline(judgePresets[index].input, {
    inspectContract: async () => rpc,
    analyzeAi: async () => null
  });
}

describe("Deterministic pre-sign policy engine", function () {
  it("returns ALLOW for the baseline", function () {
    expect(decide().decision).to.equal("ALLOW");
  });

  it("returns BLOCK_RECOMMENDED at score 70", function () {
    expect(decide({ deterministicScore: 70 }).decision).to.equal("BLOCK_RECOMMENDED");
  });

  it("returns BLOCK_RECOMMENDED above score 70", function () {
    expect(decide({ deterministicScore: 100 }).decision).to.equal("BLOCK_RECOMMENDED");
  });

  it("returns REQUIRE_REVIEW for LOW confidence", function () {
    expect(decide({ analysisConfidence: "LOW" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns REQUIRE_REVIEW for UNDETERMINED verdict", function () {
    expect(decide({ analysisVerdict: "UNDETERMINED" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns REQUIRE_REVIEW for reverted execution", function () {
    expect(decide({ executionStatus: "REVERTED" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns REQUIRE_REVIEW for unavailable execution", function () {
    expect(decide({ executionStatus: "UNAVAILABLE" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns REQUIRE_REVIEW for a stated-intent mismatch", function () {
    expect(decide({ intentStatus: "MISMATCH" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns WARN for a stated-intent partial match", function () {
    expect(decide({ intentStatus: "PARTIAL" }).decision).to.equal("WARN");
  });

  it("does not escalate missing intent with UNKNOWN status", function () {
    expect(decide({ intentStatus: "UNKNOWN", userIntentPresent: false }).decision).to.equal("ALLOW");
  });

  it("does not escalate an absent intent even if status is mismatch", function () {
    expect(decide({ intentStatus: "MISMATCH", userIntentPresent: false }).decision).to.equal("ALLOW");
  });

  it("returns REQUIRE_REVIEW for inconsistent evidence", function () {
    expect(decide({ evidenceConsistency: "INCONSISTENT" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("does not escalate NOT_COMPARABLE evidence", function () {
    expect(decide({ evidenceConsistency: "NOT_COMPARABLE" }).decision).to.equal("ALLOW");
  });

  it("returns WARN at score 30", function () {
    expect(decide({ deterministicScore: 30 }).decision).to.equal("WARN");
  });

  it("returns WARN at score 69", function () {
    expect(decide({ deterministicScore: 69 }).decision).to.equal("WARN");
  });

  it("returns WARN for MEDIUM confidence", function () {
    expect(decide({ analysisConfidence: "MEDIUM" }).decision).to.equal("WARN");
  });

  it("ignores unsupported simulation on Testnet", function () {
    expect(decide({ analysisNetwork: "XLAYER_TESTNET", simulationStatus: "UNSUPPORTED" }).decision).to.equal("ALLOW");
  });

  it("ignores unavailable simulation on Testnet", function () {
    expect(decide({ analysisNetwork: "XLAYER_TESTNET", simulationStatus: "UNAVAILABLE" }).decision).to.equal("ALLOW");
  });

  it("requires review for unavailable simulation on Mainnet", function () {
    expect(decide({ simulationStatus: "UNAVAILABLE" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("requires review for simulation error on Mainnet", function () {
    expect(decide({ simulationStatus: "ERROR" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("requires review for unsupported simulation on Mainnet", function () {
    expect(decide({ simulationStatus: "UNSUPPORTED" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("does not let available provider evidence override deterministic block", function () {
    expect(decide({ deterministicScore: 78, simulationStatus: "AVAILABLE" }).decision).to.equal("BLOCK_RECOMMENDED");
  });

  it("does not let available provider evidence override another review reason", function () {
    expect(decide({ analysisConfidence: "LOW", simulationStatus: "AVAILABLE" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("returns all applicable reasons in stable canonical order", function () {
    expect(decide({ deterministicScore: 78, analysisConfidence: "LOW", analysisVerdict: "UNDETERMINED", executionStatus: "REVERTED", intentStatus: "MISMATCH", evidenceConsistency: "INCONSISTENT", simulationStatus: "ERROR" }).reasonCodes).to.deep.equal([
      "DETERMINISTIC_HIGH_RISK", "LOW_CONFIDENCE", "VERDICT_UNDETERMINED", "EXECUTION_REVERTED", "INTENT_MISMATCH", "EVIDENCE_INCONSISTENT", "MAINNET_SIMULATION_UNAVAILABLE"
    ]);
  });

  it("keeps reason codes in the declared order", function () {
    const positions = decide({ deterministicScore: 35, analysisConfidence: "MEDIUM", intentStatus: "PARTIAL" }).reasonCodes.map((code) => policyReasonCodes.indexOf(code));
    expect(positions).to.deep.equal([...positions].sort((left, right) => left - right));
  });

  it("produces byte-for-byte identical results for identical inputs", function () {
    expect(JSON.stringify(decide())).to.equal(JSON.stringify(decide()));
  });

  it("returns a defensive input copy", function () {
    const input = { ...baseline };
    const result = evaluatePreSignPolicy(input);
    input.deterministicScore = 99;
    expect(result.inputs.deterministicScore).to.equal(8);
  });

  it("includes the stable policy identity and version", function () {
    expect(decide()).to.include({ policyId: XGUARD_POLICY_ID, policyVersion: XGUARD_POLICY_VERSION });
  });

  it("declares that AI did not influence the decision", function () {
    expect(decide().aiInfluencedDecision).to.equal(false);
  });

  it("has no AI or final-score policy inputs", function () {
    expect(Object.keys(decide().inputs)).not.to.include.members(["aiScore", "aiExplanation", "finalScore"]);
  });

  it("ignores extraneous AI fields at runtime", function () {
    const lowAi = evaluatePreSignPolicy({ ...baseline, aiScore: 0 } as PolicyInputs);
    const highAi = evaluatePreSignPolicy({ ...baseline, aiScore: 100 } as PolicyInputs);
    expect(highAi).to.deep.equal(lowAi);
  });

  it("uses block precedence over every review reason", function () {
    expect(decide({ deterministicScore: 70, analysisConfidence: "LOW", analysisVerdict: "UNDETERMINED", executionStatus: "REVERTED" }).decision).to.equal("BLOCK_RECOMMENDED");
  });

  it("uses review precedence over warn reasons", function () {
    expect(decide({ deterministicScore: 40, analysisConfidence: "LOW", intentStatus: "PARTIAL" }).decision).to.equal("REQUIRE_REVIEW");
  });

  it("validates a canonical result", function () {
    expect(isPolicyDecision(decide())).to.equal(true);
  });

  it("rejects policy objects with unknown fields", function () {
    expect(isPolicyDecision({ ...decide(), unsafeOverride: true })).to.equal(false);
  });

  it("rejects unbounded scores", function () {
    expect(isPolicyDecision({ ...decide(), inputs: { ...baseline, deterministicScore: 101 } })).to.equal(false);
  });

  it("rejects a policy decision inconsistent with its inputs", function () {
    expect(isPolicyDecision({ ...decide(), decision: "BLOCK_RECOMMENDED" })).to.equal(false);
  });

  it("rejects reason codes in a non-canonical order", function () {
    const result = decide({ deterministicScore: 40, analysisConfidence: "MEDIUM" });
    expect(isPolicyDecision({ ...result, reasonCodes: [...result.reasonCodes].reverse() })).to.equal(false);
  });

  it("lets the SDK return a validated action without duplicating rules", function () {
    expect(getPolicyAction({ policyDecision: decide({ deterministicScore: 40 }) })).to.equal("WARN");
  });
});

describe("V7 policy pipeline and UI integration", function () {
  it("maps Safe Transfer to ALLOW", async function () {
    expect((await runPreset(0)).policyDecision.decision).to.equal("ALLOW");
  });

  it("maps Ambiguous Approval to REQUIRE_REVIEW", async function () {
    expect((await runPreset(1)).policyDecision.decision).to.equal("REQUIRE_REVIEW");
  });

  it("maps Suspicious Airdrop to BLOCK_RECOMMENDED", async function () {
    const rpc = intelligence(judgePresets[2].input.to, { addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 6698, tokenStandard: "ERC721", tokenStandardSource: "ERC165" });
    expect((await runPreset(2, rpc)).policyDecision.decision).to.equal("BLOCK_RECOMMENDED");
  });

  it("keeps the V5 receipt schema outside the policy object", async function () {
    const result = await runPreset(0);
    expect(result.analysisReceipt.schemaVersion).to.equal("1.0.0");
    expect(result.analysisReceipt).not.to.have.property("policyDecision");
  });

  it("keeps policy as an adjacent API result field", async function () {
    const result = await runPreset(0);
    expect(result).to.have.property("analysisReceipt");
    expect(result).to.have.property("policyDecision");
  });

  it("renders Policy Guard only from the current active analysis", function () {
    const source = readFileSync("app/page.tsx", "utf8");
    expect(source).to.include('id="policy-guard"');
    expect(source).to.include("activeResult.policyDecision");
    expect(source).not.to.include("result.policyDecision");
  });

  it("navigates Judge Policy Guard without wallet, signing, or provider calls", function () {
    const source = readFileSync("app/page.tsx", "utf8");
    const start = source.indexOf("function scrollToPolicy");
    const end = source.indexOf("async function copyReceiptFingerprint", start);
    const handler = source.slice(start, end);
    expect(handler).to.include('document.getElementById("policy-guard")?.scrollIntoView');
    expect(handler).to.include("window.requestAnimationFrame");
    expect(handler).not.to.match(/request\s*\(|fetch\s*\(|sign|broadcast|analyz|simulate|wallet/i);
  });

  it("uses a mobile single-column policy layout with safe wrapping", function () {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).to.include(".policy-grid { grid-template-columns: 1fr; }");
    expect(css).to.include("overflow-wrap: anywhere");
    expect(css).to.include("word-break: break-word");
  });

  it("keeps wallet signature explicit in the integration example", function () {
    const source = readFileSync("examples/wallet-integration.ts", "utf8");
    expect(source).to.include("requestExplicitWalletSignature");
    expect(source).not.to.match(/privateKey|seed phrase|eth_requestAccounts|wallet_switchEthereumChain|sendTransaction/i);
  });

  it("contains no environment or secret dependency in SDK and example", function () {
    const source = `${readFileSync("sdk/xguard.ts", "utf8")}\n${readFileSync("examples/wallet-integration.ts", "utf8")}`;
    expect(source).not.to.match(/process\.env|API_KEY|SECRET_KEY|PASSPHRASE|PRIVATE_KEY|Authorization/i);
  });
});
