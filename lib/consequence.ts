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

function decodedConsequences(input: RiskInput, decoded: DecodedAction): TransactionConsequence[] {
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
      ? consequence(
        "native-transfer",
        "INFO",
        "Native OKB transfer",
        `You will send ${input.value} OKB to ${input.to}.`,
        "VALUE"
      )
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
    case "ERC20 Transfer From":
      return [consequence(
        "erc20-transfer-from",
        "CAUTION",
        "Allowance-based token transfer",
        `This transaction attempts to transfer ${decoded.amount ?? "an encoded amount of"} raw token units from ${decoded.from ?? "the encoded source"} to ${decoded.recipient ?? "the encoded recipient"} using an existing allowance.`,
        "DECODER"
      )];
    case "NFT Operator Approval":
      return [decoded.approved
        ? consequence(
          "nft-operator-approval",
          "CRITICAL",
          "Collection-wide NFT operator approval",
          `You will grant operator ${decoded.operator ?? "the encoded operator"} permission to transfer all NFTs from this collection on your behalf.`,
          "DECODER"
        )
        : consequence(
          "nft-operator-revocation",
          "INFO",
          "NFT operator permission revoked",
          `You will revoke collection-wide transfer permission from operator ${decoded.operator ?? "the encoded operator"}.`,
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
  const consequences = decodedConsequences(input, decoded);
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
