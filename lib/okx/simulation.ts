import { createHmac } from "node:crypto";
import { getAddress, parseUnits } from "viem";
import { getAnalysisNetworkConfig, normalizeAnalysisNetwork, type AnalysisNetwork } from "../network.ts";
import type { RiskInput, RiskSignal } from "../risk.ts";

export const okxSimulationRequestPath = "/api/v6/dex/pre-transaction/simulate";
export const okxSimulationBaseUrl = "https://web3.okx.com";

export type SimulationStatus = "AVAILABLE" | "UNAVAILABLE" | "UNSUPPORTED" | "ERROR";

export type SimulationAssetChange = {
  assetType: string | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  address: string | null;
  rawValue: string;
};

export type SimulationRisk = {
  address: string | null;
  addressType: string | null;
};

export type SimulationEvidence = {
  provider: "OKX_ONCHAINOS";
  network: AnalysisNetwork;
  chainId: 1952 | 196;
  chainIndex: "196" | null;
  status: SimulationStatus;
  statusDetail: string | null;
  intention: string | null;
  assetChanges: SimulationAssetChange[];
  gasUsed: string | null;
  failReason: string | null;
  risks: SimulationRisk[];
  observedAt: string;
  durationMs: number;
  httpStatus: number | null;
  businessCode: string | null;
};

type OkxCredentials = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SimulationOptions = {
  credentials?: OkxCredentials | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => Date;
};

function readCredentials(): OkxCredentials | null {
  const apiKey = process.env.OKX_API_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_API_PASSPHRASE?.trim();
  return apiKey && secretKey && passphrase ? { apiKey, secretKey, passphrase } : null;
}

export function createOkxPrehash(timestamp: string, method: "POST", requestPath: string, rawBody: string) {
  return `${timestamp}${method}${requestPath}${rawBody}`;
}

export function signOkxPrehash(prehash: string, secretKey: string) {
  return createHmac("sha256", secretKey).update(prehash).digest("base64");
}

export function buildOkxAuthHeaders(timestamp: string, rawBody: string, credentials: OkxCredentials): Record<string, string> {
  const signature = signOkxPrehash(createOkxPrehash(timestamp, "POST", okxSimulationRequestPath, rawBody), credentials.secretKey);
  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": credentials.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": credentials.passphrase
  };
}

function emptyEvidence(input: RiskInput, observedAt: string, status: SimulationStatus, statusDetail: string, durationMs = 0, httpStatus: number | null = null, businessCode: string | null = null): SimulationEvidence {
  const network = normalizeAnalysisNetwork(input.analysisNetwork);
  const config = getAnalysisNetworkConfig(network);
  return {
    provider: "OKX_ONCHAINOS",
    network,
    chainId: config.chainId,
    chainIndex: config.okxChainIndex,
    status,
    statusDetail,
    intention: null,
    assetChanges: [],
    gasUsed: null,
    failReason: null,
    risks: [],
    observedAt,
    durationMs,
    httpStatus,
    businessCode
  };
}

function boundedString(value: unknown, maxLength = 1_000): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function normalizeAddress(value: unknown): string | null {
  if (value === "") return "";
  if (typeof value !== "string") return null;
  try { return getAddress(value); } catch { return null; }
}

function normalizeAssetChanges(value: unknown): SimulationAssetChange[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const normalized: SimulationAssetChange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const rawValue = boundedString(record.rawValue, 200);
    if (rawValue === null || !/^-?\d+$/.test(rawValue)) return null;
    const rawDecimals = record.decimals;
    const decimals = Number.isInteger(rawDecimals) && Number(rawDecimals) >= 0 && Number(rawDecimals) <= 255 ? Number(rawDecimals) : null;
    normalized.push({
      assetType: boundedString(record.assetType, 100),
      name: boundedString(record.name, 200),
      symbol: boundedString(record.symbol, 100),
      decimals,
      address: normalizeAddress(record.address),
      rawValue
    });
  }
  return normalized;
}

function normalizeRisks(value: unknown): SimulationRisk[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const normalized: SimulationRisk[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    normalized.push({ address: normalizeAddress(record.address), addressType: boundedString(record.addressType, 100) });
  }
  return normalized;
}

function buildRequestBody(input: RiskInput) {
  return JSON.stringify({
    fromAddress: input.from,
    toAddress: input.to,
    chainIndex: "196",
    txAmount: parseUnits(input.value.trim(), 18).toString(),
    extJson: { inputData: input.data }
  });
}

function classifyHttpFailure(input: RiskInput, observedAt: string, durationMs: number, status: number) {
  if (status === 401 || status === 403) return emptyEvidence(input, observedAt, "ERROR", "OKX authentication was rejected", durationMs, status);
  if (status === 429) return emptyEvidence(input, observedAt, "UNAVAILABLE", "OKX simulation is rate limited", durationMs, status);
  if (status >= 500) return emptyEvidence(input, observedAt, "UNAVAILABLE", "OKX simulation service is unavailable", durationMs, status);
  return emptyEvidence(input, observedAt, "ERROR", `OKX simulation returned HTTP ${status}`, durationMs, status);
}

export async function simulateTransaction(input: RiskInput, options: SimulationOptions = {}): Promise<SimulationEvidence> {
  const now = options.now ?? (() => new Date());
  const startedAt = Date.now();
  const observedAt = now().toISOString();
  const network = normalizeAnalysisNetwork(input.analysisNetwork);
  if (network !== "XLAYER_MAINNET") return emptyEvidence(input, observedAt, "UNSUPPORTED", "OKX Transaction Simulation is not supported for X Layer Testnet");
  if (!input.from) return emptyEvidence(input, observedAt, "ERROR", "A sender address is required for OKX simulation");
  const credentials = options.credentials === undefined ? readCredentials() : options.credentials;
  if (!credentials) return emptyEvidence(input, observedAt, "UNAVAILABLE", "OKX simulation credentials are not configured");

  let rawBody: string;
  try { rawBody = buildRequestBody(input); } catch { return emptyEvidence(input, observedAt, "ERROR", "Transaction value could not be converted to base units"); }
  const timestamp = now().toISOString();
  const headers = buildOkxAuthHeaders(timestamp, rawBody, credentials);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  let response: Response;
  try {
    response = await fetchImpl(`${okxSimulationBaseUrl}${okxSimulationRequestPath}`, {
      method: "POST",
      headers,
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    return emptyEvidence(input, observedAt, "UNAVAILABLE", "OKX simulation request timed out or could not be reached", Date.now() - startedAt);
  }
  const durationMs = Date.now() - startedAt;
  if (!response.ok) return classifyHttpFailure(input, observedAt, durationMs, response.status);

  let payload: unknown;
  try { payload = await response.json(); } catch { return emptyEvidence(input, observedAt, "ERROR", "OKX simulation returned invalid JSON", durationMs, response.status); }
  if (!payload || typeof payload !== "object") return emptyEvidence(input, observedAt, "ERROR", "OKX simulation returned a malformed response", durationMs, response.status);
  const envelope = payload as Record<string, unknown>;
  const businessCode = typeof envelope.code === "string" || typeof envelope.code === "number" ? String(envelope.code) : null;
  if (businessCode !== "0") return emptyEvidence(input, observedAt, "ERROR", "OKX simulation returned a business error", durationMs, response.status, businessCode);
  if (!Array.isArray(envelope.data) || !envelope.data[0] || typeof envelope.data[0] !== "object") return emptyEvidence(input, observedAt, "ERROR", "OKX simulation returned no result data", durationMs, response.status, businessCode);
  const result = envelope.data[0] as Record<string, unknown>;
  const assetChanges = normalizeAssetChanges(result.assetChange);
  const risks = normalizeRisks(result.risks);
  const gasUsed = boundedString(result.gasUsed, 200);
  const failReason = boundedString(result.failReason, 1_000);
  if (assetChanges === null || risks === null || (result.gasUsed !== undefined && gasUsed === null) || (result.failReason !== undefined && failReason === null)) {
    return emptyEvidence(input, observedAt, "ERROR", "OKX simulation returned malformed result fields", durationMs, response.status, businessCode);
  }
  return {
    provider: "OKX_ONCHAINOS",
    network,
    chainId: 196,
    chainIndex: "196",
    status: "AVAILABLE",
    statusDetail: null,
    intention: boundedString(result.intention, 200),
    assetChanges,
    gasUsed,
    failReason: failReason || null,
    risks,
    observedAt,
    durationMs,
    httpStatus: response.status,
    businessCode
  };
}

export function signalsFromSimulation(simulation: SimulationEvidence): RiskSignal[] {
  if (simulation.status !== "AVAILABLE") return [];
  const signals: RiskSignal[] = simulation.risks.map((risk, index) => ({
    id: `okx-simulation-risk-${index}`,
    source: "OKX",
    severity: "advisory",
    title: "OKX simulation risk evidence",
    detail: [risk.addressType, risk.address].filter(Boolean).join(" · ") || "OKX returned a risk entry without an address label."
  }));
  if (simulation.failReason) {
    signals.push({ id: "okx-simulation-failure", source: "OKX", severity: "advisory", title: "OKX simulation indicates possible failure", detail: simulation.failReason });
  }
  return signals;
}
