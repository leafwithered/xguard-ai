import { expect } from "chai";
import { currentAnalysisResult, invalidateStaleAnalysis, staleAnalysisNotice } from "../lib/analysis-state.ts";
import type { RiskInput } from "../lib/risk.ts";

const analyzedInput: RiskInput = {
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  value: "0",
  data: "0x",
  context: "Known transfer",
  analysisNetwork: "XLAYER_TESTNET"
};

describe("Analysis freshness", function () {
  it("keeps the result only while every transaction field is unchanged", function () {
    const result = { finalScore: 8 };
    const state = invalidateStaleAnalysis({ result, lastInput: analyzedInput, reviewed: true }, { ...analyzedInput });
    expect(state.invalidated).to.equal(false);
    expect(state.snapshot.result).to.equal(result);
    expect(state.snapshot.reviewed).to.equal(true);
  });

  it("invalidates the result, review and input snapshot after any transaction field changes", function () {
    const changes: Array<Partial<RiskInput>> = [
      { from: "0x3333333333333333333333333333333333333333" },
      { to: "0x4444444444444444444444444444444444444444" },
      { value: "1" },
      { data: "0x1234" },
      { context: "Changed intent" },
      { analysisNetwork: "XLAYER_MAINNET" }
    ];
    for (const change of changes) {
      const state = invalidateStaleAnalysis({ result: { finalScore: 8 }, lastInput: analyzedInput, reviewed: true }, { ...analyzedInput, ...change });
      expect(state.invalidated, JSON.stringify(change)).to.equal(true);
      expect(state.snapshot.result).to.equal(null);
      expect(state.snapshot.lastInput).to.equal(null);
      expect(state.snapshot.reviewed).to.equal(false);
      expect(state.notice).to.equal(staleAnalysisNotice);
      expect(currentAnalysisResult({ result: { finalScore: 8 }, lastInput: analyzedInput, reviewed: true }, { ...analyzedInput, ...change })).to.equal(null);
    }
  });

  it("does not show a stale warning before an analysis exists", function () {
    const state = invalidateStaleAnalysis({ result: null, lastInput: null, reviewed: false }, analyzedInput);
    expect(state.invalidated).to.equal(false);
    expect(state.notice).to.equal("");
  });
});
