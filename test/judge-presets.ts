import { expect } from "chai";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import { compareIntentToReality } from "../lib/intent.ts";
import { judgePresets } from "../lib/presets.ts";
import { localRiskAnalysis } from "../lib/risk.ts";

describe("Judge demo preset regression", function () {
  it("keeps Safe Transfer LOW", function () {
    const result = localRiskAnalysis(judgePresets[0].input);
    expect(result.level).to.equal("LOW");
    expect(result.deterministicScore).to.equal(8);
    const consequences = buildTransactionConsequences(judgePresets[0].input, { decodedAction: result.decodedAction });
    expect(compareIntentToReality(judgePresets[0].input, result.decodedAction, consequences).status).to.equal("MATCH");
  });

  it("keeps the legacy Unlimited Approval preset explicitly ambiguous", function () {
    const result = localRiskAnalysis(judgePresets[1].input);
    expect(result.level).to.equal("LOW");
    expect(result.decodedAction.method).to.equal("approve(address,uint256)");
    expect(result.decodedAction.operatorOrSpender).to.be.a("string");
    expect(result.decodedAction.assetStandard).to.equal("UNKNOWN");
    expect(result.criticalSignals.map((signal) => signal.id)).not.to.include("unlimited-approval");
  });

  it("keeps Suspicious Airdrop at the deterministic ceiling", function () {
    const result = localRiskAnalysis(judgePresets[2].input);
    expect(result.level).to.equal("HIGH");
    expect(result.deterministicScore).to.equal(100);
    expect(result.advisorySignals.map((signal) => signal.id)).to.include("ambiguous-approval");
  });
});
