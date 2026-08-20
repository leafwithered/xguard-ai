import { parseUnits } from "viem";
import { decodeCalldata, type DecodedAction } from "./calldata.ts";

export type RiskInput = {
  from: string;
  to: string;
  value: string;
  data: string;
  context: string;
};

export type RiskSignal = {
  id: string;
  source: "RULE" | "DECODER" | "ON-CHAIN" | "AI";
  severity: "critical" | "advisory";
  title: string;
  detail: string;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AdvisoryRiskResult = {
  score: number;
  level: RiskLevel;
  summary: string;
  reasons: string[];
  recommendation: string;
  mode: "AI";
  providerProtocol: "responses" | "chat";
};

export type RiskResult = {
  score: number;
  finalScore: number;
  deterministicScore: number;
  aiScore?: number;
  level: RiskLevel;
  summary: string;
  reasons: string[];
  recommendation: string;
  decodedAction: DecodedAction;
  criticalSignals: RiskSignal[];
  advisorySignals: RiskSignal[];
  aiExplanation?: string;
  mode: "AI" | "LOCAL" | "HYBRID";
  providerProtocol?: "responses" | "chat";
};

const zeroAddress = "0x0000000000000000000000000000000000000000";
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const maxContextLength = 2_000;
const maxCalldataLength = 10_000;
const maxValueWei = parseUnits("1000000", 18);

export function riskLevelForScore(score: number): RiskLevel {
  return score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
}

function safeWei(value: string) {
  try {
    return parseUnits(value.trim(), 18);
  } catch {
    return null;
  }
}

export function validateRiskInput(input: RiskInput): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return ["Request body must be an object"];
  if (typeof input.from !== "string" || (input.from && !addressPattern.test(input.from))) errors.push("From address is invalid");
  if (typeof input.to !== "string" || !addressPattern.test(input.to)) errors.push("Recipient address is invalid");
  if (typeof input.value !== "string" || !decimalPattern.test(input.value.trim())) errors.push("Value must be a finite non-negative decimal with up to 18 decimals");
  else {
    const wei = safeWei(input.value);
    if (wei === null || wei > maxValueWei) errors.push("Value exceeds the supported maximum of 1,000,000 OKB");
  }
  if (typeof input.data !== "string" || input.data.length > maxCalldataLength || !/^0x([a-fA-F0-9]{2})*$/.test(input.data)) errors.push("Transaction data must be valid even-length hex beginning with 0x and under 10,000 characters");
  if (typeof input.context !== "string" || input.context.length > maxContextLength) errors.push("Context must be text under 2,000 characters");
  return errors;
}

function signal(id: string, title: string, detail: string, source: RiskSignal["source"], severity: RiskSignal["severity"] = "critical"): RiskSignal {
  return { id, source, title, detail, severity };
}

function uniqueText(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function localRiskAnalysis(input: RiskInput): RiskResult {
  const text = `${input.to} ${input.value} ${input.data} ${input.context}`.toLowerCase();
  const reasons: string[] = [];
  const criticalSignals: RiskSignal[] = [];
  const advisorySignals: RiskSignal[] = [];
  const decodedAction = decodeCalldata(input.data);
  const valueWei = safeWei(input.value) ?? 0n;
  let score = 8;

  if (input.to.toLowerCase() === zeroAddress) {
    reasons.push("Transaction targets the zero address");
    criticalSignals.push(signal("zero-address", "Zero-address destination", "The recipient is the burn/null address.", "RULE"));
    score += 62;
  }
  if (decodedAction.status === "malformed") {
    reasons.push("Calldata is malformed for the detected contract method");
    criticalSignals.push(signal("malformed-calldata", "Malformed calldata", decodedAction.riskHint ?? "ABI decoding failed.", "DECODER"));
    score += 18;
  }
  if (decodedAction.status === "unknown") {
    reasons.push("Unknown contract method selector");
    advisorySignals.push(signal("unknown-method", "Unknown method", decodedAction.riskHint ?? "The method is not in the built-in decoder.", "DECODER", "advisory"));
    score += 22;
  }
  if (decodedAction.action === "ERC20 Approval") {
    reasons.push("ERC20 approve grants token spending permission");
    criticalSignals.push(signal("erc20-approval", "ERC20 approval", decodedAction.spender ? `Spender: ${decodedAction.spender}` : "A spender address is encoded.", "DECODER"));
    score += 30;
    if (decodedAction.isUnlimited) {
      reasons.push("Unlimited ERC20 approval amount detected");
      criticalSignals.push(signal("unlimited-approval", "Unlimited approval", "The spender can move the full token balance.", "DECODER"));
      score += 34;
    }
  }
  if (decodedAction.action === "NFT Operator Approval") {
    reasons.push(decodedAction.approved ? "NFT operator approval enables control of all assets" : "NFT operator approval is being revoked");
    const operatorSignal = signal("operator-approval", decodedAction.approved ? "NFT operator permission" : "NFT operator revocation", decodedAction.operator ? `Operator: ${decodedAction.operator}` : "An operator address is encoded.", "DECODER", decodedAction.approved ? "critical" : "advisory");
    if (decodedAction.approved) { criticalSignals.push(operatorSignal); score += 35; }
    else advisorySignals.push(operatorSignal);
  }
  if (decodedAction.action === "ERC20 Transfer" || decodedAction.action === "ERC20 Transfer From") {
    advisorySignals.push(signal("token-transfer", "Token transfer", decodedAction.amount ? `Token amount: ${decodedAction.amount}` : "An ERC20 transfer amount is encoded.", "DECODER", "advisory"));
  }
  if (input.data === "0x") {
    reasons.push("No calldata: this appears to be a native token transfer");
    advisorySignals.push(signal("empty-calldata", "Native transfer", "No contract method calldata was supplied.", "DECODER", "advisory"));
  }
  if (valueWei >= parseUnits("10", 18)) {
    reasons.push("Unusually large native token value");
    criticalSignals.push(signal("large-value", "Large native value", `Value: ${input.value} OKB`, "RULE"));
    score += 28;
  } else if (valueWei >= parseUnits("1", 18)) {
    reasons.push("Material native token value");
    advisorySignals.push(signal("material-value", "Material native value", `Value: ${input.value} OKB`, "RULE", "advisory"));
    score += 12;
  }
  if (text.includes("new contract") || text.includes("unverified") || text.includes("unknown")) {
    reasons.push("User context indicates an unknown or unverified contract");
    advisorySignals.push(signal("unknown-contract", "Unknown contract context", "The context describes an unknown or unverified contract.", "RULE", "advisory"));
    score += 18;
  }
  if (text.includes("airdrop") || text.includes("claim") || text.includes("urgent")) {
    reasons.push("Context contains a common social-engineering signal");
    advisorySignals.push(signal("social-engineering", "Social-engineering signal", "Urgency or airdrop/claim language can pressure users.", "RULE", "advisory"));
    score += 16;
  }

  score = Math.min(100, score);
  const level = riskLevelForScore(score);
  const uniqueReasons = uniqueText(reasons.length ? reasons : ["No deterministic risk rule was triggered"]);
  return {
    score,
    finalScore: score,
    deterministicScore: score,
    level,
    summary: level === "LOW" ? "No obvious high-risk signals were detected." : level === "MEDIUM" ? "Transaction presents risk signals that require review." : "Transaction presents elevated risk.",
    reasons: uniqueReasons,
    recommendation: level === "LOW" ? "Verify the destination and amount before signing." : level === "MEDIUM" ? "Review the contract, permissions and transaction value before signing." : "Do not sign until the contract and requested permissions are independently verified.",
    decodedAction,
    criticalSignals,
    advisorySignals,
    mode: "LOCAL"
  };
}
