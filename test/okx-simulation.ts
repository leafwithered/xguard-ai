import { expect } from "chai";
import {
  buildOkxAuthHeaders,
  createOkxPrehash,
  okxSimulationRequestPath,
  signalsFromSimulation,
  signOkxPrehash,
  simulateTransaction,
  type SimulationEvidence
} from "../lib/okx/simulation.ts";
import type { RiskInput } from "../lib/risk.ts";

const from = "0x1111111111111111111111111111111111111111";
const to = "0x2222222222222222222222222222222222222222";
const input: RiskInput = { from, to, value: "1.25", data: "0x1234", context: "Review this Mainnet call", analysisNetwork: "XLAYER_MAINNET" };
const credentials = { apiKey: "fixture-api-key", secretKey: "fixture-secret", passphrase: "fixture-passphrase" };
const timestamp = "2026-08-21T00:00:00.000Z";
const expectedBody = JSON.stringify({ fromAddress: from, toAddress: to, chainIndex: "196", txAmount: "1250000000000000000", extJson: { inputData: "0x1234" } });

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function okxResult(overrides: Record<string, unknown> = {}) {
  return { code: "0", data: [{ intention: "TOKEN_APPROVAL", assetChange: [], gasUsed: "42000", failReason: "", risks: [], ...overrides }], msg: "success" };
}

function fixedNow() { return new Date(timestamp); }

describe("OKX Transaction Simulation adapter", function () {
  it("builds the exact documented POST prehash and a stable HMAC-SHA256 Base64 signature", function () {
    const prehash = createOkxPrehash(timestamp, "POST", okxSimulationRequestPath, expectedBody);
    expect(prehash).to.equal(`${timestamp}POST${okxSimulationRequestPath}${expectedBody}`);
    expect(signOkxPrehash(prehash, credentials.secretKey)).to.equal("hULhPmTFlc3y4ANIbXIagcnVNUcMQVCP411d4RE4L2k=");
    expect(buildOkxAuthHeaders(timestamp, expectedBody, credentials)["OK-ACCESS-SIGN"]).to.equal("hULhPmTFlc3y4ANIbXIagcnVNUcMQVCP411d4RE4L2k=");
  });

  it("sends chainIndex 196, atomic OKB value and the exact calldata/body that was signed", async function () {
    let sentBody = "";
    let sentHeaders: HeadersInit | undefined;
    const result = await simulateTransaction(input, {
      credentials,
      now: fixedNow,
      fetchImpl: async (_url, init) => {
        sentBody = String(init?.body);
        sentHeaders = init?.headers;
        return response(okxResult());
      }
    });
    expect(sentBody).to.equal(expectedBody);
    const headers = sentHeaders as Record<string, string>;
    expect(headers["OK-ACCESS-SIGN"]).to.equal(signOkxPrehash(`${timestamp}POST${okxSimulationRequestPath}${sentBody}`, credentials.secretKey));
    expect(result).to.deep.include({ status: "AVAILABLE", network: "XLAYER_MAINNET", chainId: 196, chainIndex: "196", httpStatus: 200, businessCode: "0" });
  });

  it("never calls OKX simulation for X Layer Testnet", async function () {
    let calls = 0;
    const result = await simulateTransaction({ ...input, analysisNetwork: "XLAYER_TESTNET" }, { credentials, fetchImpl: async () => { calls += 1; return response(okxResult()); }, now: fixedNow });
    expect(calls).to.equal(0);
    expect(result).to.deep.include({ status: "UNSUPPORTED", network: "XLAYER_TESTNET", chainId: 1952, chainIndex: null });
  });

  it("normalizes positive and negative asset changes, fail reason and risk entries without inventing fields", async function () {
    const result = await simulateTransaction(input, {
      credentials,
      now: fixedNow,
      fetchImpl: async () => response(okxResult({
        assetChange: [
          { assetType: "NATIVE", name: "OKB", symbol: "OKB", decimals: 18, address: "", rawValue: "-1250000000000000000", ignored: "not normalized" },
          { assetType: "ERC20", name: "Example", symbol: "TOK", decimals: 6, address: to, rawValue: "2500000" }
        ],
        failReason: "execution reverted",
        risks: [{ address: to, addressType: "contract", ignored: "not normalized" }]
      }))
    });
    expect(result.assetChanges).to.deep.equal([
      { assetType: "NATIVE", name: "OKB", symbol: "OKB", decimals: 18, address: "", rawValue: "-1250000000000000000" },
      { assetType: "ERC20", name: "Example", symbol: "TOK", decimals: 6, address: "0x2222222222222222222222222222222222222222", rawValue: "2500000" }
    ]);
    expect(result.failReason).to.equal("execution reverted");
    expect(result.risks).to.deep.equal([{ address: "0x2222222222222222222222222222222222222222", addressType: "contract" }]);
  });

  it("does not turn an empty OKX risk list into a safe signal", async function () {
    const result = await simulateTransaction(input, { credentials, now: fixedNow, fetchImpl: async () => response(okxResult()) });
    expect(result.risks).to.deep.equal([]);
    expect(signalsFromSimulation(result)).to.deep.equal([]);
    expect(JSON.stringify(signalsFromSimulation(result)).toLowerCase()).not.to.include("safe");
  });

  it("classifies missing credentials and malformed transaction value without exposing secrets", async function () {
    const missing = await simulateTransaction(input, { credentials: null, now: fixedNow });
    const malformed = await simulateTransaction({ ...input, value: "not-a-number" }, { credentials, now: fixedNow });
    expect(missing.status).to.equal("UNAVAILABLE");
    expect(malformed.status).to.equal("ERROR");
    const serialized = JSON.stringify([missing, malformed]);
    expect(serialized).not.to.include(credentials.apiKey);
    expect(serialized).not.to.include(credentials.secretKey);
    expect(serialized).not.to.include(credentials.passphrase);
  });

  const failures: Array<{ name: string; expected: SimulationEvidence["status"]; fetchImpl: () => Promise<Response> }> = [
    { name: "401", expected: "ERROR", fetchImpl: async () => response({}, 401) },
    { name: "403", expected: "ERROR", fetchImpl: async () => response({}, 403) },
    { name: "429", expected: "UNAVAILABLE", fetchImpl: async () => response({}, 429) },
    { name: "5xx", expected: "UNAVAILABLE", fetchImpl: async () => response({}, 503) },
    { name: "business error", expected: "ERROR", fetchImpl: async () => response({ code: "50011", data: [], msg: "failure" }) },
    { name: "invalid JSON", expected: "ERROR", fetchImpl: async () => response("not-json") },
    { name: "empty data", expected: "ERROR", fetchImpl: async () => response({ code: "0", data: [] }) },
    { name: "malformed result", expected: "ERROR", fetchImpl: async () => response(okxResult({ assetChange: [{ rawValue: "not-an-integer" }] })) },
    { name: "timeout/network error", expected: "UNAVAILABLE", fetchImpl: async () => { throw new DOMException("timed out", "AbortError"); } }
  ];

  for (const failure of failures) {
    it(`contains ${failure.name} as sanitized non-fatal evidence`, async function () {
      const result = await simulateTransaction(input, { credentials, now: fixedNow, fetchImpl: failure.fetchImpl });
      expect(result.status).to.equal(failure.expected);
      const serialized = JSON.stringify(result);
      expect(serialized).not.to.include(credentials.apiKey);
      expect(serialized).not.to.include(credentials.secretKey);
      expect(serialized).not.to.include(credentials.passphrase);
    });
  }
});
