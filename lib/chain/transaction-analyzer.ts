import { decodeCalldata, type DecodedAction } from "../calldata.ts";
import { formatEther, getAddress, type Address, type Hex } from "viem";

export type XLayerTransaction = {
  hash: Hex;
  status: "CONFIRMED" | "REVERTED" | "PENDING";
  blockNumber?: string;
  from: Address;
  to?: Address;
  value: string;
  gasLimit: string;
  gasUsed?: string;
  input: Hex;
  decodedAction: DecodedAction;
  analysisInput?: {
    from: string;
    to: string;
    value: string;
    data: string;
    context: string;
  };
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type RpcTransaction = { hash?: unknown; blockNumber?: unknown; from?: unknown; to?: unknown; value?: unknown; gas?: unknown; input?: unknown };
type RpcReceipt = { status?: unknown; blockNumber?: unknown; gasUsed?: unknown };

export type TransactionAnalyzerOptions = {
  rpcUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

export class TransactionLookupError extends Error {
  code: "INVALID_HASH" | "NOT_FOUND" | "RPC_UNAVAILABLE" | "INVALID_RPC_RESPONSE";

  constructor(code: TransactionLookupError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const hashPattern = /^0x[a-fA-F0-9]{64}$/;
const hexPattern = /^0x[a-fA-F0-9]+$/;
const defaultRpcUrl = "https://testrpc.xlayer.tech/terigon";

export function validateTransactionHash(hash: string) {
  return hashPattern.test(hash);
}

async function rpcCall(method: string, hash: string, rpcUrl: string, signal: AbortSignal, fetchImpl: FetchLike) {
  let response: Response;
  try {
    response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [hash] }),
      cache: "no-store",
      signal
    });
  } catch {
    throw new TransactionLookupError("RPC_UNAVAILABLE", "X Layer RPC is unavailable");
  }
  if (!response.ok) throw new TransactionLookupError("RPC_UNAVAILABLE", `X Layer RPC returned HTTP ${response.status}`);
  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new TransactionLookupError("RPC_UNAVAILABLE", body.error.message ?? "X Layer RPC request failed");
  if (!("result" in body)) throw new TransactionLookupError("INVALID_RPC_RESPONSE", "X Layer RPC returned no result");
  return body.result;
}

function requiredHex(value: unknown, field: string, allowEmpty = false): Hex {
  if (typeof value !== "string" || !(allowEmpty ? /^0x(?:[a-fA-F0-9]{2})*$/.test(value) : hexPattern.test(value))) throw new TransactionLookupError("INVALID_RPC_RESPONSE", `Transaction ${field} is invalid`);
  return value as Hex;
}

function quantity(value: unknown, field: string) {
  const hex = requiredHex(value, field);
  try { return BigInt(hex); } catch { throw new TransactionLookupError("INVALID_RPC_RESPONSE", `Transaction ${field} is invalid`); }
}

export async function analyzeXLayerTransaction(hash: string, options: TransactionAnalyzerOptions = {}): Promise<XLayerTransaction> {
  if (!validateTransactionHash(hash)) throw new TransactionLookupError("INVALID_HASH", "Enter a 0x-prefixed 32-byte transaction hash");
  const rpcUrl = options.rpcUrl ?? process.env.XLAYER_RPC_URL ?? defaultRpcUrl;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4_500);
  try {
    const [transactionValue, receiptValue] = await Promise.all([
      rpcCall("eth_getTransactionByHash", hash, rpcUrl, controller.signal, fetchImpl),
      rpcCall("eth_getTransactionReceipt", hash, rpcUrl, controller.signal, fetchImpl)
    ]);
    if (transactionValue === null) throw new TransactionLookupError("NOT_FOUND", "Transaction was not found on X Layer Testnet");
    if (!transactionValue || typeof transactionValue !== "object") throw new TransactionLookupError("INVALID_RPC_RESPONSE", "Transaction response is invalid");
    const transaction = transactionValue as RpcTransaction;
    const from = getAddress(requiredHex(transaction.from, "from"));
    const to = transaction.to === null ? undefined : getAddress(requiredHex(transaction.to, "to"));
    const input = requiredHex(transaction.input, "input", true);
    const value = formatEther(quantity(transaction.value, "value"));
    const gasLimit = quantity(transaction.gas, "gas").toString();
    const receipt = receiptValue && typeof receiptValue === "object" ? receiptValue as RpcReceipt : undefined;
    const receiptStatus = receipt?.status === "0x1" ? "CONFIRMED" : receipt?.status === "0x0" ? "REVERTED" : "PENDING";
    const blockNumberValue = receipt?.blockNumber ?? transaction.blockNumber;
    const blockNumber = typeof blockNumberValue === "string" && hexPattern.test(blockNumberValue) ? BigInt(blockNumberValue).toString() : undefined;
    const gasUsed = typeof receipt?.gasUsed === "string" && hexPattern.test(receipt.gasUsed) ? BigInt(receipt.gasUsed).toString() : undefined;
    const decodedAction = decodeCalldata(input);
    return {
      hash: hash as Hex,
      status: receiptStatus,
      blockNumber,
      from,
      to,
      value,
      gasLimit,
      gasUsed,
      input,
      decodedAction,
      analysisInput: to ? { from, to, value, data: input, context: `Post-hoc analysis of X Layer transaction ${hash}` } : undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}
