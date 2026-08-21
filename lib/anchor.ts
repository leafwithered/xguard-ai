import { createPublicClient, createWalletClient, custom, fallback, http, isAddress, type Address, type EIP1193Provider, type Hash, type Hex, type PublicClient } from "viem";
import type { AnalysisReceipt } from "./analysis-receipt.ts";
import type { AnalysisAttestation, AttestationVerificationStatus } from "./analysis-attestation.ts";
import { xGuardReceiptAnchorAbi, xLayerMainnet } from "./xlayer.ts";

export const X_LAYER_MAINNET_CHAIN_ID = 196 as const;
export const X_LAYER_MAINNET_PRIMARY_RPC = "https://rpc.xlayer.tech" as const;
export const X_LAYER_MAINNET_FALLBACK_RPC = "https://xlayerrpc.okx.com" as const;
export const X_LAYER_MAINNET_EXPLORER = "https://www.okx.com/web3/explorer/xlayer" as const;
export const XGUARD_MAINNET_ANCHOR_ADDRESS = "0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5" as Address;
export const XGUARD_MAINNET_ANCHOR_DEPLOYMENT_TRANSACTION = "0x435ffbb932a66462bd846851535b594dbc3fad6b13f64d3ba9f17023a8fd73cb" as Hash;
export const XGUARD_MAINNET_FIRST_ANCHOR_TRANSACTION = "0xd2c244178a313c1367ce60ed679661cce4740fd27e62e7722b8eadd995b54347" as Hash;
export const XGUARD_MAINNET_FIRST_ANCHORED_DIGEST = "0xef6cf319eb689233180f465d331969c91a9c5c07d893047294bdda5de0da0eab" as Hex;

export const anchorStates = ["UNCONFIGURED", "NOT_ELIGIBLE", "READY", "CHECKING", "NOT_ANCHORED", "WALLET_NOT_CONNECTED", "WRONG_NETWORK", "AWAITING_SIGNATURE", "SUBMITTED", "CONFIRMING", "CONFIRMED", "FAILED"] as const;
export type AnchorState = typeof anchorStates[number];
export type AnchorVerificationState = "CONFIRMED" | "NOT_ANCHORED" | "UNAVAILABLE";

const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const zeroDigest = `0x${"0".repeat(64)}` as Hex;
const zeroAddress = "0x0000000000000000000000000000000000000000";

export function receiptFingerprintToBytes32(fingerprint: string): Hex {
  if (!fingerprintPattern.test(fingerprint)) throw new Error("Invalid XGuard SHA-256 receipt fingerprint");
  return `0x${fingerprint.slice(7)}` as Hex;
}

export function requireNonZeroReceiptDigest(digest: Hex): Hex {
  if (digest === zeroDigest) throw new Error("Receipt digest is required");
  return digest;
}

export function configuredAnchorAddress(value: unknown): Address | null {
  return typeof value === "string" && isAddress(value) && value.toLowerCase() !== zeroAddress ? value : null;
}

export function knownAnchorTransactionForDigest(digest: Hex): Hash | null {
  return digest.toLowerCase() === XGUARD_MAINNET_FIRST_ANCHORED_DIGEST ? XGUARD_MAINNET_FIRST_ANCHOR_TRANSACTION : null;
}

export function createAnchorPublicClient() {
  return createPublicClient({
    chain: xLayerMainnet,
    transport: fallback([http(X_LAYER_MAINNET_PRIMARY_RPC), http(X_LAYER_MAINNET_FALLBACK_RPC)])
  });
}

export type AnchorEligibilityInput = {
  contractAddress: Address | null;
  receipt: AnalysisReceipt | null;
  receiptIntegrity: string | null;
  attestation: AnalysisAttestation | null;
  attestationStatus: AttestationVerificationStatus | null;
};

export function anchorEligibility(input: AnchorEligibilityInput): { state: "UNCONFIGURED" | "NOT_ELIGIBLE" | "READY"; digest: Hex | null; reason: string } {
  if (!input.contractAddress) return { state: "UNCONFIGURED", digest: null, reason: "Anchor contract is not configured." };
  if (!input.receipt || input.receipt.network.analysisNetwork !== "XLAYER_MAINNET" || input.receipt.network.chainId !== 196) return { state: "NOT_ELIGIBLE", digest: null, reason: "A current X Layer Mainnet receipt is required." };
  if (input.receiptIntegrity !== "INTEGRITY VERIFIED") return { state: "NOT_ELIGIBLE", digest: null, reason: "Receipt Integrity must be verified explicitly." };
  if (!input.attestation || input.attestationStatus !== "ATTESTATION VERIFIED") return { state: "NOT_ELIGIBLE", digest: null, reason: "XGuard Attestation must be verified." };
  if (input.attestation.receiptBinding.fingerprint !== input.receipt.integrity.fingerprint) return { state: "NOT_ELIGIBLE", digest: null, reason: "Attestation receipt binding does not match." };
  try {
    return { state: "READY", digest: requireNonZeroReceiptDigest(receiptFingerprintToBytes32(input.receipt.integrity.fingerprint)), reason: "Receipt is eligible for explicit Mainnet anchoring." };
  } catch {
    return { state: "NOT_ELIGIBLE", digest: null, reason: "Receipt fingerprint is invalid." };
  }
}

export async function verifyReceiptAnchor(contractAddress: Address | null, digest: Hex, client: Pick<PublicClient, "readContract"> = createAnchorPublicClient()): Promise<AnchorVerificationState> {
  if (!contractAddress) return "UNAVAILABLE";
  try {
    const anchored = await client.readContract({ address: contractAddress, abi: xGuardReceiptAnchorAbi, functionName: "anchored", args: [requireNonZeroReceiptDigest(digest)] });
    return anchored === true ? "CONFIRMED" : "NOT_ANCHORED";
  } catch {
    return "UNAVAILABLE";
  }
}

export async function submitReceiptAnchor(input: { contractAddress: Address | null; digest: Hex; provider: EIP1193Provider | null; account: Address | ""; chainId: number | null }): Promise<Hash> {
  if (!input.contractAddress) throw new Error("Anchor contract is not configured");
  if (!input.provider || !input.account) throw new Error("Connect wallet explicitly before anchoring");
  if (input.chainId !== X_LAYER_MAINNET_CHAIN_ID) throw new Error("Switch wallet explicitly to X Layer Mainnet before anchoring");
  const walletClient = createWalletClient({ account: input.account, chain: xLayerMainnet, transport: custom(input.provider) });
  return walletClient.writeContract({ address: input.contractAddress, abi: xGuardReceiptAnchorAbi, functionName: "anchor", args: [requireNonZeroReceiptDigest(input.digest)], account: input.account });
}

export async function confirmReceiptAnchor(contractAddress: Address, digest: Hex, hash: Hash, client = createAnchorPublicClient()) {
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
  if (receipt.status !== "success") return false;
  return await verifyReceiptAnchor(contractAddress, digest, client) === "CONFIRMED";
}
