"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { createPublicClient, createWalletClient, custom, http, isAddress, keccak256, toHex, type Address } from "viem";
import { riskRegistryAbi, xLayerTestnet } from "../lib/xlayer";
import type { RiskInput, RiskResult } from "../lib/risk";
import { initialRecordState, isRecordPending, reduceRecordState } from "../lib/transaction-state";
import type { WalletProvider } from "../types/ethereum";

const registryAddress = process.env.NEXT_PUBLIC_RISK_REGISTRY_ADDRESS as Address | undefined;
const explorerBase = "https://www.okx.com/web3/explorer/xlayer-test";
const demoUrl = "https://github.com/leafwithered/xguard-ai/blob/main/demo/xguard-ai-build-x-demo.mp4";
const contractUrl = `${explorerBase}/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`;
const verifiedTxUrl = `${explorerBase}/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`;
const maxUint = "f".repeat(64);
const spender = "1234567890123456789012345678901234567890";
const unlimitedApproval = `0x095ea7b3${"0".repeat(24)}${spender}${maxUint}`;

type WalletOption = { info: { uuid: string; name: string; icon: string }; provider: WalletProvider };

const presets: Array<{ name: string; description: string; input: RiskInput }> = [
  {
    name: "Safe Transfer",
    description: "Simple zero-value transfer intent",
    input: { from: "", to: "0x1111111111111111111111111111111111111111", value: "0", data: "0x", context: "Routine transfer to a known address" }
  },
  {
    name: "Unlimited Approval",
    description: "ERC20 spender receives unlimited permission",
    input: { from: "", to: "0x2222222222222222222222222222222222222222", value: "0", data: unlimitedApproval, context: "Approve a token router after independently verifying the contract" }
  },
  {
    name: "Suspicious Airdrop",
    description: "Zero-address approval with urgent claim language",
    input: { from: "", to: "0x0000000000000000000000000000000000000000", value: "12", data: unlimitedApproval, context: "Urgent airdrop claim on an unknown contract" }
  }
];

const shortAddress = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";

export default function Home() {
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [address, setAddress] = useState<Address | "">("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [context, setContext] = useState("Swap on a new token router");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [lastInput, setLastInput] = useState<RiskInput | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [recordState, dispatchRecord] = useReducer(reduceRecordState, initialRecordState);
  const [message, setMessage] = useState("");
  const networkName = chainId === null ? "Not connected" : chainId === 1952 ? "X Layer Testnet" : `Wrong network · ${chainId}`;
  const isCorrectNetwork = chainId === 1952;
  const recordPending = isRecordPending(recordState);
  const analysisHash = useMemo(() => lastInput && result ? keccak256(toHex(JSON.stringify({ input: lastInput, result }))) : null, [lastInput, result]);

  useEffect(() => {
    window.localStorage.removeItem("xguard-last-result");
    const saved = window.sessionStorage.getItem("xguard-session-result");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { input: RiskInput; result: RiskResult };
      setLastInput(parsed.input);
      setResult(parsed.result);
    } catch {
      window.sessionStorage.removeItem("xguard-session-result");
    }
  }, []);

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
    clearAnalysis(false);
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
    const input: RiskInput = { from, to, value, data, context };
    if (!isAddress(to)) { setMessage("Enter a valid recipient contract address."); return; }
    setAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const payload = await response.json() as RiskResult & { error?: string };
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
    if (!registryAddress || !analysisHash || !walletProvider || !address || !result || !isCorrectNetwork || !reviewed || recordPending) return;
    setMessage("");
    dispatchRecord({ type: "SIGNATURE_REQUESTED" });
    try {
      const walletClient = createWalletClient({ account: address, chain: xLayerTestnet, transport: custom(walletProvider) });
      const hash = await walletClient.writeContract({ address: registryAddress, abi: riskRegistryAbi, functionName: "recordAssessment", args: [analysisHash, result.finalScore], account: address });
      dispatchRecord({ type: "SUBMITTED", hash });
      dispatchRecord({ type: "CONFIRMING" });
      const publicClient = createPublicClient({ chain: xLayerTestnet, transport: http(xLayerTestnet.rpcUrls.default.http[0]) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
      dispatchRecord({ type: receipt.status === "success" ? "CONFIRMED" : "REVERTED" });
    } catch (error) {
      dispatchRecord({ type: "FAILED", error: error instanceof Error ? error.message : "Wallet transaction failed" });
    }
  }

  const modeLabel = result?.mode === "HYBRID" ? "Hybrid Analysis" : result?.mode === "AI" ? "AI Analysis" : "Local Safety Engine";
  const recordLabel = recordState.phase === "awaiting-signature" ? "Awaiting wallet signature" : recordState.phase === "submitted" ? "Submitted" : recordState.phase === "confirming" ? "Confirming on X Layer" : recordState.phase === "confirmed" ? "Confirmed on X Layer" : recordState.phase === "reverted" ? "Transaction reverted" : recordState.phase === "error" ? "Confirmation error" : "Ready after review";
  const decoded = result?.decodedAction;

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">X</span><span>XGuard AI</span></div>
      <nav className="quick-links"><a href="https://github.com/leafwithered/xguard-ai" target="_blank" rel="noreferrer">GitHub</a><a href={contractUrl} target="_blank" rel="noreferrer">Contract</a><a href={verifiedTxUrl} target="_blank" rel="noreferrer">Verified Tx</a><a href={demoUrl} target="_blank" rel="noreferrer">Demo</a></nav>
      <div className={`network-pill ${isCorrectNetwork ? "live" : ""}`}>{isCorrectNetwork && <span className="live-dot" />}{networkName} · Chain 1952</div>
    </header>
    <section className="hero">
      <div><div className="eyebrow">Transaction risk intelligence</div><h1>Know the risk before you sign.</h1><p className="lead">Deterministic safety rules establish a risk floor. AI adds context and explanation, but can never weaken critical signals.</p></div>
      <div className="hero-card"><h2>Built for X Layer</h2><div className="signal"><span>Network</span><strong>{networkName}</strong></div><div className="signal"><span>Analysis</span><strong>{modeLabel}</strong></div><div className="signal"><span>Safety floor</span><strong>Deterministic</strong></div><div className="signal"><span>Signing</span><strong>Always user-confirmed</strong></div></div>
    </section>
    <section className="workspace">
      <div className="panel transaction-panel">
        <div className="panel-heading"><div><h2>1. Prepare transaction</h2><p>Start with a preset or inspect a transaction manually.</p></div><button className="text-button" onClick={() => clearAnalysis()}>Clear analysis</button></div>
        <div className="presets">{presets.map((preset) => <button key={preset.name} onClick={() => applyPreset(preset.input)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div>
        <label htmlFor="from">From address</label><input id="from" placeholder="0x..." value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="to">Recipient contract</label><input id="to" placeholder="0x..." value={to} onChange={(event) => setTo(event.target.value)} />
        <div className="row"><div><label htmlFor="value">Value (OKB)</label><input id="value" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} /></div><div><label htmlFor="data">Calldata</label><input id="data" value={data} onChange={(event) => setData(event.target.value)} /></div></div>
        <label htmlFor="context">What are you trying to do?</label><textarea id="context" maxLength={2000} value={context} onChange={(event) => setContext(event.target.value)} />
        {wallets.length > 1 && <div className="wallet-options"><span>Detected wallets</span>{wallets.map((wallet) => <button key={wallet.info.uuid} onClick={() => setWalletProvider(wallet.provider)}>{wallet.info.name}</button>)}</div>}
        <div className="actions"><button className="primary" onClick={analyze} disabled={analyzing || recordPending}>{analyzing ? "Analyzing…" : "Analyze risk"}</button><button className="secondary" onClick={connectWallet}>{address ? shortAddress(address) : "Connect wallet"}</button>{!isCorrectNetwork && <button className="secondary" onClick={switchToXLayer}>Switch to X Layer</button>}</div>
        <div className="footer-note">AI is advisory. XGuard AI never signs or broadcasts automatically.</div>
      </div>
      <div className="panel result-panel">
        <h2>2. Review risk</h2>
        {result ? <>
          <div className="score-wrap"><div className={`score score-${result.level.toLowerCase()}`}>{result.finalScore}</div><div className="score-copy"><span>Final Risk Score</span><strong>{result.level} RISK</strong><small>Local floor {result.deterministicScore}{typeof result.aiScore === "number" ? ` · AI ${result.aiScore}` : ""}</small></div></div>
          <div className="analysis-mode">{modeLabel}</div>
          {decoded && <section className="decoded-card"><h3>{decoded.action}</h3><div className="decoded-grid"><span>Method</span><strong>{decoded.method}</strong>{decoded.spender && <><span>Spender</span><strong>{decoded.spender}</strong></>}{decoded.recipient && <><span>Recipient</span><strong>{decoded.recipient}</strong></>}{decoded.from && <><span>From</span><strong>{decoded.from}</strong></>}{decoded.operator && <><span>Operator</span><strong>{decoded.operator}</strong></>}{decoded.amount && <><span>Amount</span><strong>{decoded.isUnlimited ? "Unlimited" : decoded.amount}</strong></>}{typeof decoded.approved === "boolean" && <><span>Approved</span><strong>{decoded.approved ? "Yes" : "No"}</strong></>}</div>{decoded.riskHint && <p>{decoded.riskHint}</p>}</section>}
          {result.criticalSignals.length > 0 && <section className="signal-section"><h3>Critical Signals</h3><ul className="risk-list critical">{result.criticalSignals.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul></section>}
          {result.advisorySignals.length > 0 && <section className="signal-section"><h3>Advisory Signals</h3><ul className="risk-list">{result.advisorySignals.map((item) => <li key={`${item.id}-${item.title}`}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul></section>}
          <section className="explanation"><h3>AI Explanation</h3><p>{result.aiExplanation ?? "AI provider unavailable; deterministic Local Safety Engine result shown."}</p></section>
          <p className="recommendation"><strong>Recommendation:</strong> {result.recommendation}</p>
          <section className={`record-card phase-${recordState.phase}`}><div><span>On-chain assessment receipt</span><strong>{recordLabel}</strong></div><div className="actions"><button className="secondary" onClick={() => setReviewed((current) => !current)} disabled={recordPending}>{reviewed ? "Reviewed ✓" : "I reviewed this result"}</button><button className="primary" onClick={recordOnchain} disabled={!registryAddress || !analysisHash || !address || !isCorrectNetwork || !reviewed || recordPending || recordState.phase === "confirmed"}>{recordState.phase === "awaiting-signature" ? "Check wallet…" : recordState.phase === "confirming" ? "Confirming…" : recordState.phase === "confirmed" ? "Confirmed" : "Record on X Layer"}</button></div>{recordState.hash && <div className="receipt">Transaction: <a href={`${explorerBase}/tx/${recordState.hash}`} target="_blank" rel="noreferrer">{recordState.hash}</a></div>}{recordState.error && <div className="status-message">{recordState.error}</div>}</section>
        </> : <div className="empty">Choose a preset or enter a transaction.<br />Nothing is analyzed, signed, or broadcast automatically.</div>}
        {message && <div className="status-message">{message}</div>}
      </div>
    </section>
    <section className="why-xlayer"><div><span className="eyebrow">Why X Layer</span><h2>Compact, user-confirmed evidence.</h2></div><p>After review, users can record only an assessment hash and final score through RiskRegistry on X Layer Testnet (Chain ID 1952). The receipt is evidence of review—not a guarantee of safety and not transaction execution.</p></section>
  </main>;
}
