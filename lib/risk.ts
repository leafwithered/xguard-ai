export type RiskInput = {
  from: string;
  to: string;
  value: string;
  data: string;
  context: string;
};

export type RiskResult = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  reasons: string[];
  recommendation: string;
  mode?: "AI" | "LOCAL";
  providerProtocol?: "responses" | "chat";
};

const zeroAddress = "0x0000000000000000000000000000000000000000";
const knownSelectors: Record<string, string> = {
  "0x095ea7b3": "ERC20 approve",
  "0xa9059cbb": "ERC20 transfer",
  "0x23b872dd": "ERC20 transferFrom",
  "0xa22cb465": "NFT setApprovalForAll"
};

export function validateRiskInput(input: RiskInput): string[] {
  const errors: string[] = [];
  const addressPattern = /^0x[a-fA-F0-9]{40}$/;
  if (!input || typeof input !== "object") return ["Request body must be an object"];
  if (typeof input.from !== "string" || (input.from && !addressPattern.test(input.from))) errors.push("From address is invalid");
  if (typeof input.to !== "string" || !addressPattern.test(input.to)) errors.push("Recipient address is invalid");
  const numericValue = typeof input.value === "string" ? Number(input.value.trim()) : Number.NaN;
  if (typeof input.value !== "string" || !input.value.trim() || !Number.isFinite(numericValue) || numericValue < 0) errors.push("Value must be a finite non-negative number");
  if (typeof input.data !== "string" || !/^0x([a-fA-F0-9]{2})*$/.test(input.data)) errors.push("Transaction data must be valid even-length hex beginning with 0x");
  if (typeof input.context !== "string") errors.push("Context must be text");
  return errors;
}

export function localRiskAnalysis(input: RiskInput): RiskResult {
  const text = `${input.to} ${input.value} ${input.data} ${input.context}`.toLowerCase();
  const reasons: string[] = [];
  const selector = input.data.slice(0, 10).toLowerCase();
  let score = 8;
  if (input.to.toLowerCase() === zeroAddress) {
    reasons.push("Transaction targets the zero address");
    score += 62;
  }
  if (selector === "0x095ea7b3" || selector === "0xa22cb465") {
    reasons.push(`${knownSelectors[selector]} may grant asset spending permission`);
    score += 30;
  }
  if (selector === "0x095ea7b3" && input.data.toLowerCase().endsWith("f".repeat(64))) {
    reasons.push("Unlimited ERC20 approval amount detected");
    score += 34;
  }
  if (knownSelectors[selector]) reasons.push(`Detected ${knownSelectors[selector]} method selector`);
  if (input.data !== "0x" && !knownSelectors[selector]) {
    reasons.push("Unknown contract method selector");
    score += 22;
  }
  if (input.data === "0x") reasons.push("No calldata: this appears to be a native token transfer");
  if (Number(input.value) >= 10) {
    reasons.push("Unusually large native token value");
    score += 28;
  } else if (Number(input.value) >= 1) {
    reasons.push("Material native token value");
    score += 12;
  }
  if (text.includes("new contract") || text.includes("unverified") || text.includes("unknown")) {
    reasons.push("User context indicates an unknown or unverified contract");
    score += 18;
  }
  if (text.includes("airdrop") || text.includes("claim") || text.includes("urgent")) {
    reasons.push("Context contains a common social-engineering signal");
    score += 16;
  }
  score = Math.min(100, score);
  const level = score >= 65 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  return {
    score,
    level,
    summary: level === "LOW" ? "No obvious high-risk signals were detected." : level === "MEDIUM" ? "Transaction presents risk signals that require review." : "Transaction presents elevated risk.",
    reasons: reasons.length ? reasons : ["No deterministic risk rule was triggered"],
    recommendation: level === "LOW" ? "Verify the destination and amount before signing." : level === "MEDIUM" ? "Review the contract, permissions and transaction value before signing." : "Do not sign until the contract and requested permissions are independently verified.",
    mode: "LOCAL"
  };
}
