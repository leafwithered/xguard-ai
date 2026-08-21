import { expect } from "chai";
import { readFileSync } from "node:fs";
import type { Address, Hex, PublicClient } from "viem";
import type { AnalysisReceipt } from "../lib/analysis-receipt.ts";
import type { AnalysisAttestation } from "../lib/analysis-attestation.ts";
import { X_LAYER_MAINNET_CHAIN_ID, X_LAYER_MAINNET_EXPLORER, X_LAYER_MAINNET_FALLBACK_RPC, X_LAYER_MAINNET_PRIMARY_RPC, anchorEligibility, configuredAnchorAddress, receiptFingerprintToBytes32, requireNonZeroReceiptDigest, submitReceiptAnchor, verifyReceiptAnchor } from "../lib/anchor.ts";
import type { WalletProvider } from "../types/ethereum.ts";

const knownFingerprint = "sha256:98aa567bd73427cefda86c9fd16e8b998bc95649aab3915a34fb862109e37114";
const knownDigest = "0x98aa567bd73427cefda86c9fd16e8b998bc95649aab3915a34fb862109e37114" as Hex;
const contractAddress = "0x1111111111111111111111111111111111111111" as Address;
const account = "0x2222222222222222222222222222222222222222" as Address;

async function expectRejected(action: Promise<unknown>, message: string) {
  try {
    await action;
    expect.fail("Expected action to reject");
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).to.include(message);
  }
}

function receipt(network: "XLAYER_MAINNET" | "XLAYER_TESTNET" = "XLAYER_MAINNET") {
  return { network: { analysisNetwork: network, chainId: network === "XLAYER_MAINNET" ? 196 : 1952 }, integrity: { fingerprint: knownFingerprint } } as AnalysisReceipt;
}

function attestation(fingerprint = knownFingerprint) {
  return { receiptBinding: { fingerprint } } as AnalysisAttestation;
}

describe("Receipt anchor fingerprint conversion", function () {
  it("parses a valid lowercase SHA-256 fingerprint", function () {
    expect(receiptFingerprintToBytes32(knownFingerprint)).to.equal(knownDigest);
  });

  it("returns the exact underlying SHA-256 digest", function () {
    expect(receiptFingerprintToBytes32(knownFingerprint).slice(2)).to.equal(knownFingerprint.slice(7));
  });

  it("does not apply a second hash", function () {
    expect(receiptFingerprintToBytes32(knownFingerprint)).not.to.equal("0x3341b49d86c4f4b65c0f31da096116ca2fb8a46ad6bef54159822fe8a4f3e638");
  });

  it("rejects a missing sha256 prefix", function () {
    expect(() => receiptFingerprintToBytes32(knownFingerprint.slice(7))).to.throw();
  });

  it("rejects a short digest", function () {
    expect(() => receiptFingerprintToBytes32(`sha256:${"a".repeat(63)}`)).to.throw();
  });

  it("rejects a long digest", function () {
    expect(() => receiptFingerprintToBytes32(`sha256:${"a".repeat(65)}`)).to.throw();
  });

  it("rejects non-hex characters", function () {
    expect(() => receiptFingerprintToBytes32(`sha256:${"g".repeat(64)}`)).to.throw();
  });

  it("rejects uppercase ambiguity", function () {
    expect(() => receiptFingerprintToBytes32(`sha256:${"A".repeat(64)}`)).to.throw();
  });

  it("rejects zero digest for anchoring", function () {
    expect(() => requireNonZeroReceiptDigest(receiptFingerprintToBytes32(`sha256:${"0".repeat(64)}`))).to.throw();
  });

  it("maps the known V5 fingerprint byte-for-byte stably", function () {
    expect(receiptFingerprintToBytes32(knownFingerprint)).to.equal(receiptFingerprintToBytes32(knownFingerprint));
  });
});

describe("Receipt anchor client and eligibility", function () {
  it("exposes canonical X Layer Mainnet configuration", function () {
    expect({ chainId: X_LAYER_MAINNET_CHAIN_ID, primary: X_LAYER_MAINNET_PRIMARY_RPC, fallback: X_LAYER_MAINNET_FALLBACK_RPC, explorer: X_LAYER_MAINNET_EXPLORER }).to.deep.equal({ chainId: 196, primary: "https://rpc.xlayer.tech", fallback: "https://xlayerrpc.okx.com", explorer: "https://www.okx.com/web3/explorer/xlayer" });
  });

  it("uses null rather than a fake unconfigured address", function () {
    expect(configuredAnchorAddress(undefined)).to.equal(null);
    expect(configuredAnchorAddress("0x0000")).to.equal(null);
    expect(configuredAnchorAddress("0x0000000000000000000000000000000000000000")).to.equal(null);
  });

  it("fails closed when the contract is unconfigured", function () {
    expect(anchorEligibility({ contractAddress: null, receipt: receipt(), receiptIntegrity: "INTEGRITY VERIFIED", attestation: attestation(), attestationStatus: "ATTESTATION VERIFIED" }).state).to.equal("UNCONFIGURED");
  });

  it("rejects Testnet receipts for the Mainnet anchor", function () {
    expect(anchorEligibility({ contractAddress, receipt: receipt("XLAYER_TESTNET"), receiptIntegrity: "INTEGRITY VERIFIED", attestation: attestation(), attestationStatus: "ATTESTATION VERIFIED" }).state).to.equal("NOT_ELIGIBLE");
  });

  it("requires explicit receipt integrity verification", function () {
    expect(anchorEligibility({ contractAddress, receipt: receipt(), receiptIntegrity: null, attestation: attestation(), attestationStatus: "ATTESTATION VERIFIED" }).state).to.equal("NOT_ELIGIBLE");
  });

  it("requires verified XGuard attestation", function () {
    expect(anchorEligibility({ contractAddress, receipt: receipt(), receiptIntegrity: "INTEGRITY VERIFIED", attestation: attestation(), attestationStatus: "ATTESTATION CHECK FAILED" }).state).to.equal("NOT_ELIGIBLE");
  });

  it("requires the attestation to bind the same receipt fingerprint", function () {
    expect(anchorEligibility({ contractAddress, receipt: receipt(), receiptIntegrity: "INTEGRITY VERIFIED", attestation: attestation(`sha256:${"f".repeat(64)}`), attestationStatus: "ATTESTATION VERIFIED" }).state).to.equal("NOT_ELIGIBLE");
  });

  it("makes a verified Mainnet receipt ready regardless of policy", function () {
    expect(anchorEligibility({ contractAddress, receipt: receipt(), receiptIntegrity: "INTEGRITY VERIFIED", attestation: attestation(), attestationStatus: "ATTESTATION VERIFIED" })).to.deep.include({ state: "READY", digest: knownDigest });
  });

  it("returns CONFIRMED only when anchored returns true", async function () {
    const client = { readContract: async () => true } as unknown as Pick<PublicClient, "readContract">;
    expect(await verifyReceiptAnchor(contractAddress, knownDigest, client)).to.equal("CONFIRMED");
  });

  it("returns NOT_ANCHORED only when anchored returns false", async function () {
    const client = { readContract: async () => false } as unknown as Pick<PublicClient, "readContract">;
    expect(await verifyReceiptAnchor(contractAddress, knownDigest, client)).to.equal("NOT_ANCHORED");
  });

  it("does not mislabel RPC failure as NOT_ANCHORED", async function () {
    const client = { readContract: async () => { throw new Error("RPC unavailable"); } } as unknown as Pick<PublicClient, "readContract">;
    expect(await verifyReceiptAnchor(contractAddress, knownDigest, client)).to.equal("UNAVAILABLE");
  });

  it("does not call RPC when the contract is unconfigured", async function () {
    let calls = 0;
    const client = { readContract: async () => { calls += 1; return true; } } as unknown as Pick<PublicClient, "readContract">;
    expect(await verifyReceiptAnchor(null, knownDigest, client)).to.equal("UNAVAILABLE");
    expect(calls).to.equal(0);
  });

  it("cannot send without explicit wallet connection", async function () {
    await expectRejected(submitReceiptAnchor({ contractAddress, digest: knownDigest, provider: null, account: "", chainId: 196 }), "Connect wallet explicitly");
  });

  it("cannot send while the wallet is on the wrong chain", async function () {
    const provider = { request: async () => { throw new Error("must not call provider"); } } as unknown as WalletProvider;
    await expectRejected(submitReceiptAnchor({ contractAddress, digest: knownDigest, provider, account, chainId: 1952 }), "Switch wallet explicitly");
  });

  it("cannot submit a zero digest", async function () {
    let calls = 0;
    const provider = { request: async () => { calls += 1; return null; } } as unknown as WalletProvider;
    await expectRejected(submitReceiptAnchor({ contractAddress, digest: `0x${"0".repeat(64)}`, provider, account, chainId: 196 }), "Receipt digest is required");
    expect(calls).to.equal(0);
  });
});

describe("Receipt anchor application safety", function () {
  const pageSource = readFileSync("app/page.tsx", "utf8");

  it("renders the anchor card without a wallet RPC call", function () {
    const card = pageSource.slice(pageSource.indexOf('<section className={`anchor-card'), pageSource.indexOf("{activeResult.criticalSignals"));
    expect(card).not.to.match(/\.request\s*\(|eth_accounts|eth_chainId|eth_requestAccounts/);
  });

  it("Judge Mode anchor navigation is UI-only", function () {
    const handler = pageSource.slice(pageSource.indexOf("function scrollToAnchor"), pageSource.indexOf("async function copyReceiptFingerprint"));
    expect(handler).to.include('document.getElementById("mainnet-receipt-anchor")?.scrollIntoView');
    expect(handler).not.to.match(/wallet|fetch|request\s*\(|writeContract|sendTransaction/i);
  });

  it("read-only verification does not use a wallet provider", function () {
    const source = readFileSync("lib/anchor.ts", "utf8");
    const verifier = source.slice(source.indexOf("export async function verifyReceiptAnchor"), source.indexOf("export async function submitReceiptAnchor"));
    expect(verifier).not.to.match(/createWalletClient|custom\(|writeContract|eth_requestAccounts/);
  });

  it("switching and anchoring require separate explicit buttons", function () {
    expect(pageSource).to.include("onClick={switchToXLayerMainnet}");
    expect(pageSource).to.include("onClick={anchorCurrentReceipt}");
  });

  it("does not automatically sign or broadcast", function () {
    const effects = [...pageSource.matchAll(/use(?:Layout)?Effect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((match) => match[1]).join("\n");
    expect(effects).not.to.match(/anchorCurrentReceipt|submitReceiptAnchor|writeContract|sendTransaction/);
  });

  it("shows NOT CONFIGURED and disables anchoring before deployment", function () {
    expect(pageSource).to.include('anchorContractAddress ?? "NOT CONFIGURED"');
    expect(pageSource).to.include('disabled={!anchorContractAddress || currentAnchorEligibility.state !== "READY"');
  });

  it("requires successful receipt confirmation and anchored readback", function () {
    const source = readFileSync("lib/anchor.ts", "utf8");
    expect(source).to.include('receipt.status !== "success"');
    expect(source).to.include('verifyReceiptAnchor(contractAddress, digest, client) === "CONFIRMED"');
  });

  it("does not include policy in the anchored digest", function () {
    const source = readFileSync("lib/anchor.ts", "utf8");
    expect(source).not.to.match(/policyDecision|policyId|reasonCodes/);
  });
});
