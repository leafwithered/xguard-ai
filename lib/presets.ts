import type { RiskInput } from "./risk.ts";

const maxUint = "f".repeat(64);
const spender = "1234567890123456789012345678901234567890";
const unlimitedApproval = `0x095ea7b3${"0".repeat(24)}${spender}${maxUint}`;
const operatorApprovalForAll = `0xa22cb465${"0".repeat(24)}${spender}${"0".repeat(63)}1`;

export const judgePresets: Array<{ name: string; description: string; input: RiskInput }> = [
  {
    name: "Safe Transfer",
    description: "Simple 0.1 OKB native transfer",
    input: { from: "", to: "0x1111111111111111111111111111111111111111", value: "0.1", data: "0x", context: "Send 0.1 OKB to a known address" }
  },
  {
    name: "Ambiguous Approval",
    description: "Shared approve(address,uint256) selector with unresolved ERC20/ERC721 semantics",
    input: { from: "", to: "0x2222222222222222222222222222222222222222", value: "0", data: unlimitedApproval, context: "Approve a token router after independently verifying the contract" }
  },
  {
    name: "Suspicious Airdrop",
    description: "Claim intent conflicts with contract-wide operator permission",
    input: { from: "", to: "0x08a25a794639a6cA03b0A7C655B2c36d82fF144a", value: "0", data: operatorApprovalForAll, context: "I only want to claim an airdrop." }
  }
];
