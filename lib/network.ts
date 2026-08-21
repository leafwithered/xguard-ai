export const analysisNetworks = ["XLAYER_TESTNET", "XLAYER_MAINNET"] as const;

export type AnalysisNetwork = typeof analysisNetworks[number];

export type AnalysisNetworkConfig = {
  network: AnalysisNetwork;
  name: string;
  chainId: 1952 | 196;
  okxChainIndex: "196" | null;
  rpcUrl: string;
  explorerUrl: string;
  simulationSupported: boolean;
};

const networkConfigs: Record<AnalysisNetwork, AnalysisNetworkConfig> = {
  XLAYER_TESTNET: {
    network: "XLAYER_TESTNET",
    name: "X Layer Testnet",
    chainId: 1952,
    okxChainIndex: null,
    rpcUrl: "https://testrpc.xlayer.tech/terigon",
    explorerUrl: "https://www.okx.com/web3/explorer/xlayer-test",
    simulationSupported: false
  },
  XLAYER_MAINNET: {
    network: "XLAYER_MAINNET",
    name: "X Layer Mainnet",
    chainId: 196,
    okxChainIndex: "196",
    rpcUrl: "https://rpc.xlayer.tech",
    explorerUrl: "https://www.okx.com/web3/explorer/xlayer",
    simulationSupported: true
  }
};

export function normalizeAnalysisNetwork(value: unknown): AnalysisNetwork {
  return value === "XLAYER_MAINNET" ? "XLAYER_MAINNET" : "XLAYER_TESTNET";
}

export function getAnalysisNetworkConfig(value: unknown): AnalysisNetworkConfig {
  return networkConfigs[normalizeAnalysisNetwork(value)];
}
