import { expect } from "chai";
import { encodeFunctionData, maxUint256 } from "viem";
import { decodeCalldata } from "../lib/calldata.ts";

const spender = "0x1234567890123456789012345678901234567890";
const recipient = "0x2222222222222222222222222222222222222222";
const owner = "0x3333333333333333333333333333333333333333";

describe("Calldata decoder", function () {
  it("decodes unlimited and limited approvals", function () {
    const abi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
    const unlimited = decodeCalldata(encodeFunctionData({ abi, functionName: "approve", args: [spender, maxUint256] }));
    const limited = decodeCalldata(encodeFunctionData({ abi, functionName: "approve", args: [spender, 250n] }));
    expect(unlimited.action).to.equal("ERC20 Approval");
    expect(unlimited.spender).to.equal(spender);
    expect(unlimited.isUnlimited).to.equal(true);
    expect(limited.isUnlimited).to.equal(false);
    expect(limited.amount).to.equal("250");
  });

  it("decodes transfer and transferFrom", function () {
    const transferAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
    const transferFromAbi = [{ type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
    const transfer = decodeCalldata(encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [recipient, 42n] }));
    const transferFrom = decodeCalldata(encodeFunctionData({ abi: transferFromAbi, functionName: "transferFrom", args: [owner, recipient, 99n] }));
    expect(transfer.recipient).to.equal(recipient);
    expect(transfer.amount).to.equal("42");
    expect(transferFrom.from).to.equal(owner);
    expect(transferFrom.recipient).to.equal(recipient);
    expect(transferFrom.amount).to.equal("99");
  });

  it("decodes setApprovalForAll true and false", function () {
    const abi = [{ type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }] as const;
    const enabled = decodeCalldata(encodeFunctionData({ abi, functionName: "setApprovalForAll", args: [spender, true] }));
    const disabled = decodeCalldata(encodeFunctionData({ abi, functionName: "setApprovalForAll", args: [spender, false] }));
    expect(enabled.operator).to.equal(spender);
    expect(enabled.approved).to.equal(true);
    expect(disabled.approved).to.equal(false);
  });

  it("returns safe unknown and malformed results", function () {
    expect(decodeCalldata("0xdeadbeef").status).to.equal("unknown");
    expect(decodeCalldata("0x095ea7b3").status).to.equal("malformed");
    expect(decodeCalldata("0x0").status).to.equal("malformed");
    expect(decodeCalldata("0x").status).to.equal("empty");
  });
});
