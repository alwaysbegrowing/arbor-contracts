import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  deploymentBonds,
  easyAuctionAbi,
  rinkebyGnosis,
} from "../test/constants";
import { Bond, TestERC20 } from "../typechain";
import {
  getBondInfo,
  initiateAuction,
  placeManyOrders,
  waitUntilMined,
} from "../test/utilities";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();
  const { address: paymentTokenAddress } = await get("PaymentToken");
  const paymentToken = (await ethers.getContractAt(
    "TestERC20",
    paymentTokenAddress
  )) as TestERC20;
  const { address: collateralTokenAddress } = await get("CollateralToken");
  const collateralToken = (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;
  for (let i = 0; i < deploymentBonds.length; i++) {
    const { bondConfig, auctionConfig, biddingConfig } = deploymentBonds[i];
    const { bondSymbol } = await getBondInfo(
      paymentToken,
      collateralToken,
      bondConfig
    );
    const { address } = await deployments.get(bondSymbol);
    const bond = (await ethers.getContractAt("Bond", address)) as Bond;
    const auction = await ethers.getContractAt(easyAuctionAbi, rinkebyGnosis);
    const signer = await ethers.getSigner(deployer);
    try {
      if ((await paymentToken.allowance(deployer, auction.address)).eq(0)) {
        console.log(
          `Approving auction (${auction.address}) for payment token.`
        );
        await waitUntilMined(
          await paymentToken.approve(
            auction.address,
            ethers.constants.MaxUint256
          )
        );
      } else {
        console.log(`Auction already approved for token.`);
      }

      await waitUntilMined(
        await initiateAuction(
          auction,
          signer,
          bond,
          paymentToken,
          auctionConfig
        )
      );
      const auctionId = await auction.auctionCounter();
      const auctionData = await auction.auctionData(auctionId);
      const {
        auctioningToken,
        biddingToken,
        orderCancellationEndDate,
        auctionEndDate,
      } = auctionData;
      console.log(`
Created auction ${auctionId} for ${address}.
auctioningToken: ${auctioningToken}
biddingToken: ${biddingToken}
orderCancellationEndDate: ${orderCancellationEndDate}
auctionEndDate: ${auctionEndDate}
`);
      const nrOfOrders = 100;
      await placeManyOrders({
        signer,
        auction,
        auctionId,
        auctionData,
        biddingToken: paymentToken,
        auctioningToken: bond,
        // the price is sellAmount/buyAmount so ~9000/1000 = .9 each
        sellAmount: biddingConfig.sellAmount || (9_000).toString(),
        minBuyAmount: biddingConfig.minBuyAmount || (10_000).toString(),
        nrOfOrders: biddingConfig.nrOfOrders || nrOfOrders,
      });
    } catch (e) {
      console.log(e);
      console.log(
        `Failed to create auction for ${address}.
Are you on the network corresponding to the auction address?`
      );
    }
  }
};

module.exports.tags = ["auctions"];
module.exports.dependencies = ["bonds"];
