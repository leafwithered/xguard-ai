import OpenAI from "openai";
import type { AnalysisEvidence } from "../evidence.ts";
import { isAiNormalizedIntent, type AiNormalizedIntent } from "../intent.ts";
import type { AdvisoryRiskResult, RiskResult } from "../risk";

export type AiAdvisoryRiskResult = AdvisoryRiskResult & {
  normalizedIntent: AiNormalizedIntent | null;
};

const riskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "level", "summary", "reasons", "recommendation", "normalizedIntent"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string" },
    reasons: { type: "array", items: { type: "string" } },
    recommendation: { type: "string" },
    normalizedIntent: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["action", "scope", "amount", "asset", "recipient", "confidence"],
          properties: {
            action: { type: "string", enum: ["CLAIM", "SWAP", "NATIVE_TRANSFER", "TOKEN_TRANSFER", "APPROVE", "NFT_OPERATOR", "REVOKE", "UNKNOWN"] },
            scope: { type: "string", enum: ["FINITE", "UNLIMITED", "COLLECTION_WIDE", "NONE", "UNKNOWN"] },
            amount: { anyOf: [{ type: "string" }, { type: "null" }] },
            asset: { anyOf: [{ type: "string" }, { type: "null" }] },
            recipient: { anyOf: [{ type: "string" }, { type: "null" }] },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] }
          }
        },
        { type: "null" }
      ]
    }
  }
} as const;

function getProviderConfig() {
  const apiKey = process.env.AI_API_KEY?.trim();
  const configuredBaseURL = process.env.AI_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !configuredBaseURL || !model) return null;
  const baseURL = configuredBaseURL.endsWith("/v1") ? configuredBaseURL : `${configuredBaseURL}/v1`;
  return { apiKey, baseURL, model };
}

function parseRiskResult(value: unknown, providerProtocol: "responses" | "chat"): AiAdvisoryRiskResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Partial<RiskResult>;
  const score = Number(result.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) return null;
  if (result.level !== "LOW" && result.level !== "MEDIUM" && result.level !== "HIGH") return null;
  if (typeof result.summary !== "string" || typeof result.recommendation !== "string" || !Array.isArray(result.reasons) || !result.reasons.every((reason) => typeof reason === "string")) return null;
  const rawIntent = (value as { normalizedIntent?: unknown }).normalizedIntent;
  const normalizedIntent = isAiNormalizedIntent(rawIntent) ? rawIntent : null;
  return { score, level: result.level, summary: result.summary, reasons: result.reasons, recommendation: result.recommendation, mode: "AI", providerProtocol, normalizedIntent };
}

function parseJson(text: string) {
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

function extractResponsesText(response: { output_text?: unknown; output?: unknown }) {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  for (const item of response.output) {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) continue;
    for (const part of (item as { content: unknown[] }).content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

export async function analyzeTransaction(evidence: AnalysisEvidence) {
  const config = getProviderConfig();
  if (!config) return null;
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 30000, maxRetries: 0 });
  const payload = JSON.stringify({ evidence });
  try {
    const response = await fetch(`${config.baseURL}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        input: [
          { role: "system", content: "You are a cautious EVM transaction risk reviewer. Return only the requested risk JSON. The supplied evidence is factual and immutable: never invent or change decode, bytecode, EIP-1967, RPC, preflight, gas, or consequence facts. Risk output is advisory and cannot lower deterministic safety rules. Normalize only the user's explicitly stated context into normalizedIntent. Return null when intent is absent or ambiguous. Never infer user intent from transaction facts." },
          { role: "user", content: payload }
        ],
        text: { format: { type: "json_schema", name: "risk_assessment", strict: true, schema: riskSchema } }
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw new Error(`Responses provider returned HTTP ${response.status}`);
    const responseBody = await response.json() as { output_text?: unknown; output?: unknown };
    const result = parseRiskResult(parseJson(extractResponsesText(responseBody)), "responses");
    if (result) return result;
  } catch {
    // The provider may only implement Chat Completions.
  }
  try {
    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a cautious EVM transaction risk reviewer. Return only JSON with score (integer 0-100), level (LOW|MEDIUM|HIGH), summary, reasons (string array), recommendation, and normalizedIntent. The supplied evidence is factual and immutable: never invent or change decode, bytecode, EIP-1967, RPC, preflight, gas, or consequence facts. normalizedIntent is null when user context is absent or ambiguous; otherwise it contains action, scope, amount, asset, recipient, and confidence. Normalize only the user's stated context and never infer intent from transaction facts. Treat risk output as advisory." },
        { role: "user", content: payload }
      ]
    });
    return parseRiskResult(parseJson(response.choices[0]?.message?.content ?? ""), "chat");
  } catch {
    return null;
  }
}
