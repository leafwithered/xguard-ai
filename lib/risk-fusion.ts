import { riskLevelForScore, type AdvisoryRiskResult, type RiskResult, type RiskSignal } from "./risk.ts";

function uniqueText(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSignals(values: RiskSignal[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.title}:${value.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeRiskResults(localResult: RiskResult, aiResult: AdvisoryRiskResult | null): RiskResult {
  if (!aiResult) return localResult;

  const finalScore = Math.max(localResult.deterministicScore, aiResult.score);
  const finalLevel = riskLevelForScore(finalScore);
  const aiRaisedRisk = aiResult.score > localResult.deterministicScore;
  const advisorySignals = uniqueSignals([
    ...localResult.advisorySignals,
    ...aiResult.reasons.map((reason, index) => ({
      id: `ai-${index}`,
      severity: "advisory" as const,
      title: reason,
      detail: "AI-provided advisory signal"
    }))
  ]);
  const recommendationParts = uniqueText(aiRaisedRisk
    ? [aiResult.recommendation, localResult.recommendation]
    : [localResult.recommendation, aiResult.recommendation]);

  return {
    ...localResult,
    score: finalScore,
    finalScore,
    aiScore: aiResult.score,
    level: finalLevel,
    summary: aiRaisedRisk || aiResult.score === localResult.deterministicScore ? aiResult.summary : localResult.summary,
    reasons: uniqueText([...localResult.reasons, ...aiResult.reasons]),
    recommendation: recommendationParts.join(" "),
    advisorySignals,
    aiExplanation: aiResult.summary,
    mode: "HYBRID",
    providerProtocol: aiResult.providerProtocol
  };
}
