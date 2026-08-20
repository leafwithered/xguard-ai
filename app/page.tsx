"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createWalletClient, custom, isAddress, keccak256, toHex, type Address, type Hex } from "viem";
import { riskRegistryAbi, xLayerTestnet } from "../lib/xlayer";
import type { RiskInput, RiskResult } from "../lib/risk";

const registryAddress = process.env.NEXT_PUBLIC_RISK_REGISTRY_ADDRESS as Address | undefined;
const explorerBase = "https://www.okx.com/web3/explorer/xlayer-test";
const shortAddress = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";

export default function Home() {
  const [address, setAddress] = useState<Address | "">("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [context, setContext] = useState("Swap on a new token router");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [lastInput, setLastInput] = useState<RiskInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [txHash, setTxHash] = useState<Hex | "">("");
  const [message, setMessage] = useState("");
  const revalidatedStoredResult = useRef(false);
  const networkName = chainId === null ? "Not connected" : chainId === 1952 ? "X Layer Testnet" : `Wrong network · ${chainId}`;
  const isCorrectNetwork = chainId === 1952;
  const analysisHash = useMemo(() => lastInput && result ? keccak256(toHex(JSON.stringify({ input: lastInput, result }))) : null, [lastInput, result]);

  useEffect(() => {
    const saved = window.localStorage.getItem("xguard-last-result");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { input: RiskInput; result: RiskResult };
      setLastInput(parsed.input);
      setResult(parsed.result);
      if (parsed.result.mode !== "AI" && !revalidatedStoredResult.current) {
        revalidatedStoredResult.current = true;
        void fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.input) })
          .then(async (response) => {
            if (!response.ok) return null;
            return await response.json() as RiskResult;
          })
          .then((freshResult) => {
            if (!freshResult || freshResult.mode !== "AI") return;
            setResult(freshResult);
            window.localStorage.setItem("xguard-last-result", JSON.stringify({ input: parsed.input, result: freshResult }));
          })
          .catch(() => undefined);
      }
    } catch { window.localStorage.removeItem("xguard-last-result"); }
  }, []);

  async function refreshWallet() {
    if (!window.ethereum) return;
    const accounts = await window.ethereum.request({ method: "eth_accounts" }) as Address[];
    const currentChain = await window.ethereum.request({ method: "eth_chainId" }) as string;
    setAddress(accounts[0] ?? ""); setFrom(accounts[0] ?? ""); setChainId(Number.parseInt(currentChain, 16));
  }

  async function connectWallet() {
    setMessage("");
    try {
      if (!window.ethereum) { setMessage("Install or open an EVM wallet such as OKX Wallet first."); return; }
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
      setAddress(accounts[0] ?? ""); setFrom(accounts[0] ?? "");
      const currentChain = await window.ethereum.request({ method: "eth_chainId" }) as string;
      setChainId(Number.parseInt(currentChain, 16));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled or failed.");
    }
  }

  async function switchToXLayer() {
    setMessage("");
    if (!window.ethereum) { setMessage("Connect an EVM wallet before switching networks."); return; }
    try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] }); }
    catch (error) {
      try {
        if ((error as { code?: number }).code !== 4902) throw error;
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: ["https://testrpc.xlayer.tech/terigon"], blockExplorerUrls: [explorerBase] }] });
      } catch (switchError) {
        setMessage(switchError instanceof Error ? switchError.message : "Network switch was cancelled or failed.");
        return;
      }
    }
    try { await refreshWallet(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to refresh wallet network."); }
  }

  async function analyze() {
    setMessage(""); setConfirmed(false); setTxHash("");
    const input: RiskInput = { from, to, value, data, context };
    if (!isAddress(to)) { setMessage("Enter a valid recipient contract address."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const payload = await response.json() as RiskResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Risk analysis failed");
      setResult(payload); setLastInput(input); window.localStorage.setItem("xguard-last-result", JSON.stringify({ input, result: payload }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Risk analysis failed"); }
    finally { setBusy(false); }
  }

  async function recordOnchain() {
    if (!registryAddress || !analysisHash || !window.ethereum || !address || !result || !isCorrectNetwork || !confirmed) return;
    setBusy(true); setMessage("");
    try {
      const walletClient = createWalletClient({ account: address, chain: xLayerTestnet, transport: custom(window.ethereum) });
      const hash = await walletClient.writeContract({ address: registryAddress, abi: riskRegistryAbi, functionName: "recordAssessment", args: [analysisHash, result.score], account: address });
      setTxHash(hash); setMessage("Assessment recorded on X Layer Testnet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Wallet transaction failed"); }
    finally { setBusy(false); }
  }

  const modeLabel = result?.mode === "AI" ? "AI Analysis" : "Local Analysis";
  return <main className="shell"><header className="topbar"><div className="brand"><span className="brand-mark">X</span> XGuard AI</div><div className="network-pill">{networkName} · Chain 1952</div></header><section className="hero"><div><div className="eyebrow">Transaction safety copilot</div><h1>Know the risk before you sign.</h1><p className="lead">XGuard AI reviews the transaction you are about to execute, explains the signals in plain language, and leaves the final decision with you.</p></div><div className="hero-card"><h2>Built for X Layer</h2><div className="signal"><span>Network</span><strong>{networkName}</strong></div><div className="signal"><span>Analysis mode</span><strong>{modeLabel}</strong></div><div className="signal"><span>Signing</span><strong>Always user-confirmed</strong></div></div></section><section className="workspace"><div className="panel"><h2>1. Prepare transaction</h2><p>Paste the target and call data, then add any context you know about the interaction.</p><label htmlFor="from">From address</label><input id="from" placeholder="0x..." value={from} onChange={(event) => setFrom(event.target.value)} /><label htmlFor="to">Recipient contract</label><input id="to" placeholder="0x..." value={to} onChange={(event) => setTo(event.target.value)} /><div className="row"><div><label htmlFor="value">Value (OKB)</label><input id="value" value={value} onChange={(event) => setValue(event.target.value)} /></div><div><label htmlFor="data">Calldata</label><input id="data" value={data} onChange={(event) => setData(event.target.value)} /></div></div><label htmlFor="context">What are you trying to do?</label><textarea id="context" value={context} onChange={(event) => setContext(event.target.value)} /><div className="actions"><button className="primary" onClick={analyze} disabled={busy}>{busy ? "Analyzing…" : "Analyze risk"}</button><button className="secondary" onClick={connectWallet}>{address ? shortAddress(address) : "Connect wallet"}</button>{!isCorrectNetwork && <button className="secondary" onClick={switchToXLayer}>Switch to X Layer</button>}</div><div className="footer-note">The analysis is advisory. XGuard AI never signs or broadcasts a transaction automatically.</div></div><div className="panel result"><h2>2. Review and record</h2>{result ? <><div className="score-wrap"><div className={`score score-${result.level.toLowerCase()}`}>{result.score}</div><div className="score-copy"><strong>{result.level} RISK</strong><span>{result.summary}</span></div></div><div className="analysis-mode">{modeLabel}</div><ul className="risk-list">{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="recommendation"><strong>Recommendation:</strong> {result.recommendation}</p><div className="actions"><button className="secondary" onClick={() => setConfirmed((current) => !current)}>{confirmed ? "Confirmed for recording" : "I reviewed this result"}</button><button className="primary" onClick={recordOnchain} disabled={!registryAddress || !analysisHash || !address || !isCorrectNetwork || !confirmed || busy}>{busy ? "Waiting for wallet…" : "Record on X Layer"}</button></div>{!registryAddress && <div className="footer-note">Deploy `RiskRegistry` and set `NEXT_PUBLIC_RISK_REGISTRY_ADDRESS` to enable recording.</div>}{txHash && <div className="receipt">Transaction: <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a></div>}</> : <div className="empty">Your risk report will appear here.<br />Nothing is signed without your approval.</div>}{message && <div className="status-message">{message}</div>}</div></section></main>;
}
