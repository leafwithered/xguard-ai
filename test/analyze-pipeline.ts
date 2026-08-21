import { expect } from "chai";
import { encodeFunctionData, maxUint256, type Address } from "viem";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { AiAdvisoryRiskResult } from "../lib/ai/provider.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import type { AnalysisEvidence } from "../lib/evidence.ts";
import type { RiskInput } from "../lib/risk.ts";

const target = "0x2222222222222222222222222222222222222222" as Address;
const actor = "0x1234567890123456789012345678901234567890" as Address;
const base: RiskInput = { from: "", to: target, value: "0.1", data: "0x", context: "Send 0.1 OKB to my friend" };
const approveAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;

function intelligence(overrides: Partial<ContractIntelligence> = {}): ContractIntelligence {
  return {
    address: target,
    addressType: "EOA",
    codePresent: false,
    codeSizeBytes: 0,
    proxyDetected: false,
    preflightStatus: "SUCCEEDED",
    estimatedGas: "21000",
    rpcStatus: "AVAILABLE",
    ...overrides
  };
}

function ai(score: number, summary = `AI score ${score}`): AiAdvisoryRiskResult {
  return {
    score,
    level: score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW",
    summary,
    reasons: [summary],
    recommendation: "Review the evidence before signing.",
    mode: "AI",
    providerProtocol: "responses",
    normalizedIntent: null
  };
}

async function run(input: RiskInput, rpc = intelligence(), aiResult: AiAdvisoryRiskResult | null = null) {
  return runAnalysisPipeline(input, {
    inspectContract: async () => rpc,
    analyzeAi: async () => aiResult
  });
}

describe("Evidence-first analysis pipeline", function () {
  it("A keeps unknown selectors LOW-confidence and UNDETERMINED even when AI says LOW", async function () {
    const result = await run({ ...base, data: "0x12345678", context: "Proceed" }, intelligence(), ai(1, "Benign interaction"));
    expect(result.level).to.equal("LOW");
    expect(result.analysisConfidence).to.equal("LOW");
    expect(result.analysisVerdict).to.equal("UNDETERMINED");
    expect(result.recommendation).to.include("must not be interpreted as confirmation of safety");
    expect(result.summary).not.to.include("No obvious high-risk");
  });

  it("B keeps malformed known calldata LOW-confidence and UNDETERMINED", async function () {
    const result = await run({ ...base, data: "0x095ea7b3", context: "Approve" }, intelligence(), ai(1));
    expect(result.analysisConfidence).to.equal("LOW");
    expect(result.analysisVerdict).to.equal("UNDETERMINED");
    expect(result.recommendation).to.include("malformed calldata");
  });

  it("C assesses a safe native transfer with successful preflight independently of risk", async function () {
    const result = await run(base);
    expect(result.level).to.equal("LOW");
    expect(result.analysisConfidence).to.equal("HIGH");
    expect(result.analysisVerdict).to.equal("ASSESSED");
    expect(result.executionStatus).to.equal("SUCCEEDED");
  });

  it("D preserves local analysis and reduces confidence when RPC is unavailable", async function () {
    const result = await run(base, intelligence({ addressType: "UNAVAILABLE", codePresent: null, codeSizeBytes: null, proxyDetected: null, preflightStatus: "UNAVAILABLE", estimatedGas: undefined, rpcStatus: "UNAVAILABLE" }));
    expect(result.mode).to.equal("LOCAL");
    expect(result.level).to.equal("LOW");
    expect(result.analysisConfidence).to.equal("MEDIUM");
    expect(result.executionStatus).to.equal("UNAVAILABLE");
  });

  it("E reports a reverted preflight without arbitrarily raising malicious risk", async function () {
    const result = await run(base, intelligence({ preflightStatus: "REVERTED", revertReason: "Error: paused", estimatedGas: undefined, rpcStatus: "PARTIAL" }));
    expect(result.level).to.equal("LOW");
    expect(result.finalScore).to.equal(8);
    expect(result.executionStatus).to.equal("REVERTED");
    expect(result.recommendation).to.include("would revert");
    expect(result.summary).not.to.include("succeeded");
  });

  it("F exposes EIP-1967 proxy evidence without adding malicious-risk points", async function () {
    const result = await run(base, intelligence({ addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 240, proxyDetected: true, implementationAddress: actor }));
    expect(result.finalScore).to.equal(8);
    expect(result.contractIntelligence.proxyDetected).to.equal(true);
    expect(result.analysisConfidence).to.equal("MEDIUM");
    expect(result.advisorySignals.map((item) => item.id)).to.include("eip1967-proxy");
  });

  it("G sends normalized RPC, preflight and code facts to AI before fusion", async function () {
    let received: AnalysisEvidence | null = null;
    const rpc = intelligence({ addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 321, proxyDetected: false, preflightStatus: "REVERTED", revertReason: "Error: denied", estimatedGas: undefined, rpcStatus: "PARTIAL" });
    await runAnalysisPipeline(base, { inspectContract: async () => rpc, analyzeAi: async (evidence) => { received = evidence; return ai(9); } });
    expect(received).not.to.equal(null);
    expect(received!.contract).to.deep.include({ addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 321, proxyDetected: false });
    expect(received!.execution).to.deep.include({ status: "REVERTED", revertReason: "Error: denied", rpcStatus: "PARTIAL" });
    expect(received!.consequences.map((item) => item.id)).to.include("preflight-revert");
  });

  it("H preserves an intent-mismatch deterministic floor against a lower AI score", async function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] });
    const result = await run({ ...base, value: "0", data, context: "Only approve 50 USDC" }, intelligence({ addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 120 }), ai(1));
    expect(result.finalScore).to.equal(result.deterministicScore);
    expect(result.finalScore).to.be.at.least(78);
    expect(result.recommendation.match(/The stated intent and decoded transaction do not match\./g)).to.have.length(1);
  });

  it("I derives confidence, verdict and execution deterministically when AI is unavailable", async function () {
    const result = await run(base, intelligence(), null);
    expect(result.mode).to.equal("LOCAL");
    expect(result.analysisConfidence).to.equal("HIGH");
    expect(result.analysisVerdict).to.equal("ASSESSED");
    expect(result.executionStatus).to.equal("SUCCEEDED");
  });

  it("J ignores a confident benign AI narrative for unknown-behavior confidence and verdict", async function () {
    const benign = ai(0, "Definitely benign");
    benign.normalizedIntent = { action: "TOKEN_TRANSFER", scope: "NONE", amount: null, asset: null, recipient: null, confidence: "HIGH" };
    const result = await run({ ...base, data: "0xabcdef12", context: "do it" }, intelligence(), benign);
    expect(result.analysisConfidence).to.equal("LOW");
    expect(result.analysisVerdict).to.equal("UNDETERMINED");
    expect(result.recommendation).to.include("cannot fully decode");
  });

  it("constructs consequences from deterministic and RPC evidence independently of adversarial AI", async function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] });
    const input = { ...base, value: "0", data, context: "Approve" };
    const withoutAi = await run(input, intelligence(), null);
    const adversarial = await run(input, intelligence(), ai(0, "Nothing happens"));
    expect(adversarial.consequences).to.deep.equal(withoutAi.consequences);
    expect(adversarial.consequences[0].title).to.equal("Effectively unlimited token approval");
  });
});
