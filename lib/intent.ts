import { parseUnits } from "viem";
import type { DecodedAction } from "./calldata.ts";
import type { TransactionConsequence } from "./consequence.ts";
import { observedTransactionSummary } from "./consequence.ts";
import { riskLevelForScore, type RiskInput, type RiskResult, type RiskSignal } from "./risk.ts";

export type IntentAction = "CLAIM" | "SWAP" | "NATIVE_TRANSFER" | "TOKEN_TRANSFER" | "APPROVE" | "NFT_OPERATOR" | "REVOKE" | "UNKNOWN";
export type IntentScope = "FINITE" | "UNLIMITED" | "COLLECTION_WIDE" | "NONE" | "UNKNOWN";
export type IntentConfidence = "HIGH" | "MEDIUM" | "LOW";

export type NormalizedIntent = {
  action: IntentAction;
  scope: IntentScope;
  amount: string | null;
  asset: string | null;
  recipient: string | null;
  confidence: IntentConfidence;
  source: "DETERMINISTIC" | "AI";
};

export type AiNormalizedIntent = Omit<NormalizedIntent, "source">;

export type IntentComparison = {
  status: "MATCH" | "PARTIAL" | "MISMATCH" | "UNKNOWN";
  userIntent: string;
  observedTransaction: string;
  why: string;
  normalizationSource: "DETERMINISTIC" | "AI_ASSISTED" | "NONE";
  confidence: IntentConfidence;
  deterministicMismatch: boolean;
};

const amountPattern = /(?:^|\s)(\d+(?:\.\d{1,18})?)(?:\s|$)/;
const addressPattern = /0x[a-fA-F0-9]{40}/;

function extractedAmount(value: string) {
  return value.match(amountPattern)?.[1] ?? null;
}

function extractedAsset(value: string) {
  const match = value.match(/\b(OKB|ETH|USDC|USDT|DAI|BTC|TOKEN|NFTS?|NFT)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function normalizeIntentDeterministically(text: string): NormalizedIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const amount = extractedAmount(trimmed);
  const asset = extractedAsset(trimmed);
  const recipient = trimmed.match(addressPattern)?.[0] ?? null;
  const base = { amount, asset, recipient, source: "DETERMINISTIC" as const };

  if (/\b(revoke|remove|cancel)\b/.test(lower) && /\b(approval|permission|operator|allowance)\b/.test(lower)) {
    return { ...base, action: "REVOKE", scope: "NONE", confidence: "HIGH" };
  }
  if (/\b(airdrop|claim|mint reward|collect reward)\b/.test(lower)) {
    return { ...base, action: "CLAIM", scope: "NONE", confidence: "HIGH" };
  }
  if (/\b(swap|exchange|trade)\b/.test(lower)) {
    return { ...base, action: "SWAP", scope: "UNKNOWN", confidence: "HIGH" };
  }
  if (/\b(setapprovalforall|all nfts|all nft|collection-wide|collection wide|nft operator)\b/.test(lower)) {
    return { ...base, action: "NFT_OPERATOR", scope: "COLLECTION_WIDE", confidence: "HIGH" };
  }
  if (/\b(approve|approval|allowance|allow .* spend|permission to spend)\b/.test(lower)) {
    const unlimited = /\b(unlimited|max(?:imum)?|all tokens?|entire balance)\b/.test(lower);
    const finite = !unlimited && (Boolean(amount) || /\b(only|limited|exactly|up to)\b/.test(lower));
    return { ...base, action: "APPROVE", scope: unlimited ? "UNLIMITED" : finite ? "FINITE" : "UNKNOWN", confidence: finite || unlimited ? "HIGH" : "MEDIUM" };
  }
  if (/\b(send(?:ing)?|transfer(?:ring)?|pay(?:ing)?)\b/.test(lower)) {
    const native = /\b(okb|native)\b/.test(lower);
    return { ...base, action: native ? "NATIVE_TRANSFER" : "TOKEN_TRANSFER", scope: "NONE", confidence: native ? "HIGH" : "MEDIUM" };
  }
  return { ...base, action: "UNKNOWN", scope: "UNKNOWN", confidence: "LOW" };
}

export function isAiNormalizedIntent(value: unknown): value is AiNormalizedIntent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiNormalizedIntent>;
  const actions: IntentAction[] = ["CLAIM", "SWAP", "NATIVE_TRANSFER", "TOKEN_TRANSFER", "APPROVE", "NFT_OPERATOR", "REVOKE", "UNKNOWN"];
  const scopes: IntentScope[] = ["FINITE", "UNLIMITED", "COLLECTION_WIDE", "NONE", "UNKNOWN"];
  const confidences: IntentConfidence[] = ["HIGH", "MEDIUM", "LOW"];
  return actions.includes(candidate.action as IntentAction)
    && scopes.includes(candidate.scope as IntentScope)
    && confidences.includes(candidate.confidence as IntentConfidence)
    && (candidate.amount === null || typeof candidate.amount === "string")
    && (candidate.asset === null || typeof candidate.asset === "string")
    && (candidate.recipient === null || typeof candidate.recipient === "string");
}

function actualAction(decoded: DecodedAction, input: RiskInput) {
  if (decoded.status === "unknown" || decoded.status === "malformed") return "UNKNOWN" as const;
  if (decoded.status === "empty") return /^0(?:\.0+)?$/.test(input.value.trim()) ? "EMPTY" as const : "NATIVE_TRANSFER" as const;
  if (decoded.action === "ERC20 Approval") return "APPROVE" as const;
  if (decoded.action === "ERC20 Transfer") return "TOKEN_TRANSFER" as const;
  if (decoded.action === "ERC20 Transfer From") return "TRANSFER_FROM" as const;
  if (decoded.action === "NFT Operator Approval") return decoded.approved ? "NFT_OPERATOR" as const : "REVOKE" as const;
  return "UNKNOWN" as const;
}

function sameNativeAmount(expected: string, actual: string) {
  try { return parseUnits(expected, 18) === parseUnits(actual, 18); } catch { return false; }
}

function result(
  status: IntentComparison["status"],
  input: RiskInput,
  consequences: TransactionConsequence[],
  why: string,
  normalized: NormalizedIntent | null,
  deterministicMismatch = false
): IntentComparison {
  return {
    status,
    userIntent: input.context.trim(),
    observedTransaction: observedTransactionSummary(consequences),
    why,
    normalizationSource: normalized?.source === "DETERMINISTIC" ? "DETERMINISTIC" : normalized?.source === "AI" ? "AI_ASSISTED" : "NONE",
    confidence: normalized?.confidence ?? "LOW",
    deterministicMismatch
  };
}

export function compareIntentToReality(
  input: RiskInput,
  decoded: DecodedAction,
  consequences: TransactionConsequence[],
  aiIntent?: AiNormalizedIntent | null
): IntentComparison {
  if (!input.context.trim()) return result("UNKNOWN", input, consequences, "No user intent was provided; normal transaction analysis remains available.", null);
  const deterministic = normalizeIntentDeterministically(input.context);
  const normalized = deterministic && deterministic.action !== "UNKNOWN"
    ? deterministic
    : aiIntent && aiIntent.action !== "UNKNOWN" && aiIntent.confidence !== "LOW"
      ? { ...aiIntent, source: "AI" as const }
      : deterministic;
  if (!normalized || normalized.action === "UNKNOWN") {
    return result("UNKNOWN", input, consequences, "The stated intent could not be normalized with enough confidence. Deterministic transaction analysis is unchanged.", normalized ?? null);
  }

  const actual = actualAction(decoded, input);
  if (actual === "UNKNOWN") {
    return result("UNKNOWN", input, consequences, "The calldata is unsupported or malformed, so XGuard cannot compare the stated intent with a deterministic decoded action.", normalized);
  }

  if (normalized.action === "CLAIM") {
    if (actual === "APPROVE" || actual === "NFT_OPERATOR" || actual === "TRANSFER_FROM") {
      return result("MISMATCH", input, consequences, "The stated intent is to claim assets, but the transaction grants or exercises asset-transfer permission.", normalized, normalized.source === "DETERMINISTIC");
    }
    return result("UNKNOWN", input, consequences, "The current decoder cannot prove that this transaction performs the stated claim action.", normalized);
  }

  if (normalized.action === "APPROVE") {
    if (actual !== "APPROVE") return result("MISMATCH", input, consequences, "The stated intent is token approval, but the decoded transaction performs a different action.", normalized, normalized.source === "DETERMINISTIC");
    if (normalized.scope === "FINITE" && decoded.isUnlimited) {
      return result("MISMATCH", input, consequences, "The stated intent is a limited approval, but the transaction grants an effectively unlimited allowance.", normalized, normalized.source === "DETERMINISTIC");
    }
    if (normalized.scope === "UNLIMITED" && !decoded.isUnlimited) {
      return result("PARTIAL", input, consequences, "The approval action matches, but the decoded allowance is finite rather than the stated unlimited scope.", normalized);
    }
    return result("MATCH", input, consequences, "The stated approval scope matches the decoded approval permission.", normalized);
  }

  if (normalized.action === "NATIVE_TRANSFER") {
    if (actual !== "NATIVE_TRANSFER") return result("MISMATCH", input, consequences, "The stated intent is a native OKB transfer, but the transaction encodes a different action.", normalized, normalized.source === "DETERMINISTIC");
    if (normalized.amount && !sameNativeAmount(normalized.amount, input.value)) {
      return result("MISMATCH", input, consequences, `The stated amount is ${normalized.amount} OKB, but the transaction sends ${input.value} OKB.`, normalized, normalized.source === "DETERMINISTIC");
    }
    return result("MATCH", input, consequences, "The native transfer action and stated amount match the encoded transaction value.", normalized);
  }

  if (normalized.action === "TOKEN_TRANSFER") {
    if (actual !== "TOKEN_TRANSFER" && actual !== "TRANSFER_FROM") return result("MISMATCH", input, consequences, "The stated intent is a token transfer, but the decoded transaction performs a different action.", normalized, normalized.source === "DETERMINISTIC");
    if (normalized.amount) return result("PARTIAL", input, consequences, "The token transfer action matches, but token decimals are unavailable, so the human amount cannot be compared safely.", normalized);
    return result("MATCH", input, consequences, "The stated token-transfer action matches the decoded transaction action.", normalized);
  }

  if (normalized.action === "NFT_OPERATOR") {
    return actual === "NFT_OPERATOR"
      ? result("MATCH", input, consequences, "The stated collection-wide operator permission matches the decoded transaction.", normalized)
      : result("MISMATCH", input, consequences, "The stated NFT operator action does not match the decoded transaction action.", normalized, normalized.source === "DETERMINISTIC");
  }

  if (normalized.action === "REVOKE") {
    const erc20Revocation = actual === "APPROVE" && decoded.amount === "0";
    return actual === "REVOKE" || erc20Revocation
      ? result("MATCH", input, consequences, "The decoded transaction revokes the stated permission.", normalized)
      : result("MISMATCH", input, consequences, "The stated intent is to revoke permission, but the decoded transaction does not revoke it.", normalized, normalized.source === "DETERMINISTIC");
  }

  if (normalized.action === "SWAP") {
    if (actual === "APPROVE") return result("PARTIAL", input, consequences, "The transaction grants token approval but does not itself execute the stated swap.", normalized);
    return result("UNKNOWN", input, consequences, "The current decoder cannot deterministically prove that this transaction executes the stated swap.", normalized);
  }

  return result("UNKNOWN", input, consequences, "Intent comparison is unavailable for this action.", normalized);
}

function uniqueSignals(signals: RiskSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.id}:${signal.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyIntentRisk(resultValue: RiskResult, comparison: IntentComparison): RiskResult {
  if (comparison.status !== "MISMATCH") return resultValue;
  const deterministic = comparison.deterministicMismatch;
  const minimum = deterministic ? 78 : 65;
  const deterministicScore = deterministic ? Math.max(resultValue.deterministicScore, minimum) : resultValue.deterministicScore;
  const finalScore = Math.max(resultValue.finalScore, deterministicScore, minimum);
  const intentSignal: RiskSignal = {
    id: deterministic ? "intent-mismatch" : "ai-assisted-intent-mismatch",
    source: deterministic ? "RULE" : "AI",
    severity: deterministic ? "critical" : "advisory",
    title: "Intent mismatch",
    detail: comparison.why
  };
  return {
    ...resultValue,
    score: finalScore,
    finalScore,
    deterministicScore,
    level: riskLevelForScore(finalScore),
    reasons: Array.from(new Set([...resultValue.reasons, comparison.why])),
    criticalSignals: deterministic ? uniqueSignals([...resultValue.criticalSignals, intentSignal]) : resultValue.criticalSignals,
    advisorySignals: deterministic ? resultValue.advisorySignals : uniqueSignals([...resultValue.advisorySignals, intentSignal]),
    recommendation: `The stated intent and decoded transaction do not match. ${resultValue.recommendation}`
  };
}
