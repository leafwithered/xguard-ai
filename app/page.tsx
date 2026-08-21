"use client";

import { useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, keccak256, toHex, type Address } from "viem";
import { riskRegistryAbi, xLayerTestnet } from "../lib/xlayer";
import type { RiskInput, RiskResult } from "../lib/risk";
import type { ContractIntelligence } from "../lib/chain/intelligence";
import type { TransactionConsequence } from "../lib/consequence";
import type { IntentComparison } from "../lib/intent";
import type { AnalysisConfidence, AnalysisVerdict, ExecutionStatus } from "../lib/evidence";
import { getAnalysisNetworkConfig, type AnalysisNetwork } from "../lib/network";
import type { SimulationEvidence } from "../lib/okx/simulation";
import type { XLayerTransaction } from "../lib/chain/transaction-analyzer";
import { judgePresets as presets, publicMainnetSimulationFixture } from "../lib/presets";
import { currentAnalysisResult, invalidateStaleAnalysis } from "../lib/analysis-state";
import { initialRecordState, isRecordPending, reduceRecordState } from "../lib/transaction-state";
import { buildRiskScorePresentation, isLiveOkxProviderEvidence } from "../lib/presentation";
import { ANALYSIS_RECEIPT_INTEGRITY_NOTICE, ANALYSIS_RECEIPT_MAX_FILE_BYTES, isAnalysisReceipt, verifyAnalysisReceipt, type AnalysisReceipt, type AnalysisReceiptVerificationStatus } from "../lib/analysis-receipt";
import { ANALYSIS_ATTESTATION_AUTHENTICITY_NOTICE, ATTESTED_ANALYSIS_MAX_FILE_BYTES, createAttestedAnalysisPackage, isAnalysisAttestation, isTrustedAttestationKey, verifyAttestedAnalysisPackage, type AnalysisAttestation, type AttestationKeyResponse, type AttestationVerificationStatus, type AttestedPackageVerification, type TrustedKeyResolution } from "../lib/analysis-attestation";
import { addDiscoveredWallet, preferredWalletProvider, requestWalletConnection, switchConnectedWalletToXLayer, switchConnectedWalletToXLayerMainnet, type DiscoveredWallet } from "../lib/wallet-lifecycle";
import { initialJudgeModeState, reduceJudgeMode } from "../lib/judge-mode";
import { isPolicyDecision, type PolicyDecision, type PolicyDecisionState } from "../lib/policy-engine";
import { X_LAYER_MAINNET_EXPLORER, X_LAYER_MAINNET_FALLBACK_RPC, X_LAYER_MAINNET_PRIMARY_RPC, anchorEligibility, configuredAnchorAddress, confirmReceiptAnchor, receiptFingerprintToBytes32, submitReceiptAnchor, verifyReceiptAnchor, type AnchorState } from "../lib/anchor";
import type { WalletProvider } from "../types/ethereum";

const registryAddress = process.env.NEXT_PUBLIC_RISK_REGISTRY_ADDRESS as Address | undefined;
const anchorContractAddress = configuredAnchorAddress(process.env.NEXT_PUBLIC_XGUARD_MAINNET_ANCHOR_ADDRESS);
const explorerBase = "https://www.okx.com/web3/explorer/xlayer-test";
const demoUrl = "https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4";
const contractUrl = `${explorerBase}/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`;
const verifiedTxUrl = `${explorerBase}/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`;
const verifiedTxHash = "0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb";
type AnalysisResult = RiskResult & {
  analysisConfidence: AnalysisConfidence;
  analysisVerdict: AnalysisVerdict;
  executionStatus: ExecutionStatus;
  confidenceReasons: string[];
  contractIntelligence: ContractIntelligence;
  consequences: TransactionConsequence[];
  intentComparison: IntentComparison;
  analysisTimings: { rpcMs: number; simulationMs: number; aiMs: number; totalMs: number };
  simulationEvidence: SimulationEvidence;
  evidenceConsistency: { status: "CONSISTENT" | "INCONSISTENT" | "NOT_COMPARABLE"; reasons: string[] };
  analysisReceipt: AnalysisReceipt;
  analysisAttestation: AnalysisAttestation | null;
  attestationAvailability: "AVAILABLE" | "UNAVAILABLE" | "INVALID_CONFIG";
  policyDecision: PolicyDecision;
};

const shortAddress = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
const signalSources = new Set(["RULE", "DECODER", "ON-CHAIN", "OKX", "AI"]);
const consequenceSources = new Set(["DECODER", "VALUE", "ON_CHAIN", "SIMULATION"]);
const intentStatuses = new Set(["MATCH", "PARTIAL", "MISMATCH", "UNKNOWN"]);
const analysisConfidences = new Set(["HIGH", "MEDIUM", "LOW"]);
const analysisVerdicts = new Set(["ASSESSED", "UNDETERMINED"]);
const executionStatuses = new Set(["SUCCEEDED", "REVERTED", "UNAVAILABLE"]);
const simulationStatuses = new Set(["AVAILABLE", "UNAVAILABLE", "UNSUPPORTED", "ERROR"]);
const consistencyStatuses = new Set(["CONSISTENT", "INCONSISTENT", "NOT_COMPARABLE"]);

function formatSimulationAmount(asset: SimulationEvidence["assetChanges"][number]) {
  if ((asset.assetType !== "NATIVE" && asset.assetType !== "ERC20") || !Number.isInteger(asset.decimals) || asset.decimals === null || asset.decimals < 0 || asset.decimals > 36) return null;
  try { return formatUnits(BigInt(asset.rawValue), asset.decimals); } catch { return null; }
}

async function resolveDeploymentAttestationKey(keyId: string): Promise<TrustedKeyResolution> {
  try {
    const response = await fetch("/api/attestation-key", { method: "GET", headers: { Accept: "application/json" } });
    if (!response.ok) return { status: "UNAVAILABLE" };
    const payload = await response.json() as AttestationKeyResponse;
    if (!payload || payload.status !== "AVAILABLE") return { status: "UNAVAILABLE" };
    const key = {
      keyId: payload.keyId,
      algorithm: payload.algorithm,
      publicKeySpkiBase64: payload.publicKeySpkiBase64,
      publicKeyFingerprint: payload.publicKeyFingerprint
    };
    if (!isTrustedAttestationKey(key)) return { status: "UNAVAILABLE" };
    return key.keyId === keyId ? { status: "AVAILABLE", key } : { status: "UNKNOWN_KEY_ID" };
  } catch {
    return { status: "UNAVAILABLE" };
  }
}

function isCurrentAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalysisResult>;
  const validSignals = (signals: unknown) => Array.isArray(signals) && signals.every((item) => item && typeof item === "object" && signalSources.has(String((item as { source?: unknown }).source)));
  const validConsequences = Array.isArray(candidate.consequences) && candidate.consequences.every((item) => item && typeof item === "object" && consequenceSources.has(String((item as { evidenceSource?: unknown }).evidenceSource)));
  const validIntent = Boolean(candidate.intentComparison && intentStatuses.has(String(candidate.intentComparison.status)));
  const validTimings = Boolean(candidate.analysisTimings && [candidate.analysisTimings.rpcMs, candidate.analysisTimings.simulationMs, candidate.analysisTimings.aiMs, candidate.analysisTimings.totalMs].every((duration) => typeof duration === "number" && Number.isFinite(duration) && duration >= 0));
  const validSimulation = Boolean(candidate.simulationEvidence
    && simulationStatuses.has(String(candidate.simulationEvidence.status))
    && Array.isArray(candidate.simulationEvidence.assetChanges)
    && Array.isArray(candidate.simulationEvidence.risks));
  const validConsistency = Boolean(candidate.evidenceConsistency
    && consistencyStatuses.has(String(candidate.evidenceConsistency.status))
    && Array.isArray(candidate.evidenceConsistency.reasons)
    && candidate.evidenceConsistency.reasons.every((reason) => typeof reason === "string"));
  return typeof candidate.finalScore === "number"
    && typeof candidate.deterministicScore === "number"
    && analysisConfidences.has(String(candidate.analysisConfidence))
    && analysisVerdicts.has(String(candidate.analysisVerdict))
    && executionStatuses.has(String(candidate.executionStatus))
    && Array.isArray(candidate.confidenceReasons)
    && candidate.confidenceReasons.every((reason) => typeof reason === "string")
    && validSignals(candidate.criticalSignals)
    && validSignals(candidate.advisorySignals)
    && Boolean(candidate.contractIntelligence)
    && validConsequences
    && validIntent
    && validTimings
    && validSimulation
    && validConsistency
    && isAnalysisReceipt(candidate.analysisReceipt)
    && isPolicyDecision(candidate.policyDecision)
    && (candidate.analysisAttestation === null || candidate.analysisAttestation === undefined || isAnalysisAttestation(candidate.analysisAttestation));
}

export default function Home() {
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | "">("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [context, setContext] = useState("");
  const [analysisNetwork, setAnalysisNetwork] = useState<AnalysisNetwork>("XLAYER_TESTNET");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastInput, setLastInput] = useState<RiskInput | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [recordState, dispatchRecord] = useReducer(reduceRecordState, initialRecordState);
  const [message, setMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionResult, setTransactionResult] = useState<XLayerTransaction | null>(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState("");
  const [judgeMode, dispatchJudgeMode] = useReducer(reduceJudgeMode, initialJudgeModeState);
  const [receiptVerification, setReceiptVerification] = useState<AnalysisReceiptVerificationStatus | null>(null);
  const [receiptDownloadUrl, setReceiptDownloadUrl] = useState<string | null>(null);
  const [attestedPackageVerification, setAttestedPackageVerification] = useState<AttestedPackageVerification | null>(null);
  const [currentAttestationStatus, setCurrentAttestationStatus] = useState<AttestationVerificationStatus | null>(null);
  const [attestedPackageDownloadUrl, setAttestedPackageDownloadUrl] = useState<string | null>(null);
  const [anchorState, setAnchorState] = useState<AnchorState>(anchorContractAddress ? "NOT_ELIGIBLE" : "UNCONFIGURED");
  const [anchorHash, setAnchorHash] = useState<`0x${string}` | null>(null);
  const [anchorError, setAnchorError] = useState("");
  const walletNetworkName = chainId === null ? "Wallet not connected" : chainId === 1952 ? "Wallet on X Layer Testnet" : chainId === 196 ? "Wallet on X Layer Mainnet" : `Wallet network · ${chainId}`;
  const analysisNetworkConfig = getAnalysisNetworkConfig(analysisNetwork);
  const networkName = analysisNetworkConfig.name;
  const isCorrectNetwork = chainId === 1952;
  const recordPending = isRecordPending(recordState);
  const currentTransactionInput: RiskInput = { from, to, value, data, context, analysisNetwork };
  const activeResult = currentAnalysisResult({ result, lastInput, reviewed }, currentTransactionInput);
  const analysisHash = useMemo(() => lastInput && activeResult ? keccak256(toHex(JSON.stringify({ input: lastInput, result: activeResult }))) : null, [lastInput, activeResult]);
  const currentReceiptDigest = useMemo(() => {
    if (!activeResult?.analysisReceipt) return null;
    try { return receiptFingerprintToBytes32(activeResult.analysisReceipt.integrity.fingerprint); } catch { return null; }
  }, [activeResult?.analysisReceipt]);
  const currentAnchorEligibility = useMemo(() => anchorEligibility({
    contractAddress: anchorContractAddress,
    receipt: activeResult?.analysisReceipt ?? null,
    receiptIntegrity: receiptVerification,
    attestation: activeResult?.analysisAttestation ?? null,
    attestationStatus: currentAttestationStatus
  }), [activeResult?.analysisReceipt, activeResult?.analysisAttestation, receiptVerification, currentAttestationStatus]);

  useEffect(() => {
    if (!activeResult?.analysisReceipt) {
      setReceiptDownloadUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(activeResult.analysisReceipt, null, 2)}\n`], { type: "application/json" }));
    setReceiptDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeResult?.analysisReceipt]);

  useEffect(() => {
    if (!activeResult?.analysisAttestation) {
      setAttestedPackageDownloadUrl(null);
      setAttestedPackageVerification(null);
      setCurrentAttestationStatus(null);
      return;
    }
    const attestedPackage = createAttestedAnalysisPackage(activeResult.analysisReceipt, activeResult.analysisAttestation);
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(attestedPackage, null, 2)}\n`], { type: "application/json" }));
    setAttestedPackageDownloadUrl(url);
    let cancelled = false;
    void verifyAttestedAnalysisPackage(attestedPackage, resolveDeploymentAttestationKey).then((verification) => {
      if (!cancelled) {
        setCurrentAttestationStatus(verification.attestation);
        setAttestedPackageVerification(verification);
      }
    });
    return () => { cancelled = true; URL.revokeObjectURL(url); };
  }, [activeResult?.analysisReceipt, activeResult?.analysisAttestation]);

  useEffect(() => {
    window.localStorage.removeItem("xguard-last-result");
    const saved = window.sessionStorage.getItem("xguard-session-result");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { input: RiskInput; result: AnalysisResult };
      if (!isCurrentAnalysisResult(parsed.result)) throw new Error("Stored result uses an older schema");
      setLastInput(parsed.input);
      setResult(parsed.result);
      setFrom(parsed.input.from);
      setTo(parsed.input.to);
      setValue(parsed.input.value);
      setData(parsed.input.data);
      setContext(parsed.input.context);
      setAnalysisNetwork(parsed.input.analysisNetwork ?? "XLAYER_TESTNET");
    } catch {
      window.sessionStorage.removeItem("xguard-session-result");
    }
  }, []);

  useLayoutEffect(() => {
    const currentInput: RiskInput = { from, to, value, data, context, analysisNetwork };
    const freshness = invalidateStaleAnalysis({ result, lastInput, reviewed }, currentInput);
    if (!freshness.invalidated) return;
    setResult(freshness.snapshot.result);
    setLastInput(freshness.snapshot.lastInput);
    setReviewed(freshness.snapshot.reviewed);
    setReceiptVerification(null);
    setAttestedPackageVerification(null);
    setCurrentAttestationStatus(null);
    setAnchorState(anchorContractAddress ? "NOT_ELIGIBLE" : "UNCONFIGURED");
    setAnchorHash(null);
    setAnchorError("");
    dispatchRecord({ type: "RESET" });
    window.sessionStorage.removeItem("xguard-session-result");
    setMessage(freshness.notice);
  }, [from, to, value, data, context, analysisNetwork, result, lastInput, reviewed]);

  useEffect(() => {
    const discovered = new Map<string, DiscoveredWallet>();
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<DiscoveredWallet>).detail;
      if (!detail?.info?.uuid || !detail.provider) return;
      setWallets(addDiscoveredWallet(discovered, detail));
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, []);

  useEffect(() => {
    if (!walletProvider) return;
    const accountsChanged = (accounts: unknown) => {
      const next = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] as Address : "";
      setAddress(next);
      setFrom(next);
      if (!next) setMessage("Wallet disconnected.");
    };
    const chainChanged = (chain: unknown) => setChainId(typeof chain === "string" ? Number.parseInt(chain, 16) : null);
    const disconnected = () => { setAddress(""); setFrom(""); setChainId(null); setMessage("Wallet disconnected."); };
    walletProvider.on?.("accountsChanged", accountsChanged);
    walletProvider.on?.("chainChanged", chainChanged);
    walletProvider.on?.("disconnect", disconnected);
    return () => {
      walletProvider.removeListener?.("accountsChanged", accountsChanged);
      walletProvider.removeListener?.("chainChanged", chainChanged);
      walletProvider.removeListener?.("disconnect", disconnected);
    };
  }, [walletProvider]);

  function openJudgeMode() {
    dispatchJudgeMode({ type: "OPEN" });
  }

  useEffect(() => {
    if (!judgeMode.open || judgeMode.revealRequest === 0) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("judge-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [judgeMode.open, judgeMode.revealRequest]);

  function applyConnectedWalletState(state: { address: Address | ""; chainId: number | null }) {
    setAddress(state.address);
    setFrom(state.address);
    setChainId(state.chainId);
  }

  async function connectWallet() {
    setMessage("");
    const provider = preferredWalletProvider(wallets, selectedWalletId, window.ethereum);
    if (!provider) { setMessage("Install or open an EVM wallet such as OKX Wallet first."); return; }
    try {
      const walletState = await requestWalletConnection(provider);
      setWalletProvider(provider);
      applyConnectedWalletState(walletState);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled or failed.");
    }
  }

  async function switchToXLayer() {
    setMessage("");
    if (!walletProvider) { setMessage("Connect an EVM wallet before switching networks."); return; }
    try {
      applyConnectedWalletState(await switchConnectedWalletToXLayer(walletProvider, xLayerTestnet.rpcUrls.default.http[0], explorerBase));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Network switch was cancelled or failed."); }
  }

  async function switchToXLayerMainnet() {
    setAnchorError("");
    if (!walletProvider) { setAnchorState("WALLET_NOT_CONNECTED"); return; }
    try {
      applyConnectedWalletState(await switchConnectedWalletToXLayerMainnet(walletProvider, X_LAYER_MAINNET_PRIMARY_RPC, X_LAYER_MAINNET_FALLBACK_RPC, X_LAYER_MAINNET_EXPLORER));
      setAnchorState(currentAnchorEligibility.state);
    } catch (error) {
      setAnchorState("FAILED");
      setAnchorError(error instanceof Error ? error.message : "Mainnet network switch was cancelled or failed.");
    }
  }

  function applyPreset(input: RiskInput) {
    setFrom(address || input.from);
    setTo(input.to);
    setValue(input.value);
    setData(input.data);
    setContext(input.context);
    setAnalysisNetwork(input.analysisNetwork ?? "XLAYER_TESTNET");
  }

  function clearAnalysis(clearFields = true) {
    setResult(null);
    setLastInput(null);
    setReviewed(false);
    setMessage("");
    setReceiptVerification(null);
    setAttestedPackageVerification(null);
    setCurrentAttestationStatus(null);
    setAnchorState(anchorContractAddress ? "NOT_ELIGIBLE" : "UNCONFIGURED");
    setAnchorHash(null);
    setAnchorError("");
    dispatchRecord({ type: "RESET" });
    window.sessionStorage.removeItem("xguard-session-result");
    if (clearFields) { setTo(""); setValue("0"); setData("0x"); setContext(""); }
  }

  async function analyze() {
    setMessage(""); setReceiptVerification(null); setAttestedPackageVerification(null); setCurrentAttestationStatus(null); setAnchorState(anchorContractAddress ? "NOT_ELIGIBLE" : "UNCONFIGURED"); setAnchorHash(null); setAnchorError(""); setReviewed(false); dispatchRecord({ type: "RESET" });
    const input: RiskInput = { from, to, value, data, context, analysisNetwork };
    if (!isAddress(to)) { setMessage("Enter a valid recipient contract address."); return; }
    setAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const payload = await response.json() as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Risk analysis failed");
      setResult(payload);
      setLastInput(input);
      window.sessionStorage.setItem("xguard-session-result", JSON.stringify({ input, result: payload }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Risk analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function recordOnchain() {
    if (!registryAddress || !analysisHash || !walletProvider || !address || !activeResult || analysisNetwork !== "XLAYER_TESTNET" || !isCorrectNetwork || !reviewed || recordPending) return;
    setMessage("");
    dispatchRecord({ type: "SIGNATURE_REQUESTED" });
    try {
      const walletClient = createWalletClient({ account: address, chain: xLayerTestnet, transport: custom(walletProvider) });
      const hash = await walletClient.writeContract({ address: registryAddress, abi: riskRegistryAbi, functionName: "recordAssessment", args: [analysisHash, activeResult.finalScore], account: address });
      dispatchRecord({ type: "SUBMITTED", hash });
      dispatchRecord({ type: "CONFIRMING" });
      const publicClient = createPublicClient({ chain: xLayerTestnet, transport: http(xLayerTestnet.rpcUrls.default.http[0]) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
      dispatchRecord({ type: receipt.status === "success" ? "CONFIRMED" : "REVERTED" });
    } catch (error) {
      dispatchRecord({ type: "FAILED", error: error instanceof Error ? error.message : "Wallet transaction failed" });
    }
  }

  async function loadXLayerTransaction(hash = transactionHash) {
    setTransactionError("");
    setTransactionResult(null);
    setTransactionHash(hash);
    setTransactionLoading(true);
    try {
      const response = await fetch("/api/transaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }) });
      const payload = await response.json() as XLayerTransaction & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Transaction lookup failed");
      setTransactionResult(payload);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "Transaction lookup failed");
    } finally {
      setTransactionLoading(false);
    }
  }

  function loadTransactionIntoAnalyzer() {
    if (!transactionResult?.analysisInput) return;
    applyPreset(transactionResult.analysisInput);
    document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function loadJudgePreset(index: number) {
    applyPreset(presets[index].input);
    document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openVerifiedEvidence() {
    void loadXLayerTransaction(verifiedTxHash);
    document.querySelector(".tx-analyzer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToReceipt() {
    document.querySelector(".analysis-receipt-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function scrollToAttestation() {
    document.querySelector(".analysis-attestation-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function scrollToPolicy() {
    window.requestAnimationFrame(() => {
      document.getElementById("policy-guard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function scrollToAnchor() {
    window.requestAnimationFrame(() => {
      document.getElementById("mainnet-receipt-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function copyReceiptFingerprint() {
    if (!activeResult?.analysisReceipt) return;
    try {
      await navigator.clipboard.writeText(activeResult.analysisReceipt.integrity.fingerprint);
      setMessage("Receipt fingerprint copied.");
    } catch {
      setMessage("Clipboard access was unavailable. Select the fingerprint manually.");
    }
  }

  async function verifyCurrentReceipt() {
    if (!activeResult?.analysisReceipt) return;
    setReceiptVerification((await verifyAnalysisReceipt(activeResult.analysisReceipt)).status);
  }

  async function verifyReceiptFile(file: File | undefined) {
    if (!file) return;
    if (file.size > ANALYSIS_RECEIPT_MAX_FILE_BYTES) {
      setReceiptVerification("INVALID RECEIPT FORMAT");
      return;
    }
    try {
      setReceiptVerification((await verifyAnalysisReceipt(JSON.parse(await file.text()))).status);
    } catch {
      setReceiptVerification("INVALID RECEIPT FORMAT");
    }
  }

  async function verifyCurrentAttestedPackage() {
    if (!activeResult?.analysisAttestation) return;
    const attestedPackage = createAttestedAnalysisPackage(activeResult.analysisReceipt, activeResult.analysisAttestation);
    const verification = await verifyAttestedAnalysisPackage(attestedPackage, resolveDeploymentAttestationKey);
    setCurrentAttestationStatus(verification.attestation);
    setAttestedPackageVerification(verification);
  }

  async function checkReceiptAnchor() {
    if (!anchorContractAddress || !currentReceiptDigest) { setAnchorState("UNCONFIGURED"); return; }
    setAnchorState("CHECKING");
    setAnchorError("");
    const verification = await verifyReceiptAnchor(anchorContractAddress, currentReceiptDigest);
    if (verification === "CONFIRMED") setAnchorState("CONFIRMED");
    else if (verification === "NOT_ANCHORED") setAnchorState("NOT_ANCHORED");
    else { setAnchorState("FAILED"); setAnchorError("Anchor verification is unavailable. This is not a NOT ANCHORED result."); }
  }

  async function anchorCurrentReceipt() {
    if (currentAnchorEligibility.state !== "READY" || !currentAnchorEligibility.digest || !anchorContractAddress) { setAnchorState(currentAnchorEligibility.state); return; }
    if (!walletProvider || !address) { setAnchorState("WALLET_NOT_CONNECTED"); return; }
    if (chainId !== 196) { setAnchorState("WRONG_NETWORK"); return; }
    setAnchorError("");
    setAnchorState("AWAITING_SIGNATURE");
    try {
      const hash = await submitReceiptAnchor({ contractAddress: anchorContractAddress, digest: currentAnchorEligibility.digest, provider: walletProvider, account: address, chainId });
      setAnchorHash(hash);
      setAnchorState("SUBMITTED");
      setAnchorState("CONFIRMING");
      setAnchorState(await confirmReceiptAnchor(anchorContractAddress, currentAnchorEligibility.digest, hash) ? "CONFIRMED" : "FAILED");
    } catch (error) {
      setAnchorState("FAILED");
      setAnchorError(error instanceof Error ? error.message : "Anchor transaction failed.");
    }
  }

  async function verifyAttestedPackageFile(file: File | undefined) {
    if (!file) return;
    if (file.size > ATTESTED_ANALYSIS_MAX_FILE_BYTES) {
      setAttestedPackageVerification(await verifyAttestedAnalysisPackage(null, resolveDeploymentAttestationKey));
      return;
    }
    try {
      setAttestedPackageVerification(await verifyAttestedAnalysisPackage(JSON.parse(await file.text()), resolveDeploymentAttestationKey));
    } catch {
      setAttestedPackageVerification(await verifyAttestedAnalysisPackage(null, resolveDeploymentAttestationKey));
    }
  }

  const modeLabel = activeResult?.mode === "HYBRID" ? "Hybrid Analysis" : activeResult?.mode === "AI" ? "AI Analysis" : "Local Safety Engine";
  const recordLabel = recordState.phase === "awaiting-signature" ? "Awaiting wallet signature" : recordState.phase === "submitted" ? "Submitted" : recordState.phase === "confirming" ? "Confirming on X Layer" : recordState.phase === "confirmed" ? "Confirmed on X Layer" : recordState.phase === "reverted" ? "Transaction reverted" : recordState.phase === "error" ? "Confirmation error" : "Ready after review";
  const decoded = activeResult?.decodedAction;
  const intelligence = activeResult?.contractIntelligence;
  const simulation = activeResult?.simulationEvidence;
  const scorePresentation = activeResult ? buildRiskScorePresentation(activeResult) : null;
  const liveOkxEvidence = isLiveOkxProviderEvidence(simulation);
  const attestationStatus = activeResult?.analysisAttestation ? (currentAttestationStatus ?? "AVAILABLE") : "ATTESTATION UNAVAILABLE";
  const anchorStatus = ["CHECKING", "WALLET_NOT_CONNECTED", "WRONG_NETWORK", "AWAITING_SIGNATURE", "SUBMITTED", "CONFIRMING", "CONFIRMED", "FAILED", "NOT_ANCHORED"].includes(anchorState) ? anchorState : currentAnchorEligibility.state;
  const policyAction: Record<PolicyDecisionState, string> = {
    ALLOW: "Continue to the normal explicit confirmation path.",
    WARN: "Show a visible warning before explicit user confirmation.",
    REQUIRE_REVIEW: "Pause automatic progression and require human review.",
    BLOCK_RECOMMENDED: "Recommend blocking progression unless a documented higher-level override policy applies."
  };

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">X</span><span>XGuard AI</span></div>
      <nav className="quick-links"><a href="https://github.com/leafwithered/xguard-ai" target="_blank" rel="noreferrer">GitHub</a><a href={contractUrl} target="_blank" rel="noreferrer">Contract</a><a href={verifiedTxUrl} target="_blank" rel="noreferrer">Verified Tx</a><a href={demoUrl} target="_blank" rel="noreferrer">Demo</a></nav>
      <div className="network-pill live"><span className="live-dot" />Analysis: {networkName} · Chain {analysisNetworkConfig.chainId}</div>
    </header>
    <section className="hero">
      <div><div className="eyebrow">Evidence-grounded pre-sign intelligence</div><h1>Know what a transaction does before you sign.</h1><p className="lead">XGuard combines deterministic decoding, X Layer RPC facts, optional OKX Mainnet simulation, Intent vs Reality, and evidence-grounded AI—without treating any provider as a safety oracle.</p><div className="hero-actions"><button className="primary" onClick={() => document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth" })}>Analyze Transaction</button><button className="judge-button" aria-expanded={judgeMode.open} aria-controls="judge-demo" onClick={openJudgeMode}>⚡ Try Judge Demo</button></div></div>
      <div className="hero-card"><h2>What happens if I sign this?</h2><div className="signal"><span>Analysis Network</span><strong>{networkName}</strong></div><div className="signal"><span>Wallet</span><strong>{walletNetworkName}</strong></div><div className="signal"><span>Analysis</span><strong>{modeLabel}</strong></div><div className="signal"><span>Safety floor</span><strong>Deterministic</strong></div><div className="signal"><span>Signing</span><strong>Always user-confirmed</strong></div></div>
    </section>
    <section className="capability-strip"><span>Deterministic Decoder</span><span>X Layer RPC</span><span>OKX Simulation Evidence</span><span>Intent vs Reality</span><span>Verifiable Receipts</span><span>Signed Attestations</span><span>Policy Guard</span><span>Mainnet Receipt Anchor</span></section>
    {judgeMode.open && <section className="judge-mode" id="judge-demo">
      <div className="panel-heading"><div><span className="eyebrow">Judge Path</span><h2>See why XGuard is more than an AI wrapper.</h2><p>Each action is explicit. Nothing connects, signs, records, or broadcasts automatically.</p></div><button className="text-button" onClick={() => dispatchJudgeMode({ type: "CLOSE" })}>Close</button></div>
      <div className="judge-steps">
        <article><b>01</b><span>Safe Transfer</span><strong>Expected: LOW</strong><p>Baseline deterministic analysis plus optional AI enrichment.</p><button className="secondary" onClick={() => loadJudgePreset(0)}>Load</button></article>
        <article><b>02</b><span>Ambiguous Approval</span><strong>Expected: UNDETERMINED</strong><p>The shared approve() selector stays ambiguous unless token-standard evidence resolves it.</p><button className="secondary" onClick={() => loadJudgePreset(1)}>Load</button></article>
        <article><b>03</b><span>Suspicious Airdrop</span><strong>Expected: HIGH + MISMATCH</strong><p>Claim intent contradicts contract-wide operator permission; deterministic evidence is not weakened by AI.</p><button className="secondary" onClick={() => loadJudgePreset(2)}>Load</button></article>
        <article><b>04</b><span>Live OKX Mainnet Simulation</span><strong>Expected: PROVIDER EVIDENCE</strong><p>Loads a public historical approval fixture. Analysis remains explicit and read-only.</p><button className="secondary" onClick={() => { applyPreset(publicMainnetSimulationFixture.input); document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Load</button></article>
        <article><b>05</b><span>Analysis Receipt</span><strong>Versioned + exportable</strong><p>Inspect the current analysis ID, provenance and SHA-256 fingerprint.</p><button className="secondary" onClick={scrollToReceipt} disabled={!activeResult}>View</button></article>
        <article><b>06</b><span>Verify Receipt</span><strong>Local integrity check</strong><p>Verify the current receipt or import JSON without provider or AI calls.</p><button className="secondary" onClick={scrollToReceipt} disabled={!activeResult}>Verify</button></article>
        <article><b>07</b><span>Signed Analysis Attestation</span><strong>Deployment-key authenticity</strong><p>Verify that the current receipt fingerprint was signed by this deployment&apos;s Ed25519 key.</p><button className="secondary" onClick={scrollToAttestation} disabled={!activeResult?.analysisAttestation}>Verify</button></article>
        <article><b>08</b><span>Existing X Layer Receipt</span><strong>On-chain: Confirmed</strong><p>Real user-signed RiskRegistry evidence on Chain 1952.</p><button className="secondary" onClick={openVerifiedEvidence}>View</button></article>
        <article><b>09</b><span>Policy Guard</span><strong>Deterministic integration action</strong><p>Safe → ALLOW · Ambiguous → REQUIRE REVIEW · Suspicious → BLOCK RECOMMENDED.</p><button className="secondary" onClick={scrollToPolicy} disabled={!activeResult?.policyDecision}>View</button></article>
        <article><b>10</b><span>X Layer Mainnet Anchor</span><strong>On-chain receipt evidence</strong><p>{anchorContractAddress ? "Verify or explicitly anchor the current verified Mainnet receipt." : "Deployment pending · contract not configured."}</p><button className="secondary" onClick={scrollToAnchor} disabled={!activeResult}>View</button></article>
      </div>
      <div className="judge-checklist"><span>✓ Human-readable calldata</span><span>✓ Deterministic safety floor</span><span>✓ AI enrichment</span><span>✓ X Layer intelligence</span><span>✓ Receipt integrity</span><span>✓ Deployment-key authenticity</span><span>✓ User-controlled wallet signing</span></div>
    </section>}
    <section className="workspace">
      <div className="panel transaction-panel">
        <div className="panel-heading"><div><h2>1. Prepare transaction</h2><p>Start with a preset or inspect a transaction manually.</p></div><button className="text-button" onClick={() => clearAnalysis()}>Clear analysis</button></div>
        <div className="presets">{presets.map((preset) => <button key={preset.name} onClick={() => applyPreset(preset.input)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div>
        <label htmlFor="analysis-network">Analysis network</label><select id="analysis-network" value={analysisNetwork} onChange={(event) => setAnalysisNetwork(event.target.value as AnalysisNetwork)}><option value="XLAYER_TESTNET">X Layer Testnet · Chain 1952 · RPC preflight</option><option value="XLAYER_MAINNET">X Layer Mainnet · Chain 196 · RPC + OKX simulation</option></select>
        <div className="field-note">Testnet never uses the Mainnet simulator. Mainnet simulation is read-only evidence and requires a sender address.</div>
        <label htmlFor="from">From address</label><input id="from" placeholder="0x..." value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="to">Recipient contract</label><input id="to" placeholder="0x..." value={to} onChange={(event) => setTo(event.target.value)} />
        <div className="row"><div><label htmlFor="value">Value (OKB)</label><input id="value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} /></div><div><label htmlFor="data">Calldata</label><input id="data" value={data} onChange={(event) => setData(event.target.value)} /></div></div>
        <label htmlFor="context">What do you expect this transaction to do? (optional)</label><textarea id="context" maxLength={2000} placeholder="Example: I only want to claim an airdrop." value={context} onChange={(event) => setContext(event.target.value)} /><div className="field-note">Used for Intent vs Reality. Your words never replace decoded transaction facts.</div>
        {wallets.length > 1 && <div className="wallet-options"><span>Detected wallets</span>{wallets.map((wallet) => <button key={wallet.info.uuid} className={selectedWalletId === wallet.info.uuid ? "selected" : ""} onClick={() => setSelectedWalletId(wallet.info.uuid)}>{wallet.info.name}</button>)}</div>}
        <div className="actions"><button className="primary" onClick={analyze} disabled={analyzing || recordPending}>{analyzing ? "Analyzing RPC, simulation and AI…" : "Analyze risk"}</button><button className="secondary" onClick={connectWallet}>{address ? shortAddress(address) : "Connect wallet"}</button>{analysisNetwork === "XLAYER_TESTNET" && !isCorrectNetwork && <button className="secondary" onClick={switchToXLayer}>Switch wallet to X Layer Testnet</button>}</div>
        <div className="footer-note">AI is advisory. XGuard AI never signs or broadcasts automatically.</div>
      </div>
      <div className="panel result-panel" aria-busy={analyzing}>
        <h2>2. Review risk</h2>
        {activeResult ? <>
          <div className="score-wrap"><div className={`score score-${activeResult.level.toLowerCase()} ${activeResult.analysisVerdict === "UNDETERMINED" ? "score-undetermined" : ""}`}>{scorePresentation?.final.score}</div><div className="score-copy"><span>{scorePresentation?.final.label}</span><strong>{scorePresentation?.final.level} RISK</strong><small>Final = max(deterministic known risk, AI advisory)</small></div></div>
          <section className="score-breakdown" aria-label="Risk score components">
            <div><span>{scorePresentation?.deterministic.label}</span><strong>{scorePresentation?.deterministic.score} · {scorePresentation?.deterministic.level}</strong></div>
            <div><span>{scorePresentation?.ai.label}</span><strong>{scorePresentation?.ai.score === null ? "Unavailable" : `${scorePresentation?.ai.score} · ${scorePresentation?.ai.level}`}</strong></div>
          </section>
          <div className="analysis-mode">{modeLabel}</div>
          <section className={`assessment-dimensions verdict-${activeResult.analysisVerdict.toLowerCase()}`}>
            <div><span>Analysis Confidence</span><strong>{activeResult.analysisConfidence}</strong></div>
            <div><span>Verdict</span><strong>{activeResult.analysisVerdict}</strong></div>
            <div><span>Execution Status</span><strong>{activeResult.executionStatus}</strong></div>
          </section>
          <ul className="confidence-reasons">{activeResult.confidenceReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <section className={`policy-card policy-${activeResult.policyDecision.decision.toLowerCase().replace("_", "-")}`} id="policy-guard">
            <div className="card-title"><div><span className="eyebrow">Pre-sign policy</span><h3>Wallet / dApp Guard</h3></div><span className="policy-badge">{activeResult.policyDecision.decision.replaceAll("_", " ")}</span></div>
            <div className="policy-grid"><span>Policy Decision</span><strong>{activeResult.policyDecision.decision.replaceAll("_", " ")}</strong><span>Policy Version</span><strong>{activeResult.policyDecision.policyVersion}</strong><span>Deterministic Basis</span><strong>Known risk {activeResult.policyDecision.inputs.deterministicScore} · {activeResult.policyDecision.inputs.analysisConfidence} confidence · {activeResult.policyDecision.inputs.analysisVerdict}</strong><span>Integration Action</span><strong>{policyAction[activeResult.policyDecision.decision]}</strong></div>
            <div className="policy-reasons" aria-label="Policy reason codes">{activeResult.policyDecision.reasonCodes.map((code) => <code key={code}>{code}</code>)}</div>
            <p>Policy actions are deterministic integration recommendations. They are not guarantees of transaction safety.</p><p>AI Advisory does not control this policy decision.</p>
          </section>
          <section className="fusion-card">
            <div className="card-title"><div><span className="eyebrow">Transparent decision logic</span><h3>Risk Fusion</h3></div><span className="formula">max(floor, AI)</span></div>
            <div className="fusion-grid"><div><span>Deterministic Floor</span><strong>{activeResult.deterministicScore}</strong></div><div><span>AI Assessment</span><strong>{typeof activeResult.aiScore === "number" ? activeResult.aiScore : "Unavailable"}</strong></div><div><span>Final Risk</span><strong>{activeResult.finalScore}</strong></div></div>
            <p>Final Risk = max(Deterministic Floor, AI Assessment). {typeof activeResult.aiScore !== "number" || activeResult.aiScore <= activeResult.deterministicScore ? "Deterministic floor preserved." : "AI raised the advisory risk."}</p>
          </section>
          <section className="consequence-card">
            <div className="card-title"><div><span className="eyebrow">Deterministic consequences</span><h3>What happens if I sign this?</h3></div></div>
            <ul className="consequence-list">{activeResult.consequences.map((item) => <li key={item.id} className={`consequence-${item.severity.toLowerCase()}`}><div><b>{item.evidenceSource.replace("_", "-")}</b><span>{item.confidence}</span></div><strong>{item.title}</strong><p>{item.description}</p></li>)}</ul>
          </section>
          {activeResult.intentComparison.userIntent && <section className={`intent-card intent-${activeResult.intentComparison.status.toLowerCase()}`}>
            <div className="card-title"><div><span className="eyebrow">Pre-sign reasoning</span><h3>Intent vs Reality</h3></div><span className="intent-status">{activeResult.intentComparison.status}</span></div>
            <div className="intent-grid"><span>Your Intent</span><strong>{activeResult.intentComparison.userIntent}</strong><span>Observed Transaction</span><strong>{activeResult.intentComparison.observedTransaction}</strong><span>Why</span><strong>{activeResult.intentComparison.why}</strong><span>Normalization</span><strong>{activeResult.intentComparison.normalizationSource.replace("_", " ")} · {activeResult.intentComparison.confidence}</strong></div>
          </section>}
          {decoded && <section className="decoded-card"><h3>{decoded.action}</h3><div className="decoded-grid"><span>Method</span><strong>{decoded.method}</strong>{decoded.assetStandard && <><span>Standard</span><strong>{decoded.assetStandard === "UNKNOWN" ? "UNDETERMINED" : decoded.assetStandard}</strong></>}{decoded.operatorOrSpender && <><span>Operator / Spender</span><strong>{decoded.operatorOrSpender}</strong></>}{decoded.spender && <><span>Spender</span><strong>{decoded.spender}</strong></>}{decoded.recipient && <><span>Recipient</span><strong>{decoded.recipient}</strong></>}{decoded.from && <><span>From</span><strong>{decoded.from}</strong></>}{decoded.operator && <><span>Operator</span><strong>{decoded.operator}</strong></>}{decoded.tokenId && <><span>Token ID</span><strong>{decoded.tokenId}</strong></>}{decoded.uint256Value && !decoded.tokenId && <><span>uint256 Value</span><strong>{decoded.uint256Value}</strong></>}{decoded.amount && <><span>Amount</span><strong>{decoded.isUnlimited ? "Unlimited" : decoded.amount}</strong></>}{typeof decoded.approved === "boolean" && <><span>Approved</span><strong>{decoded.approved ? "Yes" : "No"}</strong></>}</div>{decoded.riskHint && <p>{decoded.riskHint}</p>}</section>}
          <section className="intelligence-card">
            <div className="card-title"><div><span className="eyebrow">X Layer RPC</span><h3>On-chain Intelligence</h3></div><span className={`rpc-status rpc-${intelligence?.rpcStatus.toLowerCase() ?? "unavailable"}`}>{intelligence?.rpcStatus ?? "UNAVAILABLE"}</span></div>
            <div className="decoded-grid">
              <span>Network</span><strong>{intelligence ? `${getAnalysisNetworkConfig(intelligence.network).name} · Chain ${intelligence.chainId}` : networkName}</strong>
              <span>Target</span><strong>{intelligence?.address ?? to}</strong>
              <span>Address Type</span><strong>{intelligence?.addressType === "SMART_CONTRACT" ? "Smart Contract" : intelligence?.addressType === "EOA" ? "EOA" : "Unavailable"}</strong>
              <span>Code</span><strong>{intelligence?.codePresent === true ? `Present · ${intelligence.codeSizeBytes?.toLocaleString() ?? "?"} bytes` : intelligence?.codePresent === false ? "Not present" : "Unavailable"}</strong>
              <span>EIP-1967 Proxy</span><strong>{intelligence?.proxyDetected === true ? "Implementation detected" : intelligence?.proxyDetected === false ? "Not detected" : "Unavailable"}</strong>
              {intelligence?.implementationAddress && <><span>Implementation</span><strong>{intelligence.implementationAddress}</strong></>}
              <span>Token Standard</span><strong>{intelligence?.tokenStandard === "UNKNOWN" ? "Unresolved" : intelligence?.tokenStandard ?? "Unresolved"}</strong>
              <span>Standard Evidence</span><strong>{intelligence?.tokenStandardSource === "ERC165" ? "ON-CHAIN / ERC165" : "Unavailable"}</strong>
              <span>Preflight</span><strong>{activeResult.executionStatus === "SUCCEEDED" ? "Call succeeded" : activeResult.executionStatus === "REVERTED" ? "Current-state call reverted" : "Unavailable"}</strong>
              {intelligence?.revertReason && <><span>Revert Reason</span><strong>{intelligence.revertReason}</strong></>}
              <span>Estimated Gas</span><strong>{intelligence?.estimatedGas ? BigInt(intelligence.estimatedGas).toLocaleString() : "Unavailable"}</strong>
            </div>
            <p>Preflight uses <code>eth_call</code> and <code>eth_estimateGas</code>. It is not a full state-diff simulation.</p>
          </section>
          {simulation && <section className="simulation-card">
            <div className="card-title"><div><span className="eyebrow">OKX ONCHAINOS</span><h3>Transaction Simulation Evidence</h3></div><div className="simulation-badges">{liveOkxEvidence && <span className="live-provider-badge"><span className="live-dot" />LIVE PROVIDER EVIDENCE</span>}<span className={`simulation-status simulation-${simulation.status.toLowerCase()}`}>{simulation.status}</span></div></div>
            <div className="decoded-grid">
              <span>Provider</span><strong>OKX OnchainOS</strong>
              <span>Network</span><strong>{getAnalysisNetworkConfig(simulation.network).name} · Chain {simulation.chainId}</strong>
              <span>Chain Index</span><strong>{simulation.chainIndex ?? "Not applicable"}</strong>
              <span>Observed At</span><strong>{simulation.observedAt}</strong>
              <span>Provider Latency</span><strong>{simulation.durationMs} ms</strong>
              <span>Intention</span><strong>{simulation.intention ?? "Not returned"}</strong>
              <span>Gas Used</span><strong>{simulation.gasUsed ?? "Not returned"}</strong>
              <span>Fail Reason</span><strong>{simulation.failReason ?? "Not returned"}</strong>
            </div>
            {simulation.statusDetail && <p className="simulation-detail">{simulation.statusDetail}</p>}
            {simulation.status === "AVAILABLE" && <>
              <div className="simulation-subsection"><strong>Asset Changes</strong>
                {simulation.assetChanges.length > 0 ? <ul className="simulation-list">{simulation.assetChanges.map((asset, index) => {
                  const formatted = formatSimulationAmount(asset);
                  return <li key={`${asset.address ?? "unknown"}-${index}`}><div><span>{asset.assetType ?? "Asset"}</span><strong>{asset.address || "Address not returned"}</strong></div><p>{asset.name || "Unnamed asset"}{asset.symbol ? ` (${asset.symbol})` : ""}</p><code>rawValue: {asset.rawValue}</code>{formatted !== null && <small>Formatted: {formatted}</small>}</li>;
                })}</ul> : <p>No asset changes were returned by the simulation provider.</p>}
              </div>
              <div className="simulation-subsection"><strong>Risk Evidence</strong>
                {simulation.risks.length > 0 ? <ul className="simulation-list">{simulation.risks.map((risk, index) => <li key={`${risk.address ?? "unknown"}-${index}`}><p>{risk.addressType ?? "Unlabeled risk entry"}</p><code>{risk.address ?? "Address not returned"}</code></li>)}</ul> : <p>No OKX simulation risk entries were returned. This is not proof of safety.</p>}
              </div>
            </>}
            {activeResult.evidenceConsistency.status === "INCONSISTENT" && <div className="evidence-inconsistency"><strong>Evidence inconsistency — manual review required</strong><ul>{activeResult.evidenceConsistency.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
            <p><strong>Provider evidence is not a safety verdict.</strong> Simulation is additional read-only evidence. It does not certify the transaction as safe and cannot lower XGuard&apos;s deterministic risk floor.</p>
          </section>}
          <section className="timing-card">
            <div className="card-title"><div><span className="eyebrow">Observed request latency</span><h3>Analysis Timings</h3></div></div>
            <div className="timing-grid"><div><span>RPC</span><strong>{activeResult.analysisTimings.rpcMs} ms</strong></div><div><span>Simulation</span><strong>{activeResult.analysisTimings.simulationMs} ms</strong></div><div><span>AI</span><strong>{activeResult.analysisTimings.aiMs} ms</strong></div><div><span>Total</span><strong>{activeResult.analysisTimings.totalMs} ms</strong></div></div>
          </section>
          <section className="provenance-card">
            <div className="card-title"><div><span className="eyebrow">Separated evidence classes</span><h3>Evidence Provenance</h3></div></div>
            <div className="provenance-list">{activeResult.analysisReceipt.provenance.sources.map((source) => <div key={source.type}><span>{source.type.replaceAll("_", " ")}</span><strong>{source.provider}</strong><small>{source.status}{source.type === "OKX_ONCHAINOS" && liveOkxEvidence ? " · LIVE PROVIDER EVIDENCE" : ""}</small><time>{source.observedAt}</time></div>)}</div>
            <p>Provenance identifies the evidence source and availability. Provider evidence is not a safety verdict.</p>
          </section>
          <section className="analysis-receipt-card" id="analysis-receipt">
            <div className="card-title"><div><span className="eyebrow">Machine-consumable evidence</span><h3>Analysis Receipt</h3></div><span className="receipt-ready">Fingerprint available</span></div>
            <div className="receipt-grid"><span>Analysis ID</span><strong>{activeResult.analysisReceipt.analysisId}</strong><span>Schema</span><strong>{activeResult.analysisReceipt.schemaVersion}</strong><span>Engine</span><strong>{activeResult.analysisReceipt.engine.xguardVersion}</strong><span>Observed At</span><strong>{activeResult.analysisReceipt.observedAt}</strong><span>Network</span><strong>{getAnalysisNetworkConfig(activeResult.analysisReceipt.network.analysisNetwork).name} · Chain {activeResult.analysisReceipt.network.chainId}</strong><span>Fingerprint</span><code>{activeResult.analysisReceipt.integrity.fingerprint}</code></div>
            <div className="receipt-actions"><a className="secondary link-button" href={receiptDownloadUrl ?? undefined} download={`xguard-analysis-${activeResult.analysisReceipt.analysisId}.json`} aria-disabled={!receiptDownloadUrl}>Export JSON</a><button className="secondary" onClick={copyReceiptFingerprint}>Copy Fingerprint</button><button className="secondary" onClick={verifyCurrentReceipt}>Verify Current</button><label className="secondary file-button">Verify Receipt File<input type="file" accept="application/json,.json" onChange={(event) => { void verifyReceiptFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>
            {receiptVerification && <div className={`verification-result ${receiptVerification === "INTEGRITY VERIFIED" ? "verification-pass" : "verification-fail"}`} role="status">{receiptVerification}</div>}
            <p>{ANALYSIS_RECEIPT_INTEGRITY_NOTICE}</p><small>Local imports are limited to {ANALYSIS_RECEIPT_MAX_FILE_BYTES / 1024} KiB. Verification makes no network, AI, OKX, signing or broadcast request.</small>
          </section>
          <section className="analysis-attestation-card" id="analysis-attestation">
            <div className="card-title"><div><span className="eyebrow">Deployment-key authenticity</span><h3>Signed Analysis Attestation</h3></div><span className={`attestation-badge ${attestationStatus === "ATTESTATION VERIFIED" ? "attestation-verified" : ""}`}>{attestationStatus}</span></div>
            {activeResult.analysisAttestation ? <div className="receipt-grid"><span>Algorithm</span><strong>{activeResult.analysisAttestation.algorithm}</strong><span>Key ID</span><strong>{activeResult.analysisAttestation.keyId}</strong><span>Public Key Fingerprint</span><code>{activeResult.analysisAttestation.publicKeyFingerprint}</code><span>Signed Receipt Fingerprint</span><code>{activeResult.analysisAttestation.receiptBinding.fingerprint}</code><span>Signed At</span><strong>{activeResult.analysisAttestation.signedAt}</strong></div> : <p>Attestation signing is unavailable for this deployment. The analysis and V5 receipt remain valid and available.</p>}
            <div className="receipt-actions"><a className="secondary link-button" href={attestedPackageDownloadUrl ?? undefined} download={activeResult.analysisAttestation ? `xguard-attested-analysis-${activeResult.analysisReceipt.analysisId}.json` : undefined} aria-disabled={!attestedPackageDownloadUrl}>Export Attested Package</a><button className="secondary" onClick={verifyCurrentAttestedPackage} disabled={!activeResult.analysisAttestation}>Verify Current Package</button><label className="secondary file-button">Verify Attested Package<input type="file" accept="application/json,.json" onChange={(event) => { void verifyAttestedPackageFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label></div>
            {attestedPackageVerification && <div className="attestation-results" role="status"><div className={attestedPackageVerification.receiptIntegrity === "INTEGRITY VERIFIED" ? "verification-pass" : "verification-fail"}><span>RECEIPT INTEGRITY</span><strong>{attestedPackageVerification.receiptIntegrity}</strong></div><div className={attestedPackageVerification.attestation === "ATTESTATION VERIFIED" ? "verification-pass" : "verification-fail"}><span>XGUARD ATTESTATION</span><strong>{attestedPackageVerification.attestation}</strong></div></div>}
            <p>{ANALYSIS_ATTESTATION_AUTHENTICITY_NOTICE}</p><small>Packages are limited to {ATTESTED_ANALYSIS_MAX_FILE_BYTES / 1024} KiB. Verification resolves only this deployment&apos;s trusted public key and never trusts an uploaded key.</small>
          </section>
          <section className={`anchor-card anchor-${anchorStatus.toLowerCase().replaceAll("_", "-")}`} id="mainnet-receipt-anchor">
            <div className="card-title"><div><span className="eyebrow">X Layer Mainnet Anchor</span><h3>Receipt Anchor</h3></div><span className="anchor-badge">{anchorStatus.replaceAll("_", " ")}</span></div>
            <div className="anchor-grid"><span>Network</span><strong>X Layer Mainnet · Chain 196</strong><span>Receipt Fingerprint</span><code>{activeResult.analysisReceipt.integrity.fingerprint}</code><span>On-chain bytes32 digest</span><code>{currentReceiptDigest ?? "INVALID RECEIPT DIGEST"}</code><span>Anchor Contract</span><strong>{anchorContractAddress ?? "NOT CONFIGURED"}</strong><span>Current Policy</span><strong>{activeResult.policyDecision.decision.replaceAll("_", " ")}</strong><span>Wallet / Network</span><strong>{walletNetworkName}</strong><span>Eligibility</span><strong>{currentAnchorEligibility.reason}</strong></div>
            <div className="receipt-actions"><button className="secondary" onClick={checkReceiptAnchor} disabled={!anchorContractAddress || !currentReceiptDigest || anchorState === "CHECKING"}>Verify On-chain Anchor</button><button className="secondary" onClick={connectWallet}>{address ? shortAddress(address) : "Connect Wallet"}</button><button className="secondary" onClick={switchToXLayerMainnet} disabled={!walletProvider || chainId === 196}>Switch wallet to X Layer Mainnet</button><button className="primary" onClick={anchorCurrentReceipt} disabled={!anchorContractAddress || currentAnchorEligibility.state !== "READY" || !walletProvider || !address || chainId !== 196 || ["AWAITING_SIGNATURE", "SUBMITTED", "CONFIRMING", "CONFIRMED"].includes(anchorState)}>{anchorState === "AWAITING_SIGNATURE" ? "Check wallet…" : anchorState === "CONFIRMING" ? "Confirming…" : anchorState === "CONFIRMED" ? "Confirmed" : "Anchor Receipt"}</button></div>
            {anchorHash && <div className="anchor-transaction">Anchor Transaction: <a href={`${X_LAYER_MAINNET_EXPLORER}/tx/${anchorHash}`} target="_blank" rel="noreferrer">{anchorHash}</a></div>}
            {anchorError && <div className="status-message" role="status">{anchorError}</div>}
            <p>X Layer anchoring proves that this exact Analysis Receipt digest was included in a confirmed transaction to the configured XGuard anchor contract. It does not prove that the analyzed transaction is safe. Receipt integrity and XGuard authorship are verified separately.</p><small>The anchor commits the V5 receipt digest only. It does not cryptographically incorporate or replace the V7 policy object.</small>
          </section>
          {activeResult.criticalSignals.length > 0 && <section className="signal-section"><h3>Critical Signals</h3><ul className="risk-list critical">{activeResult.criticalSignals.map((item) => <li key={item.id}><div><b className={`source-badge source-${item.source.toLowerCase()}`}>{item.source}</b><strong>{item.title}</strong></div><span>{item.detail}</span></li>)}</ul></section>}
          {activeResult.advisorySignals.length > 0 && <section className="signal-section"><h3>Advisory Signals</h3><ul className="risk-list">{activeResult.advisorySignals.map((item) => <li key={`${item.id}-${item.title}`}><div><b className={`source-badge source-${item.source.toLowerCase()}`}>{item.source}</b><strong>{item.title}</strong></div><span>{item.detail}</span></li>)}</ul></section>}
          <section className="safety-guarantee"><span className="eyebrow">Deterministic Safety Invariant</span><strong>AI can explain or raise final risk, but it cannot reduce deterministic known-risk signals.</strong></section>
          <section className="explanation"><h3>AI Explanation</h3><p>{activeResult.aiExplanation ?? "AI provider unavailable; deterministic Local Safety Engine result shown."}</p></section>
          <p className="recommendation"><strong>Recommendation:</strong> {activeResult.recommendation}</p>
          <section className={`record-card phase-${recordState.phase}`}><div><span>On-chain assessment receipt · X Layer Testnet only</span><strong>{analysisNetwork === "XLAYER_TESTNET" ? recordLabel : "Unavailable for Mainnet analysis"}</strong></div><div className="actions"><button className="secondary" onClick={() => setReviewed((current) => !current)} disabled={recordPending}>{reviewed ? "Reviewed ✓" : "I reviewed this result"}</button><button className="primary" onClick={recordOnchain} disabled={analysisNetwork !== "XLAYER_TESTNET" || !registryAddress || !analysisHash || !address || !isCorrectNetwork || !reviewed || recordPending || recordState.phase === "confirmed"}>{recordState.phase === "awaiting-signature" ? "Check wallet…" : recordState.phase === "confirming" ? "Confirming…" : recordState.phase === "confirmed" ? "Confirmed" : "Record on X Layer"}</button></div>{recordState.hash && <div className="receipt">Transaction: <a href={`${explorerBase}/tx/${recordState.hash}`} target="_blank" rel="noreferrer">{recordState.hash}</a></div>}{recordState.error && <div className="status-message">{recordState.error}</div>}</section>
        </> : <div className="empty">Choose a preset or enter a transaction.<br />Nothing is analyzed, signed, or broadcast automatically.</div>}
        {message && <div className="status-message" role="status">{message}</div>}
      </div>
    </section>
    <section className="tx-analyzer panel">
      <div className="panel-heading"><div><span className="eyebrow">X Layer Transaction Analyzer</span><h2>Post-hoc Transaction Analysis</h2><p>Load a confirmed or reverted X Layer transaction from real RPC data. This is not pre-sign simulation.</p></div><button className="secondary" onClick={() => loadXLayerTransaction(verifiedTxHash)} disabled={transactionLoading}>Load Verified X Layer Receipt</button></div>
      <div className="tx-search"><input aria-label="X Layer transaction hash" placeholder="0x… transaction hash" value={transactionHash} onChange={(event) => setTransactionHash(event.target.value)} /><button className="primary" onClick={() => loadXLayerTransaction()} disabled={transactionLoading}>{transactionLoading ? "Loading…" : "Inspect Transaction"}</button></div>
      {transactionError && <div className="status-message" role="status">{transactionError}</div>}
      {transactionResult && <div className="tx-result">
        <div className="decoded-grid"><span>Status</span><strong>{transactionResult.status}</strong><span>Block</span><strong>{transactionResult.blockNumber ?? "Pending"}</strong><span>From</span><strong>{transactionResult.from}</strong><span>To</span><strong>{transactionResult.to ?? "Contract creation"}</strong><span>Value</span><strong>{transactionResult.value} OKB</strong><span>Gas</span><strong>{BigInt(transactionResult.gasLimit).toLocaleString()}{transactionResult.gasUsed ? ` limit · ${BigInt(transactionResult.gasUsed).toLocaleString()} used` : " limit"}</strong><span>Method</span><strong>{transactionResult.decodedAction.method}</strong><span>Calldata</span><strong>{transactionResult.input}</strong></div>
        <div className="actions"><a className="secondary link-button" href={`${explorerBase}/tx/${transactionResult.hash}`} target="_blank" rel="noreferrer">Open Official Explorer</a><button className="primary" onClick={loadTransactionIntoAnalyzer} disabled={!transactionResult.analysisInput}>Load into Analyzer</button></div>
      </div>}
    </section>
    <section className="why-xlayer"><div><span className="eyebrow">Why X Layer</span><h2>Compact, user-confirmed evidence.</h2></div><p>After review, users can record only an assessment hash and final score through RiskRegistry on X Layer Testnet (Chain ID 1952). The receipt is evidence of review—not a guarantee of safety and not transaction execution.</p></section>
  </main>;
}
