import { expect } from "chai";
import { encodeFunctionData, maxUint256 } from "viem";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import type { RiskInput } from "../lib/risk.ts";

const target = "0x2222222222222222222222222222222222222222";
const actor = "0x1234567890123456789012345678901234567890";
const base: RiskInput = { from: "", to: target, value: "0", data: "0x", context: "" };
const approveAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const transferAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const transferFromAbi = [{ type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const operatorAbi = [{ type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }] as const;

describe("Transaction Consequence Engine", function () {
  it("describes a native OKB transfer from value evidence", function () {
    const [result] = buildTransactionConsequences({ ...base, value: "0.25" });
    expect(result.description).to.equal(`You will send 0.25 OKB to ${target}.`);
    expect(result.evidenceSource).to.equal("VALUE");
  });

  it("does not fabricate an asset movement for an empty zero-value call", function () {
    const [result] = buildTransactionConsequences(base);
    expect(result.title).to.equal("No method or native value encoded");
    expect(result.description).to.include("0 OKB");
  });

  it("describes ERC20 transfer in raw units without inventing token metadata", function () {
    const data = encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [actor, 250n] });
    const [result] = buildTransactionConsequences({ ...base, data });
    expect(result.description).to.include("250 raw token units");
    expect(result.description).to.include("Token identity and decimals are not inferred");
  });

  it("distinguishes finite from unlimited ERC20 approval", function () {
    const finite = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, 100n] }) })[0];
    const unlimited = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] }) })[0];
    expect(finite.title).to.equal("Finite token approval");
    expect(finite.description).to.include("100 raw token units");
    expect(unlimited.title).to.equal("Effectively unlimited token approval");
    expect(unlimited.severity).to.equal("CRITICAL");
  });

  it("describes transferFrom as an allowance-based transfer", function () {
    const data = encodeFunctionData({ abi: transferFromAbi, functionName: "transferFrom", args: [target, actor, 5n] });
    const [result] = buildTransactionConsequences({ ...base, data });
    expect(result.description).to.include(`from ${target} to ${actor}`);
    expect(result.description).to.include("existing allowance");
  });

  it("describes NFT operator grant and revocation", function () {
    const grant = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, true] }) })[0];
    const revoke = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, false] }) })[0];
    expect(grant.description).to.include("all NFTs from this collection");
    expect(grant.severity).to.equal("CRITICAL");
    expect(revoke.description).to.include("revoke collection-wide transfer permission");
  });

  it("labels unknown and malformed calldata without inventing behavior", function () {
    const unknown = buildTransactionConsequences({ ...base, data: "0x12345678" })[0];
    const malformed = buildTransactionConsequences({ ...base, data: "0x095ea7b3" })[0];
    expect(unknown.description).to.include("cannot deterministically describe");
    expect(unknown.confidence).to.equal("MEDIUM");
    expect(malformed.description).to.include("malformed");
  });

  it("separates native value sent alongside a decoded contract call", function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, 1n] });
    const results = buildTransactionConsequences({ ...base, data, value: "1.5" });
    expect(results).to.have.length(2);
    expect(results[1].evidenceSource).to.equal("VALUE");
    expect(results[1].description).to.include("also sends 1.5 OKB");
  });

  it("adds factual on-chain observations without claiming full simulation", function () {
    const results = buildTransactionConsequences(base, { intelligence: { address: target, addressType: "EOA", codePresent: false, codeSizeBytes: 0, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "21000", rpcStatus: "AVAILABLE" } });
    expect(results.some((item) => item.id === "target-eoa" && item.evidenceSource === "ON_CHAIN")).to.equal(true);
    expect(results.find((item) => item.id === "preflight-succeeded")?.description).to.include("not a full state-diff simulation");
  });
});
