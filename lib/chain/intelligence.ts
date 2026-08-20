import { getAddress, parseUnits, toHex, type Address, type Hex } from "viem";
import type { RiskSignal } from "../risk.ts";

export type ContractIntelligence = {
  address: Address;
  addressType: "EOA" | "SMART_CONTRACT" | "UNAVAILABLE";
  codePresent: boolean | null;
  codeSizeBytes: number | null;
  proxyDetected: boolean | null;
  implementationAddress?: Address;
  preflightStatus: "SUCCEEDED" | "REVERTED" | "UNAVAILABLE";
  revertReason?: string;
  estimatedGas?: string;
  rpcStatus: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

export type IntelligenceInput = {
  from: string;
  to: string;
  value: string;
  data: string;
};

type JsonRpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type IntelligenceOptions = {
  rpcUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

const defaultRpcUrl = "https://testrpc.xlayer.tech/terigon";
const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

class RpcError extends Error {
  readonly data?: unknown;
  readonly isRevert: boolean;

  constructor(message: string, data?: unknown, isRevert = false) {
    super(message);
    this.data = data;
    this.isRevert = isRevert;
  }
}

function isHex(value: unknown): value is Hex {
  return typeof value === "string" && /^0x(?:[a-fA-F0-9]{2})*$/.test(value);
}

function findHexData(value: unknown): Hex | undefined {
  if (isHex(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  for (const key of ["data", "result", "return", "originalError"]) {
    const nested = findHexData((value as Record<string, unknown>)[key]);
    if (nested) return nested;
  }
  return undefined;
}

export function decodeRevertReason(value: unknown): string | undefined {
  const data = findHexData(value);
  if (!data || data.length < 10) return undefined;
  try {
    if (data.startsWith("0x08c379a0") && data.length >= 138) {
      const payload = data.slice(10);
      const length = Number.parseInt(payload.slice(64, 128), 16);
      if (!Number.isSafeInteger(length) || length < 0) return "Error(string)";
      const messageHex = payload.slice(128, 128 + length * 2);
      const bytes = Uint8Array.from(messageHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
      const message = new TextDecoder().decode(bytes).replace(/\0+$/g, "").trim();
      return message ? `Error: ${message}` : "Error(string)";
    }
    if (data.startsWith("0x4e487b71") && data.length >= 74) {
      const code = BigInt(`0x${data.slice(-64)}`);
      return `Panic(${toHex(code)})`;
    }
  } catch {
    return undefined;
  }
  return `Reverted (${data.slice(0, 10)})`;
}

async function rpcCall(method: string, params: unknown[], rpcUrl: string, signal: AbortSignal, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new RpcError(`RPC HTTP ${response.status}`);
  const payload = await response.json() as JsonRpcResponse;
  if (payload.error) {
    const message = payload.error.message ?? `RPC ${method} failed`;
    const isRevert = payload.error.code === 3 || /revert/i.test(message) || Boolean(findHexData(payload.error.data));
    throw new RpcError(message, payload.error.data, isRevert);
  }
  if (!("result" in payload)) throw new RpcError(`RPC ${method} returned no result`);
  return payload.result;
}

function transactionParams(input: IntelligenceInput) {
  const transaction: Record<string, string> = {
    to: input.to,
    data: input.data,
    value: toHex(parseUnits(input.value.trim(), 18))
  };
  if (input.from) transaction.from = input.from;
  return transaction;
}

function implementationFromSlot(value: unknown): Address | undefined {
  if (!isHex(value) || value.length !== 66) return undefined;
  const rawAddress = value.slice(-40);
  if (/^0{40}$/.test(rawAddress)) return undefined;
  try {
    return getAddress(`0x${rawAddress}`);
  } catch {
    return undefined;
  }
}

export async function inspectContract(input: IntelligenceInput, options: IntelligenceOptions = {}): Promise<ContractIntelligence> {
  const rpcUrl = options.rpcUrl ?? process.env.XLAYER_RPC_URL ?? defaultRpcUrl;
  const timeoutMs = options.timeoutMs ?? 4_500;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const base: ContractIntelligence = {
    address: getAddress(input.to),
    addressType: "UNAVAILABLE",
    codePresent: null,
    codeSizeBytes: null,
    proxyDetected: null,
    preflightStatus: "UNAVAILABLE",
    rpcStatus: "UNAVAILABLE"
  };

  try {
    const tx = transactionParams(input);
    const codePromise = rpcCall("eth_getCode", [input.to, "latest"], rpcUrl, controller.signal, fetchImpl);
    const callPromise = rpcCall("eth_call", [tx, "latest"], rpcUrl, controller.signal, fetchImpl);
    const gasPromise = rpcCall("eth_estimateGas", [tx], rpcUrl, controller.signal, fetchImpl);
    const [codeResult, callResult, gasResult] = await Promise.allSettled([codePromise, callPromise, gasPromise]);
    let successfulChecks = 0;

    if (codeResult.status === "fulfilled" && isHex(codeResult.value)) {
      successfulChecks += 1;
      const size = Math.max(0, (codeResult.value.length - 2) / 2);
      base.codePresent = size > 0;
      base.codeSizeBytes = size;
      base.addressType = size > 0 ? "SMART_CONTRACT" : "EOA";
      if (size === 0) {
        base.proxyDetected = false;
      } else {
        try {
          const stored = await rpcCall("eth_getStorageAt", [input.to, implementationSlot, "latest"], rpcUrl, controller.signal, fetchImpl);
          const implementation = implementationFromSlot(stored);
          base.proxyDetected = Boolean(implementation);
          if (implementation) base.implementationAddress = implementation;
        } catch {
          base.proxyDetected = null;
        }
      }
    }

    if (callResult.status === "fulfilled" && isHex(callResult.value)) {
      successfulChecks += 1;
      base.preflightStatus = "SUCCEEDED";
    } else if (callResult.status === "rejected" && callResult.reason instanceof RpcError && callResult.reason.isRevert) {
      base.preflightStatus = "REVERTED";
      base.revertReason = decodeRevertReason(callResult.reason.data) ?? "Call reverted without a decoded reason";
    }

    if (gasResult.status === "fulfilled" && typeof gasResult.value === "string" && /^0x[a-fA-F0-9]+$/.test(gasResult.value)) {
      successfulChecks += 1;
      base.estimatedGas = BigInt(gasResult.value).toString();
    }

    base.rpcStatus = successfulChecks === 3 ? "AVAILABLE" : successfulChecks > 0 ? "PARTIAL" : "UNAVAILABLE";
    return base;
  } catch {
    return base;
  } finally {
    clearTimeout(timeout);
  }
}

export function signalsFromIntelligence(intelligence: ContractIntelligence): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (intelligence.proxyDetected) {
    signals.push({ id: "eip1967-proxy", source: "ON-CHAIN", severity: "advisory", title: "EIP-1967 proxy detected", detail: intelligence.implementationAddress ? `Implementation: ${intelligence.implementationAddress}` : "The implementation slot is populated." });
  }
  if (intelligence.preflightStatus === "REVERTED") {
    signals.push({ id: "preflight-revert", source: "ON-CHAIN", severity: "advisory", title: "Transaction preflight reverted", detail: intelligence.revertReason ?? "The proposed call reverted." });
  }
  return signals;
}
