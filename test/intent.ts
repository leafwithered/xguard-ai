import { expect } from "chai";
import { encodeFunctionData, maxUint256 } from "viem";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import { applyIntentRisk, compareIntentToReality, normalizeIntentDeterministically } from "../lib/intent.ts";
import { localRiskAnalysis, type RiskInput } from "../lib/risk.ts";

const target = "0x2222222222222222222222222222222222222222" as const;
const spender = "0x1234567890123456789012345678901234567890" as const;
const base: RiskInput = { from: "", to: target, value: "0", data: "0x", context: "" };
const approveAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const operatorAbi = [{ type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }] as const;

function compare(input: RiskInput) {
  const local = localRiskAnalysis(input);
  const consequences = buildTransactionConsequences(input, { decodedAction: local.decodedAction });
  return { local, consequences, comparison: compareIntentToReality(input, local.decodedAction, consequences) };
}

describe("Intent vs Reality", function () {
  it("normalizes explicit intent without AI", function () {
    expect(normalizeIntentDeterministically("I only want to approve 50 USDC")).to.include({ action: "APPROVE", scope: "FINITE", amount: "50", asset: "USDC", source: "DETERMINISTIC" });
  });

  it("returns UNKNOWN when the optional intent is empty", function () {
    expect(compare(base).comparison.status).to.equal("UNKNOWN");
  });

  it("matches an exact native OKB transfer", function () {
    const input = { ...base, value: "0.1", context: "I am sending 0.1 OKB to my friend" };
    expect(compare(input).comparison.status).to.equal("MATCH");
  });

  it("detects a native transfer amount mismatch", function () {
    const input = { ...base, value: "1", context: "I am sending 0.1 OKB to my friend" };
    const comparison = compare(input).comparison;
    expect(comparison.status).to.equal("MISMATCH");
    expect(comparison.deterministicMismatch).to.equal(true);
  });

  it("does not infer a finite-vs-unlimited mismatch while approve standard is unresolved", function () {
    const input = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, maxUint256] }), context: "I only want to approve 50 USDC" };
    const { local, comparison } = compare(input);
    const raised = applyIntentRisk(local, comparison);
    expect(comparison.status).to.equal("UNKNOWN");
    expect(comparison.why).to.include("target standard is unresolved");
    expect(raised.deterministicScore).to.equal(local.deterministicScore);
  });

  it("does not compare a human approval amount with raw uint256 units", function () {
    const input = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, 50n] }), context: "I only want to approve 50 USDC" };
    const comparison = compare(input).comparison;
    expect(comparison.status).to.equal("UNKNOWN");
    expect(comparison.why).to.include("cannot compare a human token allowance");
  });

  it("applies the approval-scope floor only when ERC20 semantics are independently trusted", function () {
    const input = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, maxUint256] }), context: "I only want to approve 50 USDC" };
    const local = localRiskAnalysis(input);
    const decoded = { ...local.decodedAction, action: "ERC20 Approval", assetStandard: "ERC20" as const, spender, amount: maxUint256.toString(), isUnlimited: true };
    const consequences = buildTransactionConsequences(input, { decodedAction: decoded });
    const comparison = compareIntentToReality(input, decoded, consequences);
    expect(comparison).to.include({ status: "MISMATCH", mismatchType: "APPROVAL_SCOPE" });
    expect(applyIntentRisk({ ...local, decodedAction: decoded }, comparison).deterministicScore).to.be.at.least(78);
  });

  it("detects a claim intent versus unlimited approval", function () {
    const input = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, maxUint256] }), context: "I only want to claim an airdrop" };
    expect(compare(input).comparison).to.include({ status: "MISMATCH", deterministicMismatch: true, normalizationSource: "DETERMINISTIC" });
  });

  it("detects a claim intent versus collection-wide NFT permission", function () {
    const input = { ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [spender, true] }), context: "Claim my NFT reward" };
    expect(compare(input).comparison.status).to.equal("MISMATCH");
  });

  it("matches an NFT operator revocation", function () {
    const input = { ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [spender, false] }), context: "Revoke the NFT operator permission" };
    expect(compare(input).comparison.status).to.equal("MATCH");
  });

  it("marks swap intent versus approval as PARTIAL", function () {
    const input = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, 100n] }), context: "Swap 100 USDC to USDT" };
    expect(compare(input).comparison.status).to.equal("PARTIAL");
  });

  it("uses AI normalization only when deterministic normalization is unknown", function () {
    const input = { ...base, value: "0.1", context: "Proceed with my intended payment" };
    const local = localRiskAnalysis(input);
    const consequences = buildTransactionConsequences(input, { decodedAction: local.decodedAction });
    const comparison = compareIntentToReality(input, local.decodedAction, consequences, { action: "NATIVE_TRANSFER", scope: "NONE", amount: "0.1", asset: "OKB", recipient: null, confidence: "HIGH" });
    expect(comparison).to.include({ status: "MATCH", normalizationSource: "AI_ASSISTED", deterministicMismatch: false });
  });

  it("degrades to UNKNOWN when AI is unavailable for ambiguous intent", function () {
    const input = { ...base, context: "Proceed with the requested action" };
    expect(compare(input).comparison).to.include({ status: "UNKNOWN", normalizationSource: "DETERMINISTIC" });
  });

  it("keeps unsupported calldata UNKNOWN instead of trusting intent", function () {
    const input = { ...base, data: "0x12345678", context: "I am sending 0.1 OKB" };
    expect(compare(input).comparison.status).to.equal("UNKNOWN");
  });

  it("never lowers an existing deterministic floor", function () {
    const input = { ...base, to: "0x0000000000000000000000000000000000000000", context: "I am sending 0.1 OKB" };
    const { local, comparison } = compare(input);
    const raised = applyIntentRisk(local, comparison);
    expect(raised.deterministicScore).to.be.at.least(local.deterministicScore);
    expect(raised.finalScore).to.be.at.least(raised.deterministicScore);
  });
});
