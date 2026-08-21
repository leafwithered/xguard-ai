import { expect } from "chai";
import type { Address } from "viem";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import { deriveAnalysisDimensions } from "../lib/evidence.ts";
import { applyIntentRisk, compareIntentToReality } from "../lib/intent.ts";
import { judgePresets, publicMainnetSimulationFixture } from "../lib/presets.ts";
import { localRiskAnalysis } from "../lib/risk.ts";

function intelligence(address: string, overrides: Partial<ContractIntelligence> = {}): ContractIntelligence {
  return {
    network: "XLAYER_TESTNET",
    chainId: 1952,
    address: address as Address,
    addressType: "EOA",
    codePresent: false,
    codeSizeBytes: 0,
    proxyDetected: false,
    preflightStatus: "SUCCEEDED",
    estimatedGas: "21000",
    rpcStatus: "AVAILABLE",
    tokenStandard: "UNKNOWN",
    tokenStandardSource: "UNAVAILABLE",
    ...overrides
  };
}

describe("Judge demo preset regression", function () {
  it("keeps the public OKX fixture explicit, Mainnet-only and non-executing data", function () {
    expect(publicMainnetSimulationFixture.sourceTransaction).to.match(/^0x[0-9a-f]{64}$/);
    expect(publicMainnetSimulationFixture.input.analysisNetwork).to.equal("XLAYER_MAINNET");
    expect(publicMainnetSimulationFixture.input.value).to.equal("0");
    expect(publicMainnetSimulationFixture.input.data.startsWith("0x095ea7b3")).to.equal(true);
  });

  it("keeps Safe Transfer LOW", function () {
    const result = localRiskAnalysis(judgePresets[0].input);
    expect(result.level).to.equal("LOW");
    expect(result.deterministicScore).to.equal(8);
    const consequences = buildTransactionConsequences(judgePresets[0].input, { decodedAction: result.decodedAction });
    expect(compareIntentToReality(judgePresets[0].input, result.decodedAction, consequences).status).to.equal("MATCH");
  });

  it("keeps Ambiguous Approval explicitly unresolved and non-critical", function () {
    const result = localRiskAnalysis(judgePresets[1].input);
    const dimensions = deriveAnalysisDimensions(result, intelligence(judgePresets[1].input.to));
    expect(judgePresets[1].name).to.equal("Ambiguous Approval");
    expect(result.level).to.equal("LOW");
    expect(result.decodedAction.method).to.equal("approve(address,uint256)");
    expect(result.decodedAction.operatorOrSpender).to.be.a("string");
    expect(result.decodedAction.assetStandard).to.equal("UNKNOWN");
    expect(result.criticalSignals.map((signal) => signal.id)).not.to.include("unlimited-approval");
    expect(result.decodedAction.isUnlimited).to.equal(undefined);
    expect(dimensions).to.include({ analysisConfidence: "LOW", analysisVerdict: "UNDETERMINED" });
  });

  it("makes Suspicious Airdrop a single claim-versus-operator-permission mismatch", function () {
    const result = localRiskAnalysis(judgePresets[2].input);
    const consequences = buildTransactionConsequences(judgePresets[2].input, { decodedAction: result.decodedAction });
    const comparison = compareIntentToReality(judgePresets[2].input, result.decodedAction, consequences);
    const withIntentFloor = applyIntentRisk(result, comparison);
    expect(judgePresets[2].input.to).not.to.equal("0x0000000000000000000000000000000000000000");
    expect(judgePresets[2].input.value).to.equal("0");
    expect(result.decodedAction).to.include({ method: "setApprovalForAll(address,bool)", action: "Contract-wide operator permission", approved: true });
    expect(result.criticalSignals.map((signal) => signal.id)).to.include("operator-approval");
    expect(comparison).to.include({ status: "MISMATCH", deterministicMismatch: true, mismatchType: "CLAIM_PERMISSION" });
    expect(withIntentFloor.level).to.equal("HIGH");
    expect(withIntentFloor.deterministicScore).to.be.at.least(78);
  });

  it("preserves the complete three-step judge story through the pipeline without AI", async function () {
    const safe = await runAnalysisPipeline(judgePresets[0].input, {
      inspectContract: async () => intelligence(judgePresets[0].input.to),
      analyzeAi: async () => null
    });
    expect(safe).to.include({ finalScore: 8, level: "LOW", analysisConfidence: "HIGH", analysisVerdict: "ASSESSED", executionStatus: "SUCCEEDED" });
    expect(safe.intentComparison.status).to.equal("MATCH");

    const ambiguous = await runAnalysisPipeline(judgePresets[1].input, {
      inspectContract: async () => intelligence(judgePresets[1].input.to),
      analyzeAi: async () => null
    });
    expect(ambiguous).to.include({ level: "LOW", analysisConfidence: "LOW", analysisVerdict: "UNDETERMINED" });
    expect(ambiguous.decodedAction).to.include({ method: "approve(address,uint256)", assetStandard: "UNKNOWN" });
    expect(ambiguous.criticalSignals.map((signal) => signal.id)).not.to.include("unlimited-approval");

    const suspicious = await runAnalysisPipeline(judgePresets[2].input, {
      inspectContract: async () => intelligence(judgePresets[2].input.to, {
        addressType: "SMART_CONTRACT",
        codePresent: true,
        codeSizeBytes: 6698,
        tokenStandard: "ERC721",
        tokenStandardSource: "ERC165"
      }),
      analyzeAi: async () => null
    });
    expect(suspicious.decodedAction).to.include({ method: "setApprovalForAll(address,bool)", action: "Contract-wide operator permission", approved: true });
    expect(suspicious.intentComparison).to.include({ status: "MISMATCH", deterministicMismatch: true });
    expect(suspicious.deterministicScore).to.be.at.least(78);
    expect(suspicious.level).to.equal("HIGH");
  });
});
