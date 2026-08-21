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
import type { WalletProvider } from "../types/ethereum";

const registryAddress = process.env.NEXT_PUBLIC_RISK_REGISTRY_ADDRESS as Address | undefined;
const explorerBase = "https://www.okx.com/web3/explorer/xlayer-test";
const demoUrl = "https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4";
const contractUrl = `${explorerBase}/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`;
const verifiedTxUrl = `${explorerBase}/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`;
const verifiedTxHash = "0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb";
type WalletOption = { info: { uuid: string; name: string; icon: string }; provider: WalletProvider };
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
    && validConsistency;
}

export default function Home() {
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
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
  const [judgeModeOpen, setJudgeModeOpen] = useState(false);
  const walletNetworkName = chainId === null ? "Wallet not connected" : chainId === 1952 ? "Wallet on X Layer Testnet" : `Wallet network · ${chainId}`;
  const analysisNetworkConfig = getAnalysisNetworkConfig(analysisNetwork);
  const networkName = analysisNetworkConfig.name;
  const isCorrectNetwork = chainId === 1952;
  const recordPending = isRecordPending(recordState);
  const currentTransactionInput: RiskInput = { from, to, value, data, context, analysisNetwork };
  const activeResult = currentAnalysisResult({ result, lastInput, reviewed }, currentTransactionInput);
  const analysisHash = useMemo(() => lastInput && activeResult ? keccak256(toHex(JSON.stringify({ input: lastInput, result: activeResult }))) : null, [lastInput, activeResult]);

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
    dispatchRecord({ type: "RESET" });
    window.sessionStorage.removeItem("xguard-session-result");
    setMessage(freshness.notice);
  }, [from, to, value, data, context, analysisNetwork, result, lastInput, reviewed]);

  useEffect(() => {
    const discovered = new Map<string, WalletOption>();
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<WalletOption>).detail;
      if (!detail?.info?.uuid || !detail.provider) return;
      discovered.set(detail.info.uuid, detail);
      setWallets([...discovered.values()]);
      if (!walletProvider && detail.info.name.toLowerCase().includes("okx")) setWalletProvider(detail.provider);
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (!walletProvider && window.ethereum) setWalletProvider(window.ethereum);
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, [walletProvider]);

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
    void refreshWallet(walletProvider);
    return () => {
      walletProvider.removeListener?.("accountsChanged", accountsChanged);
      walletProvider.removeListener?.("chainChanged", chainChanged);
      walletProvider.removeListener?.("disconnect", disconnected);
    };
  }, [walletProvider]);

  async function refreshWallet(provider: WalletProvider) {
    const accounts = await provider.request({ method: "eth_accounts" }) as Address[];
    const currentChain = await provider.request({ method: "eth_chainId" }) as string;
    setAddress(accounts[0] ?? "");
    if (accounts[0]) setFrom(accounts[0]);
    setChainId(Number.parseInt(currentChain, 16));
  }

  async function connectWallet() {
    setMessage("");
    if (!walletProvider) { setMessage("Install or open an EVM wallet such as OKX Wallet first."); return; }
    try {
      const accounts = await walletProvider.request({ method: "eth_requestAccounts" }) as Address[];
      setAddress(accounts[0] ?? "");
      setFrom(accounts[0] ?? "");
      await refreshWallet(walletProvider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled or failed.");
    }
  }

  async function switchToXLayer() {
    setMessage("");
    if (!walletProvider) { setMessage("Connect an EVM wallet before switching networks."); return; }
    try {
      await walletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
    } catch (error) {
      try {
        if ((error as { code?: number }).code !== 4902) throw error;
        await walletProvider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: [xLayerTestnet.rpcUrls.default.http[0]], blockExplorerUrls: [explorerBase] }] });
      } catch (switchError) {
        setMessage(switchError instanceof Error ? switchError.message : "Network switch was cancelled or failed.");
        return;
      }
    }
    try { await refreshWallet(walletProvider); } catch { setMessage("Unable to refresh wallet network."); }
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
    dispatchRecord({ type: "RESET" });
    window.sessionStorage.removeItem("xguard-session-result");
    if (clearFields) { setTo(""); setValue("0"); setData("0x"); setContext(""); }
  }

  async function analyze() {
    setMessage(""); setReviewed(false); dispatchRecord({ type: "RESET" });
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

  const modeLabel = activeResult?.mode === "HYBRID" ? "Hybrid Analysis" : activeResult?.mode === "AI" ? "AI Analysis" : "Local Safety Engine";
  const recordLabel = recordState.phase === "awaiting-signature" ? "Awaiting wallet signature" : recordState.phase === "submitted" ? "Submitted" : recordState.phase === "confirming" ? "Confirming on X Layer" : recordState.phase === "confirmed" ? "Confirmed on X Layer" : recordState.phase === "reverted" ? "Transaction reverted" : recordState.phase === "error" ? "Confirmation error" : "Ready after review";
  const decoded = activeResult?.decodedAction;
  const intelligence = activeResult?.contractIntelligence;
  const simulation = activeResult?.simulationEvidence;
  const scorePresentation = activeResult ? buildRiskScorePresentation(activeResult) : null;
  const liveOkxEvidence = isLiveOkxProviderEvidence(simulation);

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">X</span><span>XGuard AI</span></div>
      <nav className="quick-links"><a href="https://github.com/leafwithered/xguard-ai" target="_blank" rel="noreferrer">GitHub</a><a href={contractUrl} target="_blank" rel="noreferrer">Contract</a><a href={verifiedTxUrl} target="_blank" rel="noreferrer">Verified Tx</a><a href={demoUrl} target="_blank" rel="noreferrer">Demo</a></nav>
      <div className="network-pill live"><span className="live-dot" />Analysis: {networkName} · Chain {analysisNetworkConfig.chainId}</div>
    </header>
    <section className="hero">
      <div><div className="eyebrow">Evidence-grounded pre-sign intelligence</div><h1>Know what a transaction does before you sign.</h1><p className="lead">XGuard combines deterministic decoding, X Layer RPC facts, optional OKX Mainnet simulation, Intent vs Reality, and evidence-grounded AI—without treating any provider as a safety oracle.</p><div className="hero-actions"><button className="primary" onClick={() => document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth" })}>Analyze Transaction</button><button className="judge-button" aria-expanded={judgeModeOpen} aria-controls="judge-demo" onClick={() => setJudgeModeOpen((current) => !current)}>⚡ Try Judge Demo</button></div></div>
      <div className="hero-card"><h2>What happens if I sign this?</h2><div className="signal"><span>Analysis Network</span><strong>{networkName}</strong></div><div className="signal"><span>Wallet</span><strong>{walletNetworkName}</strong></div><div className="signal"><span>Analysis</span><strong>{modeLabel}</strong></div><div className="signal"><span>Safety floor</span><strong>Deterministic</strong></div><div className="signal"><span>Signing</span><strong>Always user-confirmed</strong></div></div>
    </section>
    <section className="capability-strip"><span>Deterministic Decoder</span><span>X Layer RPC</span><span>OKX Simulation Evidence</span><span>Intent vs Reality</span><span>Evidence-grounded AI</span></section>
    {judgeModeOpen && <section className="judge-mode" id="judge-demo">
      <div className="panel-heading"><div><span className="eyebrow">60-Second Judge Path</span><h2>See why XGuard is more than an AI wrapper.</h2><p>Each action is explicit. Nothing connects, signs, records, or broadcasts automatically.</p></div><button className="text-button" onClick={() => setJudgeModeOpen(false)}>Close</button></div>
      <div className="judge-steps">
        <article><b>01</b><span>Safe Transfer</span><strong>Expected: LOW</strong><p>Baseline deterministic analysis plus optional AI enrichment.</p><button className="secondary" onClick={() => loadJudgePreset(0)}>Load</button></article>
        <article><b>02</b><span>Ambiguous Approval</span><strong>Expected: UNDETERMINED</strong><p>The shared approve() selector stays ambiguous unless token-standard evidence resolves it.</p><button className="secondary" onClick={() => loadJudgePreset(1)}>Load</button></article>
        <article><b>03</b><span>Suspicious Airdrop</span><strong>Expected: HIGH + MISMATCH</strong><p>Claim intent contradicts contract-wide operator permission; deterministic evidence is not weakened by AI.</p><button className="secondary" onClick={() => loadJudgePreset(2)}>Load</button></article>
        <article><b>04</b><span>Live OKX Mainnet Simulation</span><strong>Expected: PROVIDER EVIDENCE</strong><p>Loads a public historical approval fixture. Analysis remains explicit and read-only.</p><button className="secondary" onClick={() => { applyPreset(publicMainnetSimulationFixture.input); document.querySelector(".transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Load</button></article>
        <article><b>05</b><span>Verified X Layer Evidence</span><strong>Receipt: Confirmed</strong><p>Real user-signed RiskRegistry receipt on Chain 1952.</p><button className="secondary" onClick={openVerifiedEvidence}>View Receipt</button></article>
      </div>
      <div className="judge-checklist"><span>✓ Human-readable calldata</span><span>✓ Deterministic safety floor</span><span>✓ AI enrichment</span><span>✓ X Layer intelligence</span><span>✓ User-controlled signing</span><span>✓ Verified on-chain receipt</span></div>
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
        {wallets.length > 1 && <div className="wallet-options"><span>Detected wallets</span>{wallets.map((wallet) => <button key={wallet.info.uuid} onClick={() => setWalletProvider(wallet.provider)}>{wallet.info.name}</button>)}</div>}
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
