import type { ContractIntelligence } from "./chain/intelligence.ts";
import { decodeCalldata, type DecodedAction } from "./calldata.ts";
import type { RiskInput } from "./risk.ts";

export type ConsequenceSeverity = "INFO" | "CAUTION" | "CRITICAL";
export type ConsequenceEvidenceSource = "DECODER" | "VALUE" | "ON_CHAIN";
export type ConsequenceConfidence = "HIGH" | "MEDIUM";

export type TransactionConsequence = {
  id: string;
  severity: ConsequenceSeverity;
  title: string;
  description: string;
  evidenceSource: ConsequenceEvidenceSource;
  confidence: ConsequenceConfidence;
};

type ConsequenceOptions = {
  decodedAction?: DecodedAction;
  intelligence?: ContractIntelligence;
};

function consequence(
  id: string,
  severity: ConsequenceSeverity,
  title: string,
  description: string,
  evidenceSource: ConsequenceEvidenceSource,
  confidence: ConsequenceConfidence = "HIGH"
): TransactionConsequence {
  return { id, severity, title, description, evidenceSource, confidence };
}

function hasNativeValue(value: string) {
  return !/^0(?:\.0+)?$/.test(value.trim());
}

function decodedConsequences(input: RiskInput, decoded: DecodedAction, intelligence?: ContractIntelligence): TransactionConsequence[] {
  if (decoded.status === "malformed") {
    return [consequence(
      "malformed-calldata",
      "CRITICAL",
      "Malformed transaction data",
      "Transaction data is malformed and cannot be safely decoded.",
      "DECODER"
    )];
  }
  if (decoded.status === "unknown") {
    return [consequence(
      "unsupported-selector",
      "CAUTION",
      "Unsupported contract method",
      "XGuard cannot deterministically describe this calldata with the current decoder.",
      "DECODER",
      "MEDIUM"
    )];
  }
  if (decoded.status === "empty") {
    return [hasNativeValue(input.value)
      ? intelligence?.addressType === "EOA"
        ? consequence("native-transfer-eoa", "INFO", "Native OKB transfer to EOA", `You will send ${input.value} OKB to this externally owned account (${input.to}).`, "VALUE")
        : intelligence?.addressType === "SMART_CONTRACT"
          ? consequence("native-transfer-contract", "CAUTION", "Native OKB sent to smart contract", `You will send ${input.value} OKB to a smart contract. Empty calldata may invoke the contract's receive/fallback logic; XGuard does not claim this is equivalent to a simple EOA transfer.`, "VALUE")
          : consequence("native-transfer-unresolved-target", "CAUTION", "Native OKB transfer with unresolved target type", `You will send ${input.value} OKB to ${input.to}. Target type is unavailable; if it is a smart contract, empty calldata may invoke receive/fallback logic.`, "VALUE", "MEDIUM")
      : consequence(
        "empty-call",
        "INFO",
        "No method or native value encoded",
        `No calldata and 0 OKB value are encoded for ${input.to}.`,
        "VALUE"
      )];
  }

  switch (decoded.action) {
    case "ERC20 Transfer":
      return [consequence(
        "erc20-transfer",
        "INFO",
        "ERC20 token transfer",
        `You will request a transfer of ${decoded.amount ?? "an encoded amount of"} raw token units to ${decoded.recipient ?? "the encoded recipient"}. Token identity and decimals are not inferred.`,
        "DECODER"
      )];
    case "Approval-like permission call":
      return [consequence(
        "ambiguous-approval",
        "CAUTION",
        "Approval-like permission call with unresolved standard",
        `This transaction calls approve(address,uint256) for ${decoded.operatorOrSpender ?? "the encoded address"}. Depending on the target token standard, ${decoded.uint256Value ?? "the uint256 value"} may represent an ERC20 allowance or an ERC721 token ID. XGuard cannot safely disambiguate the standard from current evidence.`,
        "DECODER",
        "MEDIUM"
      )];
    case "ERC721 Token Approval":
      return [consequence(
        "erc721-token-approval",
        "CAUTION",
        "ERC721 token approval",
        `You will approve address ${decoded.operatorOrSpender ?? "the encoded address"} to manage NFT token ID ${decoded.tokenId ?? decoded.uint256Value ?? "the encoded token ID"}.`,
        "DECODER"
      )];
    case "ERC20 Approval":
      return [decoded.isUnlimited
        ? consequence(
          "erc20-unlimited-approval",
          "CRITICAL",
          "Effectively unlimited token approval",
          `You will grant spender ${decoded.spender ?? "the encoded spender"} effectively unlimited permission to spend this token.`,
          "DECODER"
        )
        : consequence(
          "erc20-finite-approval",
          "CAUTION",
          "Finite token approval",
          `You will allow spender ${decoded.spender ?? "the encoded spender"} to spend up to ${decoded.amount ?? "the encoded amount of"} raw token units. Token identity and decimals are not inferred.`,
          "DECODER"
        )];
    case "TransferFrom-like asset transfer":
      return [consequence(
        "ambiguous-transfer-from",
        "CAUTION",
        "TransferFrom-like asset transfer with unresolved standard",
        `This transferFrom call from ${decoded.from ?? "the encoded source"} to ${decoded.recipient ?? "the encoded recipient"} may represent ${decoded.uint256Value ?? "the encoded uint256"} fungible-token units or an NFT token ID; the target standard is not confirmed.`,
        "DECODER",
        "MEDIUM"
      )];
    case "ERC721 Token Transfer":
      return [consequence(
        "erc721-token-transfer",
        "CAUTION",
        "ERC721 token transfer",
        `This transaction attempts to transfer NFT token ID ${decoded.tokenId ?? decoded.uint256Value ?? "the encoded token ID"} from ${decoded.from ?? "the encoded source"} to ${decoded.recipient ?? "the encoded recipient"}.`,
        "DECODER"
      )];
    case "Contract-wide operator permission":
      return [decoded.approved
        ? consequence(
          "contract-wide-operator-approval",
          "CRITICAL",
          "Contract-wide NFT / multi-token operator permission",
          `You will grant operator ${decoded.operator ?? "the encoded operator"} permission over all assets managed by this NFT or multi-token contract. XGuard does not infer ERC721, ERC1155, or collection identity without evidence.`,
          "DECODER"
        )
        : consequence(
          "contract-wide-operator-revocation",
          "INFO",
          "Contract-wide operator permission revoked",
          `You will revoke contract-wide asset permission from operator ${decoded.operator ?? "the encoded operator"}.`,
          "DECODER"
        )];
    default:
      return [consequence(
        "decoded-unsupported-action",
        "CAUTION",
        "Unsupported decoded action",
        "XGuard decoded the method but cannot deterministically describe its user consequence.",
        "DECODER",
        "MEDIUM"
      )];
  }
}

function onChainConsequences(intelligence?: ContractIntelligence): TransactionConsequence[] {
  if (!intelligence || intelligence.rpcStatus === "UNAVAILABLE") return [];
  const observations: TransactionConsequence[] = [];
  if (intelligence.addressType === "EOA") {
    observations.push(consequence(
      "target-eoa",
      "INFO",
      "Target observed as EOA",
      "X Layer RPC returned no deployed bytecode for the target address.",
      "ON_CHAIN"
    ));
  } else if (intelligence.addressType === "SMART_CONTRACT") {
    observations.push(consequence(
      "target-contract",
      "INFO",
      "Target observed as smart contract",
      `X Layer RPC returned deployed bytecode${typeof intelligence.codeSizeBytes === "number" ? ` (${intelligence.codeSizeBytes.toLocaleString()} bytes)` : ""}.`,
      "ON_CHAIN"
    ));
  }
  if (intelligence.preflightStatus === "REVERTED") {
    observations.push(consequence(
      "preflight-revert",
      "CAUTION",
      "Preflight call reverted",
      intelligence.revertReason ?? "The bounded eth_call preflight reverted without a decoded reason.",
      "ON_CHAIN"
    ));
  } else if (intelligence.preflightStatus === "SUCCEEDED") {
    observations.push(consequence(
      "preflight-succeeded",
      "INFO",
      "Preflight call succeeded",
      "The bounded eth_call preflight completed successfully; this is not a full state-diff simulation or a safety guarantee.",
      "ON_CHAIN"
    ));
  }
  return observations;
}

export function buildTransactionConsequences(input: RiskInput, options: ConsequenceOptions = {}): TransactionConsequence[] {
  const decoded = options.decodedAction ?? decodeCalldata(input.data);
  const consequences = decodedConsequences(input, decoded, options.intelligence);
  if (decoded.status !== "empty" && hasNativeValue(input.value)) {
    consequences.push(consequence(
      "native-value-with-call",
      "CAUTION",
      "Native OKB sent with contract call",
      `The contract call also sends ${input.value} OKB to ${input.to}.`,
      "VALUE"
    ));
  }
  consequences.push(...onChainConsequences(options.intelligence));
  return consequences;
}

export function observedTransactionSummary(consequences: TransactionConsequence[]) {
  const primary = consequences.find((item) => item.evidenceSource === "DECODER" || item.evidenceSource === "VALUE");
  return primary?.description ?? "No deterministic transaction consequence is available.";
}
