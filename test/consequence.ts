import { expect } from "chai";
import { encodeFunctionData, maxUint256 } from "viem";
import { resolveDecodedAction } from "../lib/calldata.ts";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import { localRiskAnalysis } from "../lib/risk.ts";
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
    expect(result.description).to.include(`You will send 0.25 OKB to ${target}`);
    expect(result.description).to.include("receive/fallback");
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

  it("keeps finite and maxUint approve calls ambiguous without token-standard evidence", function () {
    const finite = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, 100n] }) })[0];
    const unlimited = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] }) })[0];
    expect(finite.title).to.include("unresolved standard");
    expect(finite.description).to.include("ERC20 allowance or an ERC721 token ID");
    expect(unlimited.title).to.include("unresolved standard");
    expect(unlimited.title).not.to.include("unlimited");
    expect(unlimited.severity).to.equal("CAUTION");
  });

  it("describes transferFrom without treating uint256 as a fungible amount", function () {
    const data = encodeFunctionData({ abi: transferFromAbi, functionName: "transferFrom", args: [target, actor, 5n] });
    const [result] = buildTransactionConsequences({ ...base, data });
    expect(result.description).to.include(`from ${target} to ${actor}`);
    expect(result.description).to.include("fungible-token units or an NFT token ID");
    expect(result.description).not.to.include("existing allowance");
  });

  it("describes NFT operator grant and revocation", function () {
    const grant = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, true] }) })[0];
    const revoke = buildTransactionConsequences({ ...base, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, false] }) })[0];
    expect(grant.description).to.include("NFT or multi-token contract");
    expect(grant.description).to.include("does not infer ERC721, ERC1155, or collection identity");
    expect(grant.severity).to.equal("CRITICAL");
    expect(revoke.description).to.include("revoke contract-wide asset permission");
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
    const results = buildTransactionConsequences(base, { intelligence: { address: target, addressType: "EOA", codePresent: false, codeSizeBytes: 0, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "21000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" } });
    expect(results.some((item) => item.id === "target-eoa" && item.evidenceSource === "ON_CHAIN")).to.equal(true);
    expect(results.find((item) => item.id === "preflight-succeeded")?.description).to.include("not a full state-diff simulation");
  });

  it("distinguishes native value sent to an EOA from value sent to a smart contract", function () {
    const eoa = buildTransactionConsequences({ ...base, value: "0.25" }, { intelligence: { address: target, addressType: "EOA", codePresent: false, codeSizeBytes: 0, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "21000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" } })[0];
    const contract = buildTransactionConsequences({ ...base, value: "0.25" }, { intelligence: { address: target, addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 10, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "30000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "ERC165" } })[0];
    expect(eoa.description).to.include("externally owned account");
    expect(contract.description).to.include("receive/fallback logic");
    expect(contract.description).to.include("does not claim this is equivalent to a simple EOA transfer");
  });

  it("uses positive ERC721 evidence to interpret approve and transferFrom uint256 as token IDs", function () {
    const approveInput = { ...base, data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, 123n] }) };
    const approveDecoded = localRiskAnalysis(approveInput, { tokenStandard: "ERC721" }).decodedAction;
    const transferInput = { ...base, data: encodeFunctionData({ abi: transferFromAbi, functionName: "transferFrom", args: [target, actor, 456n] }) };
    const transferDecoded = resolveDecodedAction(localRiskAnalysis(transferInput).decodedAction, "ERC721");
    expect(buildTransactionConsequences(approveInput, { decodedAction: approveDecoded })[0].description).to.include("NFT token ID 123");
    expect(buildTransactionConsequences(transferInput, { decodedAction: transferDecoded })[0].description).to.include("NFT token ID 456");
  });
});
