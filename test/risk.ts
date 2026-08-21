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
    expect(validateRiskInput({ ...baseInput, value: "Infinity" })).to.deep.equal(["Value must be a finite non-negative decimal with up to 18 decimals"]);
    expect(validateRiskInput({ ...baseInput, value: "1e2" })).to.deep.equal(["Value must be a finite non-negative decimal with up to 18 decimals"]);
    expect(validateRiskInput({ ...baseInput, data: "0x0" })).to.deep.equal(["Transaction data must be valid even-length hex beginning with 0x and under 10,000 characters"]);
  });

  it("keeps maxUint approve ambiguous without unsupported ERC20 claims", function () {
    const result = localRiskAnalysis({
      ...baseInput,
      to: "0x0000000000000000000000000000000000000000",
      value: "12",
      data: `0x095ea7b3${"0".repeat(24)}1234567890123456789012345678901234567890${"f".repeat(64)}`,
      context: "Urgent airdrop claim on an unknown contract"
    });
    expect(result.level).to.equal("HIGH");
    expect(result.score).to.equal(100);
    expect(result.reasons.join(" ")).to.include("unresolved ERC20/ERC721 semantics");
    expect(result.criticalSignals.map((signal) => signal.id)).not.to.include("unlimited-approval");
    expect(result.advisorySignals.map((signal) => signal.id)).to.include("ambiguous-approval");
  });

  it("keeps ordinary native transfers low risk", function () {
    const result = localRiskAnalysis(baseInput);
    expect(result.level).to.equal("LOW");
    expect(result.score).to.equal(8);
    expect(result.mode).to.equal("LOCAL");
    expect(result.finalScore).to.equal(8);
    expect(result.decodedAction.status).to.equal("empty");
  });

  it("uses exact decimal parsing and enforces input limits", function () {
    expect(validateRiskInput({ ...baseInput, value: "0.000000000000000001" })).to.deep.equal([]);
    expect(validateRiskInput({ ...baseInput, value: "0.0000000000000000001" })[0]).to.include("up to 18 decimals");
    expect(validateRiskInput({ ...baseInput, value: "1000001" })[0]).to.include("supported maximum");
    expect(validateRiskInput({ ...baseInput, context: "x".repeat(2001) })[0]).to.include("under 2,000 characters");
    expect(validateRiskInput({ ...baseInput, data: `0x${"00".repeat(5000)}` })[0]).to.include("under 10,000 characters");
  });
});
