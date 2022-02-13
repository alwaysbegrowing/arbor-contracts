import { BigNumber, Contract } from "ethers";

import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { CollateralData, useCustomErrorMatcher } from "./utilities";
import type { CollateralToken, Broker } from "../typechain";

const EasyAuctionJSON = require("../contracts/external/EasyAuction.json");

const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
};
useCustomErrorMatcher();
describe("Broker", async () => {
  let owner: SignerWithAddress;
  let auctioneerSigner: SignerWithAddress;
  let collateralToken: CollateralToken;
  let broker: Broker;
  let gnosisAuction: Contract;
  let collateralData: CollateralData;

  beforeEach(async () => {
    [owner, auctioneerSigner] = await ethers.getSigners();
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_RPC_URL,
            blockNumber: Number(process.env.FORK_BLOCK_NUMBER),
          },
        },
      ],
    });

    collateralData = {
      collateralAddress: ethers.constants.AddressZero,
      collateralAmount: ethers.utils.parseEther("100"),
    };
    // Mint 100 ether of tokens of collateral for auctioneerSigner
    const CollateralToken = await ethers.getContractFactory("CollateralToken");
    collateralToken = (await CollateralToken.connect(auctioneerSigner).deploy(
      "Collateral Token",
      "CT",
      collateralData.collateralAmount
    )) as CollateralToken;
    collateralData.collateralAddress = collateralToken.address;

    // The tokens minted here do not matter. The Porter Auction will mint the porterBond
    const GnosisAuction = await ethers.getContractFactory(
      EasyAuctionJSON.abi,
      EasyAuctionJSON.bytecode,
      owner
    );
    gnosisAuction = GnosisAuction.attach(GNOSIS_AUCTION_ADDRESS.mainnet);

    const Broker = await ethers.getContractFactory("Broker");
    broker = (await Broker.deploy(gnosisAuction.address)) as Broker;
  });

  it("reverts if not enough collateral is supplied", async () => {
    // check revert
    await expect(broker.depositCollateral(collateralData)).to.be.reverted;

    // check revert with specific error name
    await expect(broker.depositCollateral(collateralData)).to.be.revertedWith(
      "InadequateCollateralBalance"
    );

    // check revert with specific arguments
    await expect(
      broker.depositCollateral(collateralData)
    ).to.be.revertedWithArgs(
      "InadequateCollateralBalance",
      collateralData.collateralAddress,
      // TODO: need a better way to check numbers that overflow js limits (can't use toNumber here because of)
      parseInt(collateralData.collateralAmount.toString())
    );
  });
});
