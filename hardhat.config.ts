import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    xlayerTestnet: {
      url: "https://testrpc.xlayer.tech/terigon",
      chainId: 1952
    },
    xlayerMainnet: {
      url: "https://rpc.xlayer.tech",
      chainId: 196
    }
  }
};

export default config;
