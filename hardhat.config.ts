import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@typechain/hardhat"; // used to create types found in ./typechain
import "@nomiclabs/hardhat-waffle"; // integrates waffle into the hre
import "hardhat-gas-reporter"; // outputs gas usage by contract and method call when testing
import "@nomiclabs/hardhat-ethers"; // integrates ethers into the hre
import "solidity-coverage"; // adds 'coverage' task
import "hardhat-deploy"; // runs scripts in the ./deploy folder
import "@nomiclabs/hardhat-etherscan"; // adds 'verify' task
import "hardhat-storage-layout"; // exports storage layout of contracts

import "./tasks/storageLayout.ts"; // add 'storage-layout' task

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0,
      4: process.env.RINKEBY_DEPLOYER_ADDRESS || "",
    },
  },
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    hardhat: {
      mining: {
        auto: true,
      },
    },
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: process.env.GAS_REPORTER_COINMARKETCAP_API_KEY,
  },
  mocha: {
    timeout: 5000000,
  },
};

export default config;
