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

export const xLayerMainnet = defineChain({
  id: 196,
  name: "X Layer Mainnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"] }
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer" }
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

export const xGuardReceiptAnchorAbi = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptDigest", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "anchored",
    stateMutability: "view",
    inputs: [{ name: "receiptDigest", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "ReceiptAnchored",
    inputs: [
      { indexed: true, name: "receiptDigest", type: "bytes32" },
      { indexed: true, name: "submitter", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" }
    ]
  }
] as const;
