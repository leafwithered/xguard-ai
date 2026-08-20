import { defineChain } from "viem";

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] }
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer-test" }
  }
});

export const riskRegistryAbi = [
  {
    type: "function",
    name: "recordAssessment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "analysisHash", type: "bytes32" },
      { name: "riskScore", type: "uint8" }
    ],
    outputs: []
  }
] as const;
