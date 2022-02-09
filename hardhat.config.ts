import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "solidity-coverage";

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
  solidity: {
    compilers: [
      {
        version: "0.5.5",
      },
      {
        version: "0.6.12",
      },
      {
        version: "0.8.9",
      },
    ],
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
      },
      // forking: {
      //   url: process.env.MAINNET_RPC_URL || "",
      //   blockNumber: Number(process.env.FORK_BLOCK_NUMBER) || 14135757,
      // },
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.GAS_REPORTER_ENABLED !== undefined,
    currency: "USD",
    coinmarketcap: process.env.GAS_REPORTER_COINMARKETCAP_API_KEY || "",
  },
};

export default config;
