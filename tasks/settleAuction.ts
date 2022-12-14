import { task } from "hardhat/config";
import { easyAuctionAbi, addresses } from "../test/constants";

task("settle-auction", "Settles auction if it can be settled.")
  .addParam("auctionId", "The ID of the auction to settle.")
  .setAction(async ({ auctionId }, hre) => {
    const { ethers, network } = hre;
    const auction = await ethers.getContractAt(
      easyAuctionAbi,
      addresses.EasyAuction[network.name]
    );
    try {
      const auctionData = await auction.auctionData(auctionId);
      const { auctioningToken, auctionEndDate } = auctionData;
      console.log(auctionEndDate);
      await (await auction.settleAuction(auctionId)).wait();

      const bond = await ethers.getContractAt("Bond", auctioningToken);

      console.log(`
Settling auction for ${await bond.symbol()}.
`);
    } catch (e) {
      console.log(e);
      console.log(`Failed to settle auction.`);
    }
  });
