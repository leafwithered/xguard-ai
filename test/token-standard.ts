import { expect } from "chai";
import { inspectContract, type IntelligenceInput } from "../lib/chain/intelligence.ts";

const input: IntelligenceInput = { from: "", to: "0x2222222222222222222222222222222222222222", value: "0", data: "0x" };
const boolResult = (value: boolean) => `0x${"0".repeat(63)}${value ? "1" : "0"}`;

function erc165Fetch(standard: "ERC721" | "ERC1155" | "NONE" | "UNAVAILABLE" | "LIAR" | "MALFORMED_BOOL"): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { method: string; params: Array<Record<string, string> | string> };
    let result: unknown = "0x";
    if (request.method === "eth_getCode") result = "0x6000";
    else if (request.method === "eth_getStorageAt") result = `0x${"0".repeat(64)}`;
    else if (request.method === "eth_estimateGas") result = "0x7530";
    else if (request.method === "eth_call") {
      const data = typeof request.params[0] === "object" ? request.params[0].data : "";
      if (data?.startsWith("0x01ffc9a7")) {
        if (standard === "UNAVAILABLE") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "ERC165 unavailable" } }), { status: 200, headers: { "content-type": "application/json" } });
        const interfaceId = data.slice(10, 18);
        result = standard === "MALFORMED_BOOL" && interfaceId === "ffffffff"
          ? `0x${"0".repeat(63)}2`
          : boolResult(standard === "LIAR" || interfaceId === "01ffc9a7" || (standard === "ERC721" && interfaceId === "80ac58cd") || (standard === "ERC1155" && interfaceId === "d9b67a26"));
      }
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("Bounded ERC165 token-standard evidence", function () {
  it("positively identifies ERC721 from supportsInterface", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("ERC721") });
    expect(result).to.include({ tokenStandard: "ERC721", tokenStandardSource: "ERC165" });
  });

  it("positively identifies ERC1155 from supportsInterface", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("ERC1155") });
    expect(result).to.include({ tokenStandard: "ERC1155", tokenStandardSource: "ERC165" });
  });

  it("does not infer ERC20 when ERC721 and ERC1155 are false", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("NONE") });
    expect(result).to.include({ tokenStandard: "UNKNOWN", tokenStandardSource: "ERC165" });
  });

  it("keeps standard UNKNOWN when ERC165 calls are unavailable", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("UNAVAILABLE") });
    expect(result).to.include({ tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" });
  });

  it("rejects a target that claims support for the invalid ERC165 interface", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("LIAR") });
    expect(result).to.include({ tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" });
  });

  it("rejects non-canonical ABI boolean values", async function () {
    const result = await inspectContract(input, { fetchImpl: erc165Fetch("MALFORMED_BOOL") });
    expect(result).to.include({ tokenStandard: "UNKNOWN", tokenStandardSource: "UNAVAILABLE" });
  });
});
