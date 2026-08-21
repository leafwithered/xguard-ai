import { expect } from "chai";
import { analyzeXLayerTransaction, TransactionLookupError, validateTransactionHash } from "../lib/chain/transaction-analyzer.ts";

const hash = `0x${"a".repeat(64)}`;
const baseTransaction = {
  hash,
  blockNumber: "0x10",
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  value: "0x0",
  gas: "0x5208",
  input: "0x"
};

function rpcFetch(transaction: unknown, receipt: unknown): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { method: string };
    const result = body.method === "eth_getTransactionByHash" ? transaction : receipt;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("X Layer post-hoc transaction analyzer", function () {
  it("accepts only a 32-byte hex transaction hash", function () {
    expect(validateTransactionHash(hash)).to.equal(true);
    expect(validateTransactionHash("0x1234")).to.equal(false);
  });

  it("rejects an invalid hash before RPC access", async function () {
    try { await analyzeXLayerTransaction("bad"); expect.fail("expected rejection"); }
    catch (error) { expect(error).to.be.instanceOf(TransactionLookupError); expect((error as TransactionLookupError).code).to.equal("INVALID_HASH"); }
  });

  it("reports a missing transaction", async function () {
    try { await analyzeXLayerTransaction(hash, { fetchImpl: rpcFetch(null, null) }); expect.fail("expected rejection"); }
    catch (error) { expect((error as TransactionLookupError).code).to.equal("NOT_FOUND"); }
  });

  it("parses a confirmed transaction into XGuard input", async function () {
    const result = await analyzeXLayerTransaction(hash, { fetchImpl: rpcFetch(baseTransaction, { status: "0x1", blockNumber: "0x10", gasUsed: "0x5000" }) });
    expect(result.status).to.equal("CONFIRMED");
    expect(result.blockNumber).to.equal("16");
    expect(result.gasUsed).to.equal("20480");
    expect(result.analysisInput?.to).to.equal(baseTransaction.to);
  });

  it("reports a reverted receipt without changing the transaction", async function () {
    const result = await analyzeXLayerTransaction(hash, { fetchImpl: rpcFetch(baseTransaction, { status: "0x0", blockNumber: "0x10", gasUsed: "0x5000" }) });
    expect(result.status).to.equal("REVERTED");
    expect(result.analysisInput?.data).to.equal("0x");
  });

  it("isolates RPC failures", async function () {
    const failingFetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    try { await analyzeXLayerTransaction(hash, { fetchImpl: failingFetch }); expect.fail("expected rejection"); }
    catch (error) { expect((error as TransactionLookupError).code).to.equal("RPC_UNAVAILABLE"); }
  });
});
