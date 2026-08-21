import { analyzeWithXGuard, getPolicyAction, type RiskInput, type XGuardAnalysisResponse } from "../sdk/xguard.ts";

export type WalletGuardUi = {
  showNormalConfirmation(analysis: XGuardAnalysisResponse): Promise<void>;
  showWarning(analysis: XGuardAnalysisResponse): Promise<void>;
  requireHumanReview(analysis: XGuardAnalysisResponse): Promise<void>;
  showBlockRecommendation(analysis: XGuardAnalysisResponse): Promise<void>;
  requestExplicitWalletSignature(analysis: XGuardAnalysisResponse): Promise<void>;
};

export async function reviewPreparedTransaction(
  transaction: RiskInput,
  ui: WalletGuardUi,
  analyze: (input: RiskInput) => Promise<XGuardAnalysisResponse> = analyzeWithXGuard
) {
  const analysis = await analyze(transaction);
  const action = getPolicyAction(analysis);

  switch (action) {
    case "ALLOW":
      await ui.showNormalConfirmation(analysis);
      break;
    case "WARN":
      await ui.showWarning(analysis);
      break;
    case "REQUIRE_REVIEW":
      await ui.requireHumanReview(analysis);
      return analysis;
    case "BLOCK_RECOMMENDED":
      await ui.showBlockRecommendation(analysis);
      return analysis;
  }

  await ui.requestExplicitWalletSignature(analysis);
  return analysis;
}
