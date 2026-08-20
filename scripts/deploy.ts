import hardhat from "hardhat";

const { ethers } = hardhat;

async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for X Layer Testnet deployment; set it only in your local .env.local.");
  }
  const factory = await ethers.getContractFactory("RiskRegistry");
  const contract = await factory.deploy();
  const deploymentTransaction = contract.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction was not created");
  console.log(`Deployment transaction submitted: ${deploymentTransaction.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const transactionHash = deploymentTransaction.hash;
  console.log(`RiskRegistry deployed to ${address}`);
  console.log(`Deployment transaction: ${transactionHash}`);
  console.log(`Contract explorer: https://www.okx.com/web3/explorer/xlayer-test/address/${address}`);
  console.log(`Transaction explorer: https://www.okx.com/web3/explorer/xlayer-test/tx/${transactionHash}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
