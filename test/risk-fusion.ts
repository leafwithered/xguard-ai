import { expect } from "chai";
import { mergeRiskResults } from "../lib/risk-fusion.ts";
import { localRiskAnalysis, type AdvisoryRiskResult, type RiskInput, type RiskResult } from "../lib/risk.ts";

const baseInput: RiskInput = { from: "", to: "0x1111111111111111111111111111111111111111", value: "0", data: "0x", context: "Normal transfer" };

function localWithScore(score: number): RiskResult {
  const result = localRiskAnalysis(baseInput);
  const level = score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  return { ...result, score, finalScore: score, deterministicScore: score, level, reasons: [`Local ${level} signal`] };
}

function ai(score: number): AdvisoryRiskResult {
  const level = score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  return { score, level, summary: `AI ${level}`, reasons: [`AI ${level} signal`], recommendation: "AI recommendation.", mode: "AI", providerProtocol: "responses" };
}

describe("Risk result safety fusion", function () {
  it("prevents AI from lowering deterministic HIGH risk", function () {
    const result = mergeRiskResults(localWithScore(90), ai(20));
    expect(result.finalScore).to.equal(90);
    expect(result.level).to.equal("HIGH");
    expect(result.reasons).to.include("Local HIGH signal");
  });

  it("prevents AI from lowering deterministic MEDIUM risk", function () {
    const result = mergeRiskResults(localWithScore(40), ai(10));
    expect(result.finalScore).to.equal(40);
    expect(result.level).to.equal("MEDIUM");
  });

  it("allows AI to raise a LOW result to HIGH", function () {
    const result = mergeRiskResults(localWithScore(10), ai(80));
    expect(result.finalScore).to.equal(80);
    expect(result.level).to.equal("HIGH");
    expect(result.mode).to.equal("HYBRID");
  });

  it("returns the local result when the provider fails or is malformed", function () {
    const local = localWithScore(70);
    expect(mergeRiskResults(local, null)).to.equal(local);
  });

  it("deduplicates reasons while preserving deterministic signals", function () {
    const local = localWithScore(70);
    const advisory = { ...ai(75), reasons: ["Local HIGH signal", "New AI signal"] };
    const result = mergeRiskResults(local, advisory);
    expect(result.reasons.filter((reason) => reason === "Local HIGH signal")).to.have.length(1);
    expect(result.reasons).to.include("New AI signal");
  });
});
