import { expect } from "chai";
import { readFileSync } from "node:fs";
import {
  addDiscoveredWallet,
  preferredWalletProvider,
  readConnectedWalletState,
  requestWalletConnection,
  switchConnectedWalletToXLayer,
  type DiscoveredWallet
} from "../lib/wallet-lifecycle.ts";
import type { WalletProvider } from "../types/ethereum.ts";

type RpcCall = { method: string; params?: unknown };

function mockProvider(options: { switchMissing?: boolean } = {}) {
  const calls: RpcCall[] = [];
  const provider = {
    request: async (request: RpcCall) => {
      calls.push(request);
      if (request.method === "eth_requestAccounts" || request.method === "eth_accounts") return ["0x1111111111111111111111111111111111111111"];
      if (request.method === "eth_chainId") return "0x7a0";
      if (request.method === "wallet_switchEthereumChain" && options.switchMissing) throw Object.assign(new Error("Unknown chain"), { code: 4902 });
      return null;
    }
  } as unknown as WalletProvider;
  return { provider, calls };
}

const pageSource = readFileSync("app/page.tsx", "utf8");

function sourceBetween(start: string, end: string) {
  return pageSource.slice(pageSource.indexOf(start), pageSource.indexOf(end, pageSource.indexOf(start)));
}

describe("Explicit wallet lifecycle", function () {
  it("initial page load contains no wallet RPC call path", function () {
    const preConnectLifecycle = sourceBetween("useEffect(() => {\n    const discovered", "async function connectWallet");
    expect(preConnectLifecycle).not.to.match(/\.request\s*\(|requestWalletConnection|readConnectedWalletState|switchConnectedWalletToXLayer/);
  });

  it("page refresh contains no automatic wallet refresh", function () {
    const connectedProviderEffect = sourceBetween("useEffect(() => {\n    if (!walletProvider)", "function applyConnectedWalletState");
    expect(connectedProviderEffect).not.to.match(/refreshWallet|readConnectedWalletState|\.request\s*\(/);
  });

  it("EIP-6963 discovery records providers with zero wallet RPC calls", function () {
    const { provider, calls } = mockProvider();
    const wallets = new Map<string, DiscoveredWallet>();
    addDiscoveredWallet(wallets, { info: { uuid: "wallet-1", name: "Test Wallet", icon: "" }, provider });
    expect(wallets.size).to.equal(1);
    expect(calls).to.deep.equal([]);
  });

  it("opening Judge Mode has no wallet RPC reference", function () {
    const judgeButton = sourceBetween("⚡ Try Judge Demo", "</section>");
    expect(judgeButton).not.to.match(/WalletProvider|requestWalletConnection|switchConnectedWalletToXLayer|\.request\s*\(/);
  });

  it("loading a Judge preset has no wallet RPC reference", function () {
    const presetLoader = sourceBetween("function loadJudgePreset", "function openVerifiedEvidence");
    expect(presetLoader).not.to.match(/walletProvider|requestWalletConnection|switchConnectedWalletToXLayer|\.request\s*\(/);
  });

  it("Analysis Receipt navigation has no wallet RPC reference", function () {
    const receiptNavigation = sourceBetween("function scrollToReceipt", "async function copyReceiptFingerprint");
    expect(receiptNavigation).not.to.match(/walletProvider|requestWalletConnection|switchConnectedWalletToXLayer|\.request\s*\(/);
  });

  it("explicit Connect wallet requests access and then refreshes state", async function () {
    const { provider, calls } = mockProvider();
    const state = await requestWalletConnection(provider);
    expect(calls.map((call) => call.method)).to.deep.equal(["eth_requestAccounts", "eth_accounts", "eth_chainId"]);
    expect(state).to.deep.equal({ address: "0x1111111111111111111111111111111111111111", chainId: 1952 });
  });

  it("wallet state refresh works only through the explicit helper", async function () {
    const { provider, calls } = mockProvider();
    expect(calls).to.deep.equal([]);
    expect(await readConnectedWalletState(provider)).to.deep.equal({ address: "0x1111111111111111111111111111111111111111", chainId: 1952 });
    expect(calls.map((call) => call.method)).to.deep.equal(["eth_accounts", "eth_chainId"]);
  });

  it("network switching and fallback still work after explicit connection", async function () {
    const { provider, calls } = mockProvider({ switchMissing: true });
    await switchConnectedWalletToXLayer(provider, "https://testrpc.xlayer.tech/terigon", "https://www.okx.com/web3/explorer/xlayer-test");
    expect(calls.map((call) => call.method)).to.deep.equal(["wallet_switchEthereumChain", "wallet_addEthereumChain", "eth_accounts", "eth_chainId"]);
  });

  it("wallet selection is passive until Connect wallet is invoked", function () {
    const { provider, calls } = mockProvider();
    const wallets: DiscoveredWallet[] = [{ info: { uuid: "wallet-1", name: "Test Wallet", icon: "" }, provider }];
    expect(preferredWalletProvider(wallets, "wallet-1")).to.equal(provider);
    expect(calls).to.deep.equal([]);
  });
});
