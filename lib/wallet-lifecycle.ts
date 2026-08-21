import type { Address } from "viem";
import type { WalletProvider } from "../types/ethereum.ts";

export type DiscoveredWallet = {
  info: { uuid: string; name: string; icon: string };
  provider: WalletProvider;
};

export type ConnectedWalletState = {
  address: Address | "";
  chainId: number | null;
};

export function addDiscoveredWallet(wallets: Map<string, DiscoveredWallet>, wallet: DiscoveredWallet) {
  if (!wallet.info.uuid || !wallet.provider) return [...wallets.values()];
  wallets.set(wallet.info.uuid, wallet);
  return [...wallets.values()];
}

export function preferredWalletProvider(wallets: DiscoveredWallet[], selectedWalletId: string | null, fallback?: WalletProvider) {
  return wallets.find((wallet) => wallet.info.uuid === selectedWalletId)?.provider ?? wallets[0]?.provider ?? fallback ?? null;
}

export async function readConnectedWalletState(provider: WalletProvider): Promise<ConnectedWalletState> {
  const accounts = await provider.request({ method: "eth_accounts" }) as Address[];
  const currentChain = await provider.request({ method: "eth_chainId" }) as string;
  return { address: accounts[0] ?? "", chainId: Number.parseInt(currentChain, 16) };
}

export async function requestWalletConnection(provider: WalletProvider): Promise<ConnectedWalletState> {
  await provider.request({ method: "eth_requestAccounts" });
  return readConnectedWalletState(provider);
}

export async function switchConnectedWalletToXLayer(provider: WalletProvider, rpcUrl: string, explorerUrl: string): Promise<ConnectedWalletState> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0x7a0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: [rpcUrl], blockExplorerUrls: [explorerUrl] }]
    });
  }
  return readConnectedWalletState(provider);
}
