import OpenAI from "openai";
import type { RiskInput, RiskResult } from "../risk";

const riskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "level", "summary", "reasons", "recommendation"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string" },
    reasons: { type: "array", items: { type: "string" } },
    recommendation: { type: "string" }
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

function parseRiskResult(value: unknown, providerProtocol: "responses" | "chat"): RiskResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Partial<RiskResult>;
  const score = Number(result.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) return null;
  if (result.level !== "LOW" && result.level !== "MEDIUM" && result.level !== "HIGH") return null;
  if (typeof result.summary !== "string" || typeof result.recommendation !== "string" || !Array.isArray(result.reasons) || !result.reasons.every((reason) => typeof reason === "string")) return null;
  return { score, level: result.level, summary: result.summary, reasons: result.reasons, recommendation: result.recommendation, mode: "AI", providerProtocol };
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

export async function analyzeTransaction(input: RiskInput, deterministicSignals: RiskResult) {
  const config = getProviderConfig();
  if (!config) return null;
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 30000, maxRetries: 0 });
  const payload = JSON.stringify({ transaction: input, deterministicSignals });
  try {
    const response = await fetch(`${config.baseURL}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        input: [
          { role: "system", content: "You are a cautious EVM transaction risk reviewer. Return only the requested risk JSON. Treat it as advisory." },
          { role: "user", content: payload }
        ],
        text: { format: { type: "json_schema", name: "risk_assessment", strict: true, schema: riskSchema } }
      }),
      signal: AbortSignal.timeout(90000)
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
        { role: "system", content: "You are a cautious EVM transaction risk reviewer. Return only JSON with score (integer 0-100), level (LOW|MEDIUM|HIGH), summary, reasons (string array), and recommendation. Treat it as advisory." },
        { role: "user", content: payload }
      ]
    });
    return parseRiskResult(parseJson(response.choices[0]?.message?.content ?? ""), "chat");
  } catch {
    return null;
  }
}
