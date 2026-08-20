import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("RiskRegistry", function () {
  it("records an assessment and emits an event", async function () {
    const [user] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("RiskRegistry")).deploy();
    const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("xguard-assessment"));

    const transaction = await registry.recordAssessment(analysisHash, 72);
    const receipt = await transaction.wait();
    const event = receipt?.logs.find((log: unknown) => typeof log === "object" && log !== null && "fragment" in log && (log as { fragment?: { name?: string } }).fragment?.name === "RiskAssessmentRecorded") as { args?: readonly unknown[] } | undefined;
    expect(event?.args?.[0]).to.equal(analysisHash);
    expect(event?.args?.[1]).to.equal(user.address);
    expect(event?.args?.[2]).to.equal(72n);
    expect(event?.args?.[3]).to.be.a("bigint");

    const assessment = await registry.assessments(analysisHash);
    expect(assessment.user).to.equal(user.address);
    expect(assessment.riskScore).to.equal(72n);
    expect(assessment.timestamp > 0n).to.equal(true);
  });

  it("accepts both score boundaries", async function () {
    const registry = await (await ethers.getContractFactory("RiskRegistry")).deploy();
    const lowHash = ethers.keccak256(ethers.toUtf8Bytes("low-score"));
    const highHash = ethers.keccak256(ethers.toUtf8Bytes("high-score"));
    await registry.recordAssessment(lowHash, 0);
    await registry.recordAssessment(highHash, 100);
    expect((await registry.assessments(lowHash)).riskScore).to.equal(0n);
    expect((await registry.assessments(highHash)).riskScore).to.equal(100n);
  });

  it("rejects invalid hashes and scores", async function () {
    const registry = await (await ethers.getContractFactory("RiskRegistry")).deploy();
    const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("invalid-score"));
    let zeroHashReverted = false;
    try {
      await registry.recordAssessment(ethers.ZeroHash, 50);
    } catch {
      zeroHashReverted = true;
    }
    expect(zeroHashReverted).to.equal(true);
    let reverted = false;
    try {
      await registry.recordAssessment(analysisHash, 101);
    } catch {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });

  it("does not accept native value", async function () {
    const registry = await (await ethers.getContractFactory("RiskRegistry")).deploy();
    const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("nonpayable"));
    let reverted = false;
    try {
      await registry.recordAssessment(analysisHash, 50, { value: 1n });
    } catch {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });

  it("records the latest assessment for each hash and supports multiple users", async function () {
    const [firstUser, secondUser] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("RiskRegistry")).deploy();
    const firstHash = ethers.keccak256(ethers.toUtf8Bytes("first-user"));
    const secondHash = ethers.keccak256(ethers.toUtf8Bytes("second-user"));

    await (registry.connect(firstUser) as any).recordAssessment(firstHash, 20);
    await (registry.connect(secondUser) as any).recordAssessment(secondHash, 80);
    await (registry.connect(secondUser) as any).recordAssessment(firstHash, 90);

    expect((await registry.assessments(firstHash)).user).to.equal(secondUser.address);
    expect((await registry.assessments(firstHash)).riskScore).to.equal(90n);
    expect((await registry.assessments(secondHash)).user).to.equal(secondUser.address);
    expect((await registry.assessments(secondHash)).riskScore).to.equal(80n);
  });
});
