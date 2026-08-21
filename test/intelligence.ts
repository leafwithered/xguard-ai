import { expect } from "chai";
import { inspectContract, signalsFromIntelligence, type IntelligenceInput } from "../lib/chain/intelligence.ts";

const input: IntelligenceInput = {
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  value: "0",
  data: "0x"
};

const implementation = "3333333333333333333333333333333333333333";
const proxySlotValue = `0x${"0".repeat(24)}${implementation}`;

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

describe("X Layer contract intelligence", function () {
  it("identifies an EOA and a successful preflight", async function () {
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: "0x", eth_call: "0x", eth_estimateGas: "0x5208" }) });
    expect(result.addressType).to.equal("EOA");
    expect(result.codePresent).to.equal(false);
    expect(result.codeSizeBytes).to.equal(0);
    expect(result.proxyDetected).to.equal(false);
    expect(result.preflightStatus).to.equal("SUCCEEDED");
    expect(result.estimatedGas).to.equal("21000");
    expect(result.rpcStatus).to.equal("AVAILABLE");
  });

  it("identifies deployed contract bytecode", async function () {
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: "0x6001600055", eth_getStorageAt: `0x${"0".repeat(64)}`, eth_call: "0x", eth_estimateGas: "0x7530" }) });
    expect(result.addressType).to.equal("SMART_CONTRACT");
    expect(result.codePresent).to.equal(true);
    expect(result.codeSizeBytes).to.equal(5);
    expect(result.proxyDetected).to.equal(false);
  });

  it("detects an EIP-1967 implementation address", async function () {
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: "0x6000", eth_getStorageAt: proxySlotValue, eth_call: "0x", eth_estimateGas: "0x7530" }) });
    expect(result.proxyDetected).to.equal(true);
    expect(result.implementationAddress?.toLowerCase()).to.equal(`0x${implementation}`);
  });

  it("isolates a total RPC failure", async function () {
    const failingFetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    const result = await inspectContract(input, { fetchImpl: failingFetch });
    expect(result.addressType).to.equal("UNAVAILABLE");
    expect(result.preflightStatus).to.equal("UNAVAILABLE");
    expect(result.rpcStatus).to.equal("UNAVAILABLE");
  });

  it("does not mislabel HTTP rate limiting as an EVM revert", async function () {
    const limitedFetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
    const result = await inspectContract(input, { fetchImpl: limitedFetch });
    expect(result.preflightStatus).to.equal("UNAVAILABLE");
    expect(result.revertReason).to.equal(undefined);
  });

  it("reports eth_call success independently of other checks", async function () {
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: { error: "offline" }, eth_call: "0x1234", eth_estimateGas: { error: "unavailable" } }) });
    expect(result.preflightStatus).to.equal("SUCCEEDED");
    expect(result.rpcStatus).to.equal("PARTIAL");
  });

  it("decodes a standard Error(string) revert", async function () {
    const messageHex = Buffer.from("Not allowed", "utf8").toString("hex").padEnd(64, "0");
    const revertData = `0x08c379a0${"0".repeat(62)}20${"0".repeat(63)}b${messageHex}`;
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: "0x6000", eth_getStorageAt: `0x${"0".repeat(64)}`, eth_call: { error: revertData }, eth_estimateGas: { error: revertData } }) });
    expect(result.preflightStatus).to.equal("REVERTED");
    expect(result.revertReason).to.equal("Error: Not allowed");
  });

  it("keeps a successful call when gas estimation is unavailable", async function () {
    const result = await inspectContract(input, { fetchImpl: rpcFetch({ eth_getCode: "0x6000", eth_getStorageAt: `0x${"0".repeat(64)}`, eth_call: "0x", eth_estimateGas: { error: "unavailable" } }) });
    expect(result.preflightStatus).to.equal("SUCCEEDED");
    expect(result.estimatedGas).to.equal(undefined);
    expect(result.rpcStatus).to.equal("PARTIAL");
  });

  it("times out without throwing into the core analysis path", async function () {
    const hangingFetch = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    const result = await inspectContract(input, { fetchImpl: hangingFetch, timeoutMs: 10 });
    expect(result.rpcStatus).to.equal("UNAVAILABLE");
    expect(result.preflightStatus).to.equal("UNAVAILABLE");
  });

  it("labels evidence-backed proxy and revert observations as ON-CHAIN", function () {
    const signals = signalsFromIntelligence({ address: input.to as `0x${string}`, addressType: "SMART_CONTRACT", codePresent: true, codeSizeBytes: 10, proxyDetected: true, implementationAddress: `0x${implementation}` as `0x${string}`, preflightStatus: "REVERTED", revertReason: "Error: denied", rpcStatus: "AVAILABLE" });
    expect(signals).to.have.length(2);
    expect(signals.every((signal) => signal.source === "ON-CHAIN")).to.equal(true);
  });
});
