import { expect } from "chai";
import { buildRiskScorePresentation, isLiveOkxProviderEvidence } from "../lib/presentation.ts";
import type { SimulationEvidence } from "../lib/okx/simulation.ts";

function simulation(overrides: Partial<SimulationEvidence> = {}): SimulationEvidence {
  return {
    provider: "OKX_ONCHAINOS",
    network: "XLAYER_MAINNET",
    chainId: 196,
    chainIndex: "196",
    status: "AVAILABLE",
    statusDetail: null,
    intention: "Token Approval",
    assetChanges: [],
    gasUsed: "291460",
    failReason: null,
    risks: [],
    observedAt: "2026-08-21T09:15:34.744Z",
    durationMs: 329,
    httpStatus: 200,
    businessCode: "0",
    ...overrides
  };
}

describe("Judge-facing evidence semantics", function () {
  it("never labels an AI-raised final score as deterministic known risk", function () {
    const view = buildRiskScorePresentation({ deterministicScore: 20, aiScore: 75, finalScore: 75, level: "HIGH" });
    expect(view.final).to.deep.equal({ label: "Final Risk Score", score: 75, level: "HIGH" });
    expect(view.deterministic).to.deep.equal({ label: "Deterministic Known Risk", score: 20, level: "LOW" });
    expect(view.ai).to.deep.equal({ label: "AI Advisory", score: 75, level: "HIGH" });
  });

  it("shows live provider evidence only for a successful Mainnet provider response", function () {
    expect(isLiveOkxProviderEvidence(simulation())).to.equal(true);
    expect(isLiveOkxProviderEvidence(simulation({ status: "UNAVAILABLE" }))).to.equal(false);
    expect(isLiveOkxProviderEvidence(simulation({ status: "ERROR" }))).to.equal(false);
    expect(isLiveOkxProviderEvidence(simulation({ httpStatus: 429 }))).to.equal(false);
    expect(isLiveOkxProviderEvidence(simulation({ businessCode: "50000" }))).to.equal(false);
    expect(isLiveOkxProviderEvidence(simulation({ network: "XLAYER_TESTNET", chainId: 1952, chainIndex: null }))).to.equal(false);
  });
});
