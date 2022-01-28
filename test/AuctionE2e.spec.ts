import { BigNumber, Contract, Event } from "ethers";

import hre, { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  closeAuction,
  createAuctionWithDefaults,
  createTokensAndMintAndApprove,
  encodeOrder,
  placeOrders,
} from "./utilities";

describe("Auction", async () => {
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let auction: Contract;
  let biddingToken: Contract;
  let collateralLockerFactory: Contract;
  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    const CollateralLockerFactory = await ethers.getContractFactory(
      "CollateralLockerFactory"
    );
    collateralLockerFactory = await CollateralLockerFactory.deploy();

    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy(collateralLockerFactory.address);

    const BiddingToken = await ethers.getContractFactory("QaraghandyToken");
    biddingToken = await BiddingToken.deploy(
      "BiddingToken",
      "BT",
      ethers.utils.parseEther("100000")
    );
  });
  describe("creating an auction", async () => {
    it("creates an auction, accepts orders, and settles auction", async () => {
      // setup
      const { auctionId, auctioningTokenAddress } =
        await createAuctionWithDefaults(
          biddingToken,
          auction,
          collateralLockerFactory.address
        );
      await createTokensAndMintAndApprove(
        auction,
        biddingToken,
        owner,
        [addr1],
        hre
      );
      const sellOrder = {
        sellAmount: ethers.utils.parseEther("10"),
        buyAmount: ethers.utils.parseEther("10"),
        userId: BigNumber.from(1),
      };
      const orderTx = await placeOrders(
        addr1,
        auction,
        sellOrder,
        auctionId,
        hre
      );
      const orderRecipt = await orderTx.wait();
      const sellAmount = orderRecipt.events.find(
        (e: Event) => e.event === "NewSellOrder"
      ).args.sellAmount;

      await closeAuction(auction, auctionId);
      const tx = await auction.settleAuction(auctionId);
      const gasUsed = (await tx.wait()).gasUsed;

      const claimTx = await auction.claimFromParticipantOrder(auctionId, [
        encodeOrder(sellOrder),
      ]);
      const claimRecipt = await claimTx.wait();
      console.log(claimRecipt);
      console.log("Gas usage for verification", gasUsed.toString());
      console.log(
        await biddingToken
          .attach(auctioningTokenAddress)
          .balanceOf(addr1.address)
      );
    });
  });
});
