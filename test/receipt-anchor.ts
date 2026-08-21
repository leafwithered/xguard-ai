import { expect } from "chai";
import { readFileSync } from "node:fs";
import hardhat from "hardhat";

const { ethers } = hardhat;
const source = readFileSync("contracts/XGuardReceiptAnchor.sol", "utf8");

async function expectRejected(action: Promise<unknown>, message?: string) {
  try {
    await action;
    expect.fail("Expected action to reject");
  } catch (error) {
    if (message) expect(error instanceof Error ? error.message : String(error)).to.include(message);
  }
}

describe("XGuardReceiptAnchor", function () {
  it("deploys successfully without constructor arguments", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    await anchor.waitForDeployment();
    expect(await anchor.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
  });

  it("rejects the zero digest", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    await expectRejected(anchor.anchor(ethers.ZeroHash), "receipt digest required");
  });

  it("anchors a valid bytes32 digest", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("receipt"));
    await anchor.anchor(digest);
  });

  it("sets anchored digest state to true", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("state"));
    await anchor.anchor(digest);
    expect(await anchor.anchored(digest)).to.equal(true);
  });

  it("emits the exact receipt digest", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("event-digest"));
    const receipt = await (await anchor.anchor(digest)).wait();
    const event = receipt?.logs.find((log: unknown) => typeof log === "object" && log !== null && "fragment" in log && (log as { fragment?: { name?: string } }).fragment?.name === "ReceiptAnchored") as { args?: readonly unknown[] } | undefined;
    expect(event?.args?.[0]).to.equal(digest);
  });

  it("emits msg.sender as submitter", async function () {
    const [submitter] = await ethers.getSigners();
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const receipt = await (await anchor.anchor(ethers.sha256(ethers.toUtf8Bytes("submitter")))).wait();
    const event = receipt?.logs.find((log: unknown) => typeof log === "object" && log !== null && "fragment" in log && (log as { fragment?: { name?: string } }).fragment?.name === "ReceiptAnchored") as { args?: readonly unknown[] } | undefined;
    expect(event?.args?.[1]).to.equal(submitter.address);
  });

  it("emits the transaction block timestamp", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const receipt = await (await anchor.anchor(ethers.sha256(ethers.toUtf8Bytes("timestamp")))).wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const event = receipt?.logs.find((log: unknown) => typeof log === "object" && log !== null && "fragment" in log && (log as { fragment?: { name?: string } }).fragment?.name === "ReceiptAnchored") as { args?: readonly unknown[] } | undefined;
    expect(event?.args?.[2]).to.equal(BigInt(block!.timestamp));
  });

  it("allows an explicit duplicate anchor", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("duplicate"));
    await anchor.anchor(digest);
    await anchor.anchor(digest);
  });

  it("keeps duplicate anchored state true", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const digest = ethers.sha256(ethers.toUtf8Bytes("duplicate-state"));
    await anchor.anchor(digest);
    await anchor.anchor(digest);
    expect(await anchor.anchored(digest)).to.equal(true);
  });

  it("keeps different receipt digests independent", async function () {
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const first = ethers.sha256(ethers.toUtf8Bytes("first"));
    const second = ethers.sha256(ethers.toUtf8Bytes("second"));
    await anchor.anchor(first);
    expect(await anchor.anchored(first)).to.equal(true);
    expect(await anchor.anchored(second)).to.equal(false);
  });

  it("does not accept or transfer native funds", async function () {
    const [submitter] = await ethers.getSigners();
    const anchor = await (await ethers.getContractFactory("XGuardReceiptAnchor")).deploy();
    const address = await anchor.getAddress();
    await expectRejected(submitter.sendTransaction({ to: address, value: 1n }));
    expect(await ethers.provider.getBalance(address)).to.equal(0n);
  });

  it("has no owner surface", async function () {
    const abi = (await hardhat.artifacts.readArtifact("XGuardReceiptAnchor")).abi;
    expect(abi.some((entry) => entry.type === "function" && entry.name?.toLowerCase().includes("owner"))).to.equal(false);
  });

  it("has no admin setter", async function () {
    const abi = (await hardhat.artifacts.readArtifact("XGuardReceiptAnchor")).abi;
    expect(abi.some((entry) => entry.type === "function" && /admin|set/i.test(entry.name ?? ""))).to.equal(false);
  });

  it("has no arbitrary-call primitive", function () {
    expect(source).not.to.match(/\.call\s*[({]|function\s+execute|function\s+forward/i);
  });

  it("has no delegatecall", function () {
    expect(source).not.to.match(/delegatecall/i);
  });

  it("has no selfdestruct", function () {
    expect(source).not.to.match(/selfdestruct/i);
  });

  it("has no upgradeability mechanism", function () {
    expect(source).not.to.match(/upgrade|implementation|proxy|initializer/i);
  });
});
