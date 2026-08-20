import "@nomicfoundation/hardhat-ethers";
import { config as loadEnvironment } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

loadEnvironment({ path: ".env.local" });
loadEnvironment();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    xlayerTestnet: {
      url: process.env.XLAYER_RPC_URL ?? "https://testrpc.xlayer.tech/terigon",
      chainId: 1952,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};

export default config;
