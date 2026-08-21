import { riskLevelForScore, type RiskLevel } from "./risk.ts";
import type { SimulationEvidence } from "./okx/simulation.ts";

export type RiskScorePresentation = {
  final: { label: "Final Risk Score"; score: number; level: RiskLevel };
  deterministic: { label: "Deterministic Known Risk"; score: number; level: RiskLevel };
  ai: { label: "AI Advisory"; score: number | null; level: RiskLevel | null };
};

export function buildRiskScorePresentation(result: {
  finalScore: number;
  deterministicScore: number;
  aiScore?: number;
  level: RiskLevel;
}): RiskScorePresentation {
  const aiScore = typeof result.aiScore === "number" ? result.aiScore : null;
  return {
    final: { label: "Final Risk Score", score: result.finalScore, level: result.level },
    deterministic: {
      label: "Deterministic Known Risk",
      score: result.deterministicScore,
      level: riskLevelForScore(result.deterministicScore)
    },
    ai: {
      label: "AI Advisory",
      score: aiScore,
      level: aiScore === null ? null : riskLevelForScore(aiScore)
    }
  };
}

export function isLiveOkxProviderEvidence(simulation: SimulationEvidence | null | undefined): boolean {
  return Boolean(simulation
    && simulation.provider === "OKX_ONCHAINOS"
    && simulation.network === "XLAYER_MAINNET"
    && simulation.chainId === 196
    && simulation.chainIndex === "196"
    && simulation.status === "AVAILABLE"
    && simulation.httpStatus === 200
    && simulation.businessCode === "0");
}
