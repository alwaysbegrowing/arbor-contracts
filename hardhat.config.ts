import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat"; // used to create types found in ./typechain
import "@nomiclabs/hardhat-waffle"; // integrates waffle into the hre
import "hardhat-gas-reporter"; // outputs gas usage by contract and method call when testing
import "@nomiclabs/hardhat-ethers"; // integrates ethers into the hre
import "solidity-coverage"; // adds 'coverage' task
import "hardhat-deploy"; // runs scripts in the ./deploy folder
import "@nomiclabs/hardhat-etherscan"; // adds 'verify' task
import "@primitivefi/hardhat-dodoc"; // generates docs on compile
import "hardhat-storage-layout"; // exports storage layout of contracts

import "./tasks/storageLayout.ts"; // add 'storage-layout' task
import "./tasks/settleAuction.ts"; // add 'settle-auction' task

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1: process.env.MAINNET_DEPLOYER_ADDRESS || "",
      5: process.env.GOERLI_DEPLOYER_ADDRESS || "",
    },
    bondHolder: {
      default: 1,
      1: process.env.MAINNET_DEPLOYER_ADDRESS || "",
      5: process.env.GOERLI_BOND_HOLDER_ADDRESS || "",
    },
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      gasPrice: 15000000000, // 15 gwei
      accounts:
        process.env.MAINNET_DEPLOYER_PRIVATE_KEY !== undefined
          ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY]
          : [],
    },
    goerli: {
      live: true,
      url: process.env.GOERLI_RPC_URL || "",
      gasMultiplier: 2,
      gasPrice: 4_000_000_000,
      accounts:
        process.env.GOERLI_DEPLOYER_PRIVATE_KEY !== undefined &&
        process.env.GOERLI_BOND_HOLDER_PRIVATE_KEY !== undefined
          ? [
              process.env.GOERLI_DEPLOYER_PRIVATE_KEY,
              process.env.GOERLI_BOND_HOLDER_PRIVATE_KEY,
            ]
          : [],
    },
    hardhat: {
      mining: {
        auto: true,
      },
      // forking: {
      //   blockNumber: 10815591,
      //   url: process.env.GOERLI_RPC_URL || "",
      // },
    },
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: process.env.GAS_REPORTER_COINMARKETCAP_API_KEY,
  },
  mocha: {
    timeout: 5000000,
  },
  dodoc: {
    include: ["Bond", "BondFactory"],
    exclude: ["TestBond"],
    runOnCompile: true,
    templatePath: "./template.sqrl",
  },
};

export default config;
