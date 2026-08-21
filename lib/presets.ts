import type { RiskInput } from "./risk.ts";

const maxUint = "f".repeat(64);
const spender = "1234567890123456789012345678901234567890";
const unlimitedApproval = `0x095ea7b3${"0".repeat(24)}${spender}${maxUint}`;

export const judgePresets: Array<{ name: string; description: string; input: RiskInput }> = [
  {
    name: "Safe Transfer",
    description: "Simple 0.1 OKB native transfer",
    input: { from: "", to: "0x1111111111111111111111111111111111111111", value: "0.1", data: "0x", context: "Send 0.1 OKB to a known address" }
  },
  {
    name: "Unlimited Approval",
    description: "ERC20 spender receives unlimited permission",
    input: { from: "", to: "0x2222222222222222222222222222222222222222", value: "0", data: unlimitedApproval, context: "Approve a token router after independently verifying the contract" }
  },
  {
    name: "Suspicious Airdrop",
    description: "Claim intent hides an unlimited token approval",
    input: { from: "", to: "0x0000000000000000000000000000000000000000", value: "12", data: unlimitedApproval, context: "I only want to claim an airdrop." }
  }
];
