import { NextResponse } from "next/server";
import { analyzeTransaction } from "../../../lib/ai/provider";
import { localRiskAnalysis, validateRiskInput, type RiskInput } from "../../../lib/risk";

export async function POST(request: Request) {
  let input: RiskInput;
  try {
    input = (await request.json()) as RiskInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const errors = validateRiskInput(input);
  if (errors.length) return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
  const fallback = localRiskAnalysis(input);
  const aiResult = await analyzeTransaction(input, fallback);
  return NextResponse.json(aiResult ?? fallback);
}
