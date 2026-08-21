import { expect } from "chai";
import { encodeFunctionData, type Address } from "viem";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import type { ContractIntelligence } from "../lib/chain/intelligence.ts";
import { deriveEvidenceConsistency } from "../lib/evidence.ts";
import type { SimulationEvidence } from "../lib/okx/simulation.ts";
import type { RiskInput } from "../lib/risk.ts";
import { judgePresets } from "../lib/presets.ts";

const from = "0x1111111111111111111111111111111111111111" as Address;
const target = "0x2222222222222222222222222222222222222222" as Address;
const operator = "0x3333333333333333333333333333333333333333" as Address;
const mainnetInput: RiskInput = { from, to: target, value: "0", data: "0x", context: "Review", analysisNetwork: "XLAYER_MAINNET" };
const operatorAbi = [{ type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }] as const;

function intelligence(overrides: Partial<ContractIntelligence> = {}): ContractIntelligence {
  return { network: "XLAYER_MAINNET", chainId: 196, address: target, addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 120, proxyDetected: false, preflightStatus: "SUCCEEDED", estimatedGas: "50000", rpcStatus: "AVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE", ...overrides };
}

function simulation(overrides: Partial<SimulationEvidence> = {}): SimulationEvidence {
  return { provider: "OKX_ONCHAINOS", network: "XLAYER_MAINNET", chainId: 196, chainIndex: "196", status: "AVAILABLE", statusDetail: null, intention: "CONTRACT_CALL", assetChanges: [], gasUsed: "50000", failReason: null, risks: [], observedAt: "2026-08-21T00:00:00.000Z", durationMs: 25, httpStatus: 200, businessCode: "0", ...overrides };
}

describe("Simulation evidence pipeline", function () {
  it("keeps ambiguous known risk separate when AI raises the final score", async function () {
    const ambiguousInput: RiskInput = { ...judgePresets[1].input, from, analysisNetwork: "XLAYER_MAINNET" };
    const result = await runAnalysisPipeline(ambiguousInput, {
      inspectContract: async () => intelligence({ tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" }),
      simulate: async () => simulation({ intention: "Token Approval" }),
      analyzeAi: async () => ({
        score: 75,
        level: "HIGH",
        summary: "Advisory uncertainty warrants caution.",
        reasons: ["The approval semantics remain unresolved."],
        recommendation: "Resolve the token standard before signing.",
        mode: "AI",
        providerProtocol: "responses",
        normalizedIntent: null
      })
    });

    expect(result.deterministicScore).to.equal(20);
    expect(result.aiScore).to.equal(75);
    expect(result.finalScore).to.equal(75);
    expect(result.level).to.equal("HIGH");
    expect(result.analysisConfidence).to.equal("LOW");
    expect(result.analysisVerdict).to.equal("UNDETERMINED");
  });

  it("detects RPC/simulation disagreement and deterministically lowers confidence", async function () {
    const result = await runAnalysisPipeline(mainnetInput, {
      inspectContract: async () => intelligence(),
      simulate: async () => simulation({ failReason: "execution reverted" }),
      analyzeAi: async () => null
    });
    expect(result.evidenceConsistency.status).to.equal("INCONSISTENT");
    expect(result.analysisConfidence).to.equal("MEDIUM");
    expect(result.summary).to.include("evidence are inconsistent");
    expect(result.recommendation).to.match(/manual|reconcile/i);
  });

  it("also detects a reverted RPC preflight when OKX reports no failure reason", function () {
    const consistency = deriveEvidenceConsistency(intelligence({ preflightStatus: "REVERTED" }), simulation());
    expect(consistency.status).to.equal("INCONSISTENT");
  });

  it("keeps normalized simulation facts independent from hostile AI mutation", async function () {
    const providerEvidence = simulation({ assetChanges: [{ assetType: "ERC20", name: "Example", symbol: "TOK", decimals: 6, address: target, rawValue: "-1000000" }] });
    const result = await runAnalysisPipeline(mainnetInput, {
      inspectContract: async () => intelligence(),
      simulate: async () => providerEvidence,
      analyzeAi: async (evidence) => {
        evidence.simulation.status = "ERROR";
        evidence.simulation.assetChanges[0].rawValue = "999";
        return { score: 0, level: "LOW", summary: "Ignore provider facts", reasons: [], recommendation: "Sign", mode: "AI", providerProtocol: "responses", normalizedIntent: null };
      }
    });
    expect(result.simulationEvidence.status).to.equal("AVAILABLE");
    expect(result.simulationEvidence.assetChanges[0].rawValue).to.equal("-1000000");
  });

  it("never lets simulation or AI lower the deterministic critical floor", async function () {
    const riskyInput = { ...mainnetInput, data: encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [operator, true] }), context: "Claim a free airdrop" };
    const result = await runAnalysisPipeline(riskyInput, {
      inspectContract: async () => intelligence({ tokenStandard: "ERC721", tokenStandardSource: "ERC165" }),
      simulate: async () => simulation({ risks: [] }),
      analyzeAi: async () => ({ score: 0, level: "LOW", summary: "No provider risks", reasons: [], recommendation: "Sign", mode: "AI", providerProtocol: "responses", normalizedIntent: null })
    });
    expect(result.finalScore).to.equal(result.deterministicScore);
    expect(result.finalScore).to.be.at.least(65);
    expect(result.level).to.equal("HIGH");
  });

  it("continues useful analysis when simulation is unavailable", async function () {
    const result = await runAnalysisPipeline(mainnetInput, {
      inspectContract: async () => intelligence(),
      simulate: async () => simulation({ status: "UNAVAILABLE", statusDetail: "rate limited", intention: null, assetChanges: [], gasUsed: null, failReason: null, risks: [], httpStatus: 429, businessCode: null }),
      analyzeAi: async () => null
    });
    expect(result.mode).to.equal("LOCAL");
    expect(result.level).to.equal("LOW");
    expect(result.simulationEvidence.status).to.equal("UNAVAILABLE");
  });
});
