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
      live: true,
      mining: {
        auto: false,
        interval: 10,
      },
      url: process.env.RINKEBY_RPC_URL || "",
      gasMultiplier: 2,
      gasPrice: 4_000_000_000,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      live: true,
      gasPrice: 35000000000,
      url: process.env.POLYGON_RPC_URL || "",
      gasMultiplier: 2,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    hardhat: {
      mining: {
        auto: true,
        interval: 10,
      },
      // forking: {
      //   blockNumber: 10453255,
      //   url: process.env.RINKEBY_RPC_URL || "",
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
