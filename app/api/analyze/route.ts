import { NextResponse } from "next/server";
import { analyzeTransaction } from "../../../lib/ai/provider";
import { localRiskAnalysis, validateRiskInput, type RiskInput } from "../../../lib/risk";
import { mergeRiskResults } from "../../../lib/risk-fusion";
import { consumeAnalyzeRateLimit } from "../../../lib/api-rate-limit";
import { inspectContract, signalsFromIntelligence } from "../../../lib/chain/intelligence";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwardedFor || request.headers.get("x-real-ip") || "anonymous";
  const limit = consumeAnalyzeRateLimit(clientKey);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded", code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 24_000) return NextResponse.json({ error: "Request body too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  let input: RiskInput;
  try {
    const body = await request.text();
    if (body.length > 24_000) return NextResponse.json({ error: "Request body too large", code: "BODY_TOO_LARGE" }, { status: 413 });
    input = JSON.parse(body) as RiskInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
  }
  const errors = validateRiskInput(input);
  if (errors.length) return NextResponse.json({ error: errors.join(". "), code: "INVALID_INPUT" }, { status: 400 });
  const fallback = localRiskAnalysis(input);
  const [aiResult, contractIntelligence] = await Promise.all([
    analyzeTransaction(input, fallback),
    inspectContract(input)
  ]);
  const riskResult = aiResult ? mergeRiskResults(fallback, aiResult) : fallback;
  return NextResponse.json({ ...riskResult, advisorySignals: [...riskResult.advisorySignals, ...signalsFromIntelligence(contractIntelligence)], contractIntelligence });
}
