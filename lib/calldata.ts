import { decodeFunctionData, type Address, type Hex } from "viem";

export type DecodedAction = {
  status: "empty" | "decoded" | "unknown" | "malformed";
  method: string;
  action: string;
  spender?: Address;
  recipient?: Address;
  from?: Address;
  amount?: string;
  isUnlimited?: boolean;
  operator?: Address;
  approved?: boolean;
  riskHint?: string;
  assetStandard?: "ERC20" | "ERC721" | "ERC1155" | "UNKNOWN";
  operatorOrSpender?: Address;
  uint256Value?: string;
  tokenId?: string;
};

const approveAbi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }]
}] as const;

const transferAbi = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }]
}] as const;

const transferFromAbi = [{
  type: "function",
  name: "transferFrom",
  stateMutability: "nonpayable",
  inputs: [{ name: "from", type: "address" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }]
}] as const;

const setApprovalForAllAbi = [{
  type: "function",
  name: "setApprovalForAll",
  stateMutability: "nonpayable",
  inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
  outputs: []
}] as const;

const expectedHexLengths: Record<string, number> = {
  "0x095ea7b3": 138,
  "0xa9059cbb": 138,
  "0x23b872dd": 202,
  "0xa22cb465": 138
};

function malformed(method = "Malformed calldata"): DecodedAction {
  return { status: "malformed", method, action: "Malformed contract call", riskHint: "Calldata does not match the expected ABI encoding" };
}

export function decodeCalldata(data: string): DecodedAction {
  if (data === "0x") return { status: "empty", method: "No calldata", action: "Native transfer or empty contract call" };
  if (!/^0x([a-fA-F0-9]{2})+$/.test(data)) return malformed();
  if (data.length < 10) return malformed();

  const normalized = data.toLowerCase() as Hex;
  const selector = normalized.slice(0, 10);
  const expectedLength = expectedHexLengths[selector];
  if (expectedLength && normalized.length !== expectedLength) return malformed(selector);

  try {
    if (selector === "0x095ea7b3") {
      const decoded = decodeFunctionData({ abi: approveAbi, data: normalized });
      const [operatorOrSpender, uint256Value] = decoded.args;
      return {
        status: "decoded",
        method: "approve(address,uint256)",
        action: "Approval-like permission call",
        operatorOrSpender,
        uint256Value: uint256Value.toString(),
        assetStandard: "UNKNOWN",
        riskHint: "The selector is shared by ERC20 allowance approvals and ERC721 token approvals"
      };
    }
    if (selector === "0xa9059cbb") {
      const decoded = decodeFunctionData({ abi: transferAbi, data: normalized });
      const [recipient, amount] = decoded.args;
      return { status: "decoded", method: "transfer(address,uint256)", action: "ERC20 Transfer", recipient, amount: amount.toString(), assetStandard: "ERC20" };
    }
    if (selector === "0x23b872dd") {
      const decoded = decodeFunctionData({ abi: transferFromAbi, data: normalized });
      const [from, recipient, uint256Value] = decoded.args;
      return { status: "decoded", method: "transferFrom(address,address,uint256)", action: "TransferFrom-like asset transfer", from, recipient, uint256Value: uint256Value.toString(), assetStandard: "UNKNOWN", riskHint: "The uint256 may be fungible-token units or an ERC721 token ID" };
    }
    if (selector === "0xa22cb465") {
      const decoded = decodeFunctionData({ abi: setApprovalForAllAbi, data: normalized });
      const [operator, approved] = decoded.args;
      return {
        status: "decoded",
        method: "setApprovalForAll(address,bool)",
        action: "Contract-wide operator permission",
        operator,
        approved,
        assetStandard: "UNKNOWN",
        riskHint: approved ? "NFT or multi-token operator permission for all assets managed by this contract" : "Contract-wide operator permission revocation"
      };
    }
  } catch {
    return malformed(selector);
  }

  return { status: "unknown", method: `Unknown Method (${selector})`, action: "Unknown contract interaction", riskHint: "Method is not recognized by the built-in decoder" };
}

export function resolveDecodedAction(decoded: DecodedAction, standard: "ERC721" | "ERC1155" | "UNKNOWN"): DecodedAction {
  if (decoded.status !== "decoded") return decoded;
  if (decoded.method === "approve(address,uint256)") {
    if (standard === "ERC721") {
      return { ...decoded, action: "ERC721 Token Approval", assetStandard: "ERC721", tokenId: decoded.uint256Value, riskHint: "ERC165 positively identified the target as ERC721" };
    }
    return { ...decoded, action: "Approval-like permission call", assetStandard: "UNKNOWN", spender: undefined, amount: undefined, isUnlimited: undefined, tokenId: undefined };
  }
  if (decoded.method === "transferFrom(address,address,uint256)") {
    if (standard === "ERC721") {
      return { ...decoded, action: "ERC721 Token Transfer", assetStandard: "ERC721", tokenId: decoded.uint256Value, amount: undefined, riskHint: "ERC165 positively identified the target as ERC721" };
    }
    return { ...decoded, action: "TransferFrom-like asset transfer", assetStandard: "UNKNOWN", amount: undefined, tokenId: undefined };
  }
  if (decoded.method === "setApprovalForAll(address,bool)") {
    return { ...decoded, action: "Contract-wide operator permission", assetStandard: standard, riskHint: standard === "ERC721" ? "ERC721 contract-wide operator permission" : standard === "ERC1155" ? "ERC1155 contract-wide operator permission" : decoded.riskHint };
  }
  return decoded;
}
