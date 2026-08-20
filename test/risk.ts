import { expect } from "chai";
import { localRiskAnalysis, validateRiskInput, type RiskInput } from "../lib/risk.ts";

const baseInput: RiskInput = {
  from: "",
  to: "0x1111111111111111111111111111111111111111",
  value: "0",
  data: "0x",
  context: "Normal transfer"
};

describe("Risk Engine", function () {
  it("rejects malformed request bodies and non-finite values", function () {
    expect(validateRiskInput(null as unknown as RiskInput)).to.deep.equal(["Request body must be an object"]);
    expect(validateRiskInput({ ...baseInput, value: "Infinity" })).to.deep.equal(["Value must be a finite non-negative number"]);
    expect(validateRiskInput({ ...baseInput, data: "0x0" })).to.deep.equal(["Transaction data must be valid even-length hex beginning with 0x"]);
  });

  it("detects zero-address and unlimited approval signals", function () {
    const result = localRiskAnalysis({
      ...baseInput,
      to: "0x0000000000000000000000000000000000000000",
      value: "12",
      data: `0x095ea7b3${"0".repeat(24)}1234567890123456789012345678901234567890${"f".repeat(64)}`,
      context: "Urgent airdrop claim on an unknown contract"
    });
    expect(result.level).to.equal("HIGH");
    expect(result.score).to.equal(100);
    expect(result.reasons.join(" ")).to.include("Unlimited ERC20 approval amount detected");
  });

  it("keeps ordinary native transfers low risk", function () {
    const result = localRiskAnalysis(baseInput);
    expect(result.level).to.equal("LOW");
    expect(result.score).to.equal(8);
    expect(result.mode).to.equal("LOCAL");
  });
});
