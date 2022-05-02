import { task } from "hardhat/config";
import { easyAuctionAbi, mumbaiGnosis } from "../test/constants";
import { Bond } from "../typechain";

task("settle-auction", "Settles auction if it can be settled.")
  .addParam("auctionId", "The ID of the auction to settle.")
  .setAction(async ({ auctionId }, hre) => {
    const { ethers } = hre;
    const auction = await ethers.getContractAt(easyAuctionAbi, mumbaiGnosis);
    try {
      const auctionData = await auction.auctionData(auctionId);
      const { auctioningToken, auctionEndDate } = auctionData;
      console.log(auctionEndDate);
      await (await auction.settleAuction(auctionId)).wait();

      const bond = (await ethers.getContractAt(
        "Bond",
        auctioningToken
      )) as Bond;

      console.log(`
Settling auction for ${await bond.symbol()}.
`);
    } catch (e) {
      console.log(e);
      console.log(`Failed to settle auction.`);
    }
  });
