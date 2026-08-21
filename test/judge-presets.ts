import { expect } from "chai";
import { judgePresets } from "../lib/presets.ts";
import { localRiskAnalysis } from "../lib/risk.ts";

describe("Judge demo preset regression", function () {
  it("keeps Safe Transfer LOW", function () {
    const result = localRiskAnalysis(judgePresets[0].input);
    expect(result.level).to.equal("LOW");
    expect(result.deterministicScore).to.equal(8);
  });

  it("keeps Unlimited Approval HIGH and human-readable", function () {
    const result = localRiskAnalysis(judgePresets[1].input);
    expect(result.level).to.equal("HIGH");
    expect(result.decodedAction.method).to.equal("approve(address,uint256)");
    expect(result.decodedAction.spender).to.be.a("string");
    expect(result.decodedAction.isUnlimited).to.equal(true);
  });

  it("keeps Suspicious Airdrop at the deterministic ceiling", function () {
    const result = localRiskAnalysis(judgePresets[2].input);
    expect(result.level).to.equal("HIGH");
    expect(result.deterministicScore).to.equal(100);
    expect(result.criticalSignals.map((signal) => signal.id)).to.include("unlimited-approval");
  });
});
