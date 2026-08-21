import { expect } from "chai";
import { inspectContract } from "../lib/chain/intelligence.ts";
import { getAnalysisNetworkConfig, normalizeAnalysisNetwork } from "../lib/network.ts";
import { validateRiskInput, type RiskInput } from "../lib/risk.ts";

const base: RiskInput = { from: "0x1111111111111111111111111111111111111111", to: "0x2222222222222222222222222222222222222222", value: "0", data: "0x", context: "" };

describe("Analysis network boundary", function () {
  it("keeps missing legacy network input on X Layer Testnet", function () {
    expect(normalizeAnalysisNetwork(undefined)).to.equal("XLAYER_TESTNET");
    expect(getAnalysisNetworkConfig(undefined)).to.deep.include({ chainId: 1952, okxChainIndex: null, simulationSupported: false });
  });

  it("maps explicit Mainnet to Chain 196 and OKX chainIndex 196", function () {
    expect(getAnalysisNetworkConfig("XLAYER_MAINNET")).to.deep.include({ chainId: 196, okxChainIndex: "196", simulationSupported: true, rpcUrl: "https://rpc.xlayer.tech" });
  });

  it("rejects unknown network values", function () {
    expect(validateRiskInput({ ...base, analysisNetwork: "ETHEREUM" as never })).to.include("Analysis network is invalid");
  });

  it("returns chain-aware Mainnet RPC intelligence metadata", async function () {
    const result = await inspectContract({ ...base, analysisNetwork: "XLAYER_MAINNET" }, {
      rpcUrl: "https://rpc.xlayer.tech",
      fetchImpl: (async (_url, init) => {
        const request = JSON.parse(String(init?.body)) as { method: string };
        const rpcResult = request.method === "eth_getCode" ? "0x" : request.method === "eth_estimateGas" ? "0x5208" : "0x";
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: rpcResult }), { status: 200 });
      }) as typeof fetch
    });
    expect(result).to.deep.include({ network: "XLAYER_MAINNET", chainId: 196, rpcStatus: "AVAILABLE" });
  });
});
