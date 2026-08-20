import { NextResponse } from "next/server";
import { analyzeXLayerTransaction, TransactionLookupError } from "../../../lib/chain/transaction-analyzer";
import { consumeAnalyzeRateLimit } from "../../../lib/api-rate-limit";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = `transaction:${forwardedFor || request.headers.get("x-real-ip") || "anonymous"}`;
  const limit = consumeAnalyzeRateLimit(clientKey);
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded", code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000) return NextResponse.json({ error: "Request body too large", code: "BODY_TOO_LARGE" }, { status: 413 });
  let hash = "";
  try {
    const rawBody = await request.text();
    if (rawBody.length > 1_000) return NextResponse.json({ error: "Request body too large", code: "BODY_TOO_LARGE" }, { status: 413 });
    const body = JSON.parse(rawBody) as { hash?: unknown };
    hash = typeof body.hash === "string" ? body.hash.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
  }
  try {
    return NextResponse.json(await analyzeXLayerTransaction(hash));
  } catch (error) {
    if (error instanceof TransactionLookupError) {
      const status = error.code === "INVALID_HASH" ? 400 : error.code === "NOT_FOUND" ? 404 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Transaction lookup failed", code: "RPC_UNAVAILABLE" }, { status: 502 });
  }
}
