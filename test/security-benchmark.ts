import { createServer } from "node:http";
import { expect } from "chai";
import { encodeFunctionData, maxUint256, type Address } from "viem";
import { analyzeTransaction } from "../lib/ai/provider.ts";
import { runAnalysisPipeline } from "../lib/analyze-pipeline.ts";
import { currentAnalysisResult, invalidateStaleAnalysis } from "../lib/analysis-state.ts";
import { inspectContract } from "../lib/chain/intelligence.ts";
import { buildTransactionConsequences } from "../lib/consequence.ts";
import { buildAnalysisEvidence } from "../lib/evidence.ts";
import { applyIntentRisk, compareIntentToReality } from "../lib/intent.ts";
import { mergeRiskResults } from "../lib/risk-fusion.ts";
import { localRiskAnalysis, type AdvisoryRiskResult, type RiskInput, type RiskResult } from "../lib/risk.ts";

const target = "0x2222222222222222222222222222222222222222" as Address;
const actor = "0x1234567890123456789012345678901234567890" as Address;
const zero = "0x0000000000000000000000000000000000000000";
const base: RiskInput = { from: "", to: target, value: "0", data: "0x", context: "" };
const approveAbi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const transferAbi = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const transferFromAbi = [{ type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const operatorAbi = [{ type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }] as const;

function rpcFetch(results: Record<string, unknown | { error: unknown }>): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { method: string };
    const configured = results[request.method];
    const payload = configured && typeof configured === "object" && "error" in configured
      ? { jsonrpc: "2.0", id: 1, error: { code: -32000, message: "execution reverted", data: configured.error } }
      : { jsonrpc: "2.0", id: 1, result: configured };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

function advisory(score: number): AdvisoryRiskResult {
  return {
    score,
    level: score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW",
    summary: `AI score ${score}`,
    reasons: [`AI score ${score}`],
    recommendation: "Review the advisory evidence.",
    mode: "AI",
    providerProtocol: "responses"
  };
}

function comparisonFor(input: RiskInput) {
  const local = localRiskAnalysis(input);
  const consequences = buildTransactionConsequences(input, { decodedAction: local.decodedAction });
  return { local, consequences, comparison: compareIntentToReality(input, local.decodedAction, consequences) };
}

describe("XGuard V3 security benchmark", function () {
  it("01 keeps a safe native transfer LOW", function () {
    expect(localRiskAnalysis({ ...base, value: "0.1" }).level).to.equal("LOW");
  });

  it("02 raises risk for a large native transfer", function () {
    expect(localRiskAnalysis({ ...base, value: "10" }).deterministicScore).to.be.greaterThan(8);
  });

  it("03 treats the zero address as a critical signal", function () {
    expect(localRiskAnalysis({ ...base, to: zero }).criticalSignals.map((item) => item.id)).to.include("zero-address");
  });

  it("04 decodes ERC20 transfer semantics", function () {
    const data = encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [actor, 250n] });
    expect(localRiskAnalysis({ ...base, data }).decodedAction.action).to.equal("ERC20 Transfer");
  });

  it("05 preserves the raw uint256 without calling it a finite ERC20 allowance", function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, 50n] });
    const decoded = localRiskAnalysis({ ...base, data }).decodedAction;
    expect(decoded.uint256Value).to.equal("50");
    expect(decoded.assetStandard).to.equal("UNKNOWN");
    expect(decoded.isUnlimited).to.equal(undefined);
  });

  it("06 does not call maxUint unlimited ERC20 without standard evidence", function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] });
    const result = localRiskAnalysis({ ...base, data });
    expect(result.criticalSignals.map((item) => item.id)).not.to.include("unlimited-approval");
    expect(result.advisorySignals.map((item) => item.id)).to.include("ambiguous-approval");
  });

  it("07 keeps transferFrom uint256 semantics ambiguous", function () {
    const data = encodeFunctionData({ abi: transferFromAbi, functionName: "transferFrom", args: [target, actor, 5n] });
    expect(buildTransactionConsequences({ ...base, data })[0].description).to.include("fungible-token units or an NFT token ID");
  });

  it("08 identifies collection-wide NFT permission grants", function () {
    const data = encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, true] });
    expect(buildTransactionConsequences({ ...base, data })[0].severity).to.equal("CRITICAL");
  });

  it("09 identifies collection-wide NFT permission revocation", function () {
    const data = encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, false] });
    expect(buildTransactionConsequences({ ...base, data })[0].title).to.include("revoked");
  });

  it("10 labels unknown selectors as unsupported", function () {
    expect(localRiskAnalysis({ ...base, data: "0x12345678" }).decodedAction.status).to.equal("unknown");
  });

  it("11 labels malformed known calldata without guessing arguments", function () {
    expect(localRiskAnalysis({ ...base, data: "0x095ea7b3" }).decodedAction.status).to.equal("malformed");
  });

  it("12 treats empty calldata as a native-value path", function () {
    expect(buildTransactionConsequences(base)[0].evidenceSource).to.equal("VALUE");
  });

  it("13 identifies an EOA from empty bytecode", async function () {
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x", eth_call: "0x", eth_estimateGas: "0x5208" }) });
    expect(result.addressType).to.equal("EOA");
  });

  it("14 identifies a smart contract from bytecode", async function () {
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x6000", eth_getStorageAt: `0x${"0".repeat(64)}`, eth_call: "0x", eth_estimateGas: "0x5208" }) });
    expect(result.addressType).to.equal("SMART_CONTRACT");
  });

  it("15 detects an EIP-1967 implementation slot", async function () {
    const slot = `0x${"0".repeat(24)}${actor.slice(2)}`;
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x6000", eth_getStorageAt: slot, eth_call: "0x", eth_estimateGas: "0x5208" }) });
    expect(result.proxyDetected).to.equal(true);
  });

  it("16 records bounded preflight success", async function () {
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x", eth_call: "0x", eth_estimateGas: "0x5208" }) });
    expect(result.preflightStatus).to.equal("SUCCEEDED");
  });

  it("17 records a preflight revert without calling it safe", async function () {
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x", eth_call: { error: "0x4e487b710000000000000000000000000000000000000000000000000000000000000011" }, eth_estimateGas: { error: "revert" } }) });
    expect(result.preflightStatus).to.equal("REVERTED");
  });

  it("18 keeps preflight evidence when gas estimation is unavailable", async function () {
    const result = await inspectContract(base, { fetchImpl: rpcFetch({ eth_getCode: "0x", eth_call: "0x", eth_estimateGas: { error: "unavailable" } }) });
    expect(result.preflightStatus).to.equal("SUCCEEDED");
    expect(result.estimatedGas).to.equal(undefined);
  });

  it("19 isolates complete RPC failure from Local Analysis", async function () {
    const result = await inspectContract(base, { fetchImpl: (async () => { throw new Error("offline"); }) as typeof fetch });
    expect(result.rpcStatus).to.equal("UNAVAILABLE");
    expect(localRiskAnalysis(base).level).to.equal("LOW");
  });

  it("20 keeps Local Analysis when AI is unavailable", function () {
    const local = localRiskAnalysis(base);
    expect(mergeRiskResults(local, null)).to.equal(local);
  });

  it("21 rejects malformed AI provider output", async function () {
    const previous = { key: process.env.AI_API_KEY, baseUrl: process.env.AI_BASE_URL, model: process.env.AI_MODEL };
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ output_text: "not-json", choices: [{ message: { content: "not-json" } }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
    try {
      process.env.AI_API_KEY = "fixture-key-not-a-secret";
      process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}`;
      process.env.AI_MODEL = "fixture-model";
      const local = localRiskAnalysis(base);
      const evidence = buildAnalysisEvidence(base, local, buildTransactionConsequences(base), {
        network: "XLAYER_TESTNET",
        chainId: 1952,
        address: target,
        addressType: "UNAVAILABLE",
        codePresent: null,
        codeSizeBytes: null,
        proxyDetected: null,
        preflightStatus: "UNAVAILABLE",
        rpcStatus: "UNAVAILABLE",
        tokenStandard: "UNKNOWN",
        tokenStandardSource: "UNAVAILABLE"
      });
      expect(await analyzeTransaction(evidence)).to.equal(null);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (previous.key === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = previous.key;
      if (previous.baseUrl === undefined) delete process.env.AI_BASE_URL; else process.env.AI_BASE_URL = previous.baseUrl;
      if (previous.model === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = previous.model;
    }
  });

  it("22 prevents an AI score below the deterministic floor", function () {
    const local = localRiskAnalysis({ ...base, to: zero });
    expect(mergeRiskResults(local, advisory(1)).finalScore).to.equal(local.deterministicScore);
  });

  it("23 allows AI to raise advisory risk above the floor", function () {
    expect(mergeRiskResults(localRiskAnalysis(base), advisory(90)).finalScore).to.equal(90);
  });

  it("24 invalidates stale analysis after an input edit", function () {
    const local = localRiskAnalysis(base);
    expect(invalidateStaleAnalysis({ result: local, lastInput: base, reviewed: true }, { ...base, value: "1" }).invalidated).to.equal(true);
  });

  it("25 prevents stale result recording by removing the active result", function () {
    const local = localRiskAnalysis(base);
    expect(currentAnalysisResult({ result: local, lastInput: base, reviewed: true }, { ...base, data: "0x12345678" })).to.equal(null);
  });

  it("26 returns MATCH for exact native intent and value", function () {
    expect(comparisonFor({ ...base, value: "0.1", context: "Send 0.1 OKB to my friend" }).comparison.status).to.equal("MATCH");
  });

  it("27 refuses finite-vs-unlimited comparison while token standard is unresolved", function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] });
    expect(comparisonFor({ ...base, data, context: "Only approve 50 USDC" }).comparison.status).to.equal("UNKNOWN");
  });

  it("28 returns MISMATCH for claim intent and NFT operator grant", function () {
    const data = encodeFunctionData({ abi: operatorAbi, functionName: "setApprovalForAll", args: [actor, true] });
    expect(comparisonFor({ ...base, data, context: "Claim my NFT reward" }).comparison.status).to.equal("MISMATCH");
  });

  it("29 returns UNKNOWN for ambiguous intent without AI", function () {
    expect(comparisonFor({ ...base, context: "Proceed with the requested action" }).comparison.status).to.equal("UNKNOWN");
  });

  it("30 never falsely describes an unsupported selector", function () {
    const result = buildTransactionConsequences({ ...base, data: "0x12345678" })[0];
    expect(result.id).to.equal("unsupported-selector");
    expect(result.description).to.include("cannot deterministically describe");
  });

  it("31 never fabricates token identity or decimals", function () {
    const data = encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [actor, 250n] });
    expect(buildTransactionConsequences({ ...base, data })[0].description).to.include("Token identity and decimals are not inferred");
  });

  it("32 keeps final consequences independent from an adversarial AI narrative", async function () {
    const data = encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [actor, maxUint256] });
    const input = { ...base, data };
    const intelligence = { network: "XLAYER_TESTNET" as const, chainId: 1952 as const, address: target, addressType: "SMART_CONTRACT" as const, codePresent: true, codeSizeBytes: 100, proxyDetected: false, preflightStatus: "SUCCEEDED" as const, estimatedGas: "50000", rpcStatus: "AVAILABLE" as const, tokenStandard: "UNKNOWN" as const, tokenStandardSource: "ERC165" as const };
    const withoutAi = await runAnalysisPipeline(input, { inspectContract: async () => intelligence, analyzeAi: async () => null });
    const withAdversarialAi = await runAnalysisPipeline(input, { inspectContract: async () => intelligence, analyzeAi: async () => ({ ...advisory(0), normalizedIntent: null }) });
    expect(withAdversarialAi.consequences).to.deep.equal(withoutAi.consequences);
    expect(withAdversarialAi.consequences[0].title).to.include("unresolved standard");
  });

  it("33 prevents AI from downgrading a deterministic native-amount mismatch", function () {
    const { local, comparison } = comparisonFor({ ...base, value: "1", context: "Send 0.1 OKB" });
    const floored = applyIntentRisk(local, comparison);
    const fused = mergeRiskResults(floored, advisory(1));
    expect(fused.finalScore).to.be.at.least(floored.deterministicScore);
  });

  it("34 does not fabricate on-chain observations when RPC evidence is unavailable", function () {
    const result = buildTransactionConsequences(base, { intelligence: { network: "XLAYER_TESTNET", chainId: 1952, address: target, addressType: "UNAVAILABLE", codePresent: null, codeSizeBytes: null, proxyDetected: null, preflightStatus: "UNAVAILABLE", rpcStatus: "UNAVAILABLE", tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" } });
    expect(result.some((item) => item.evidenceSource === "ON_CHAIN")).to.equal(false);
  });
});
