
import { BigNumber, Contract } from "ethers";

import { ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  addDaysToNow,
  closeAuction,
  CollateralData,
  createAuctionWithDefaults,
  createTokensAndMintAndApprove,
  encodeOrder,
  increaseTime,
  mineBlock,
  placeOrders,
} from "./utilities";
import { expect } from "chai";
import type {
  PorterBond,
  CollateralToken,
  Broker,
  BiddingToken,
} from "../typechain";

// import type { EasyAuction } from "../contracts/external/EasyAuction";
const EasyAuctionJson = require("../contracts/external/EasyAuction.json");

const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
};
describe("Auction", async () => {
  // default deployer address of contracts
  let owner: SignerWithAddress;
  // address of the example DAO which configures and runs the auction
  let auctioneerSigner: SignerWithAddress;
  // addresses of the bidders
  let bidders: SignerWithAddress[];
  let broker: Broker;
  let gnosisAuction: Contract;
  let biddingToken: BiddingToken;
  let collateralToken: CollateralToken;
  let porterBond: PorterBond;
  let collateralData: CollateralData;

  beforeEach(async () => {
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
    [owner, auctioneerSigner, ...bidders] = await ethers.getSigners();
    bidders = bidders.slice(0, 3);

    const BiddingToken = await ethers.getContractFactory("BiddingToken");
    biddingToken = (await BiddingToken.deploy(
      "Bidding Token",
      "BT",
      ethers.utils.parseEther("10000")
    )) as BiddingToken;

    // Mint 100 ether of tokens of collateral for auctioneerSigner
    const CollateralToken = await ethers.getContractFactory("CollateralToken");
    collateralToken = (await CollateralToken.connect(auctioneerSigner).deploy(
      "Collateral Token",
      "CT",
      collateralData.collateralAmount
    )) as CollateralToken;
    // set collateral address
    collateralData.collateralAddress = collateralToken.address;

    // The tokens minted here do not matter. The Porter Auction will mint the porterBond
    const PorterBond = await ethers.getContractFactory("PorterBond");
    porterBond = (await PorterBond.connect(owner).deploy(
      "Bond Token",
      "BT",
      ethers.utils.parseEther("100")
    )) as PorterBond;

    gnosisAuction = await ethers.getContractAt(
      EasyAuctionJson.abi,
      GNOSIS_AUCTION_ADDRESS.mainnet
    );

    const Broker = await ethers.getContractFactory("Broker");
    broker = (await Broker.deploy(gnosisAuction.address)) as Broker;

    await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏
  });
  describe("Porter Auction E2E", async () => {
    it("deposits collateral, initiates auction, settles auction", async () => {
      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/debug info"); //                     |
      //                                                    |
      // ----------------------------------------------------

      console.log({
        porter: owner.address,
        auctioneer: auctioneerSigner.address,
        [`bidders(${bidders.length})`]: bidders.map((b) => b.address),
        porterBondAddress: porterBond.address,
        collateralTokenAddress: collateralToken.address,
        biddingTokenAddress: biddingToken.address,
        brokerAddress: broker.address,
        gnosisAuctionAddress: GNOSIS_AUCTION_ADDRESS.mainnet,
      });

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/set up collateral"); //              |
      //                                                    |
      // ----------------------------------------------------
      // from auctioneerSigner, approve the value of collateral to the broker contract
      await collateralToken
        .connect(auctioneerSigner)
        .increaseAllowance(broker.address, collateralData.collateralAmount);
      expect(
        await collateralToken.balanceOf(auctioneerSigner.address)
      ).to.be.eq(ethers.utils.parseEther("100"));
      const depositCollateralTx = await broker
        .connect(auctioneerSigner)
        .depositCollateral(collateralData);

      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      expect(
        await collateralToken.balanceOf(auctioneerSigner.address)
      ).to.be.eq(0);

      expect(depositCollateralTx, "Collateral deposited")
        .to.emit(broker, "CollateralDeposited")
        .withArgs(
          auctioneerSigner.address,
          collateralToken.address,
          collateralData.collateralAmount
        );

      // The deposited collateral should exist in the broker contract
      expect(
        await broker.collateralInContract(
          auctioneerSigner.address,
          collateralToken.address
        ),
        "Collateral in contract"
      ).to.be.equal(collateralData.collateralAmount);

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/set up gnosis auction"); //          |
      //                                                    |
      // ----------------------------------------------------

      const auctionCounter = (await gnosisAuction.auctionCounter()).toNumber();
      // This creates the GnosisAuction and returns the auctionId of the newly created auction
      const { auctionId, porterBondAddress } = await createAuctionWithDefaults(
        auctioneerSigner,
        biddingToken,
        collateralData,
        broker
      );

      // After the auction is created, the auctionCount should be auctionCounter + 1
      expect(auctionId, "GnosisAuction counter incremented").to.be.equal(
        auctionCounter + 1
      );

      // After the auction is created, the collateralInContract should be 0
      // (or in practice, the existing value minus the collateralAmount)
      expect(
        await broker.collateralInContract(
          auctioneerSigner.address,
          collateralToken.address
        ),
        "Collateral stored in contract"
      ).to.be.equal(0);

      // The collateralInAuction should be the collateralAmount (note the mapping looks up the auctionId)
      expect(
        await broker.collateralInAuction(auctionId, collateralToken.address),
        "Collateral stored in auction"
      ).to.be.equal(collateralData.collateralAmount);

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/place orders"); //                   |
      //                                                    |
      // ----------------------------------------------------

      // Give tokens from owner to bidders and approve for transfer to gnosis auction
      await createTokensAndMintAndApprove(
        gnosisAuction,
        biddingToken,
        owner,
        bidders
      );

      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      // create sell orders for all bidders addresses
      const userId = (
        await (await gnosisAuction.getUserId(bidders[0].address)).wait()
      ).events[0]?.args?.userId;
      const sellOrder = {
        sellAmount: ethers.utils.parseEther("50"),
        buyAmount: ethers.utils.parseEther("1"),
        userId: BigNumber.from(userId),
      };

      await placeOrders(gnosisAuction, [sellOrder], auctionId, bidders);
      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/close auction"); //                  |
      //                                                    |
      // ----------------------------------------------------

      // This increases the time to the end of the auction
      await closeAuction(gnosisAuction, auctionId);

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/partially settle orders"); //        |
      //                                                    |
      // ----------------------------------------------------

      // This settles some of the orders and moves the queue element
      // there is an order left over (bidders.length - 1) because there needs to be
      // at least one order left over to be able to settle the auction
      // await gnosisAuction.precalculateSellAmountSum(
      //   auctionId,
      //   bidders.length - 1
      // );

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/settle auction"); //                 |
      //                                                    |
      // ----------------------------------------------------
      const settleTx = await gnosisAuction.settleAuction(auctionId);
      expect(settleTx).to.emit(gnosisAuction, "AuctionCleared");

      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/check results"); //                  |
      //                                                    |
      // ----------------------------------------------------

      console.log({ auctionId }, await gnosisAuction.auctionData(auctionId));
      console.log(await (await ethers.provider.getBlock("latest")).timestamp);

      // TODO: not sure what to expect here, probably something with getting the settlement amount
      // and checking that each bidder has the correct amount of tokens for now
      // confirm that there is a change in porterBonds

      // before claiming from all orders, the bidding token should be 0
      expect(
        await porterBond.attach(porterBondAddress).balanceOf(bidders[0].address)
      ).to.be.eq(0);

      console.log("e2e/claimOrder", sellOrder);
      const claimTx = await gnosisAuction.claimFromParticipantOrder(auctionId, [
        encodeOrder(sellOrder),
      ]);
      expect(claimTx).to.emit(gnosisAuction, "ClaimedFromOrder");

      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      // after, the bond token should be assigned to the account
      expect(
        await porterBond.attach(porterBondAddress).balanceOf(bidders[0].address)
      ).to.be.gt(0);

      // ----------------------------------------------------
      //                                                    |
      console.log("e2e/redeem collateral"); //              |
      //                                                    |
      // ----------------------------------------------------
      expect(
        await collateralToken.balanceOf(auctioneerSigner.address),
        "collateral in auction"
      ).to.be.eq(0);

      increaseTime(addDaysToNow(2).toNumber()); // ⌚️⌚️⌚️ Time passes... ⌚️⌚️⌚️

      const redeemTx = await broker
        .connect(auctioneerSigner)
        .redeemCollateralFromAuction(auctionId, collateralToken.address);

      await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

      expect(redeemTx).to.emit(broker, "CollateralRedeemed");

      expect(
        await collateralToken.balanceOf(auctioneerSigner.address),
        "collateral in auctioneer"
      ).to.be.eq(collateralData.collateralAmount);
    });
  });
});