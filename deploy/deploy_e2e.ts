import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Bond, BondFactory, TestERC20 } from "../typechain";
import {
  createBond,
  getBondInfo,
  initiateAuction,
  placeManyOrders,
  waitUntilMined,
} from "../test/utilities";
import {
  addresses,
  easyAuctionAbi,
  FIFTY_MILLION,
  TEN_MILLION,
  TEN_MINUTES_FROM_NOW_IN_SECONDS,
  TWENTY_FIVE_MILLION,
} from "../test/constants";
import { BondDeploymentConfiguration } from "../test/interfaces";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
  network,
}: HardhatRuntimeEnvironment) {
  // Configuration used for this deployment
  const DECIMALS = 6;
  const {
    bondConfig,
    auctionConfig,
    biddingConfig,
  }: BondDeploymentConfiguration = {
    bondConfig: {
      collateralTokenAmount: ethers.utils.parseUnits(
        TEN_MILLION.toString(),
        DECIMALS
      ),
      convertibleTokenAmount: ethers.utils.parseUnits(
        (1_000_000).toString(),
        DECIMALS
      ),
      maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      maxSupply: ethers.utils.parseUnits(FIFTY_MILLION.toString(), DECIMALS),
    },
    auctionConfig: {
      auctionEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      orderCancellationEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      minFundingThreshold: ethers.utils.parseUnits(
        TWENTY_FIVE_MILLION,
        DECIMALS
      ),
    },
    biddingConfig: {},
  };

  const { get } = deployments;

  // Get the named accounts from hardhat.config.js
  const { deployer, bondHolder } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer);
  const bondHolderSigner = await ethers.getSigner(bondHolder);

  // Get the deployed BondFactory's address from deploy_bond_factory
  const { address: bondFactoryAddress } = await get("BondFactory");

  // Get the BondFactory contract to create a bond
  const factory = (await ethers.getContractAt(
    "BondFactory",
    bondFactoryAddress
  )) as BondFactory;

  // Get the deployed paymentToken and collateralToken contracts deployed
  // in deploy_payment_token & deploy_collateral_token
  const { address: paymentTokenAddress } = await get("PaymentToken");
  const paymentTokenContract = (await ethers.getContractAt(
    "TestERC20",
    paymentTokenAddress
  )) as TestERC20;
  const { address: collateralTokenAddress } = await get("CollateralToken");
  const collateralTokenContract = (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;

  // Create the bond symbol from its constituent parts
  const { bondSymbol } = await getBondInfo(
    paymentTokenContract,
    collateralTokenContract,
    bondConfig
  );

  // Create a bond from the bond factory with the configuration
  const { address: bondAddress } = await createBond(
    bondConfig,
    factory,
    paymentTokenContract,
    collateralTokenContract
  );

  // Get the bond contract to perform actions upon
  const bond = (await ethers.getContractAt("Bond", bondAddress)) as Bond;
  console.log(`Deployed a ${bondSymbol} bond @ (${bondAddress}).`);

  // Transfer bonds to the beneficiaries from the env file. This is to get
  // bonds to the gnosis safe for testing the auction later.
  if (process.env.DEPLOYMENT_BENEFICIARIES) {
    console.log(`Transferring bond tokens to beneficiaries.`);

    const beneficiaries = process.env.DEPLOYMENT_BENEFICIARIES.split(",");
    for (const beneficiary of beneficiaries) {
      if ((await bond.balanceOf(beneficiary)).gt(0)) {
        continue;
      }
      await waitUntilMined(
        await bond.transfer(
          beneficiary,
          ethers.utils.parseUnits((1_000_000).toString(), DECIMALS)
        )
      );
      console.log(`Transferred bond tokens to ${beneficiary}.`);
    }
  }

  // Create an auction and place bids. This uses half of the deployer's supply
  const auction = await ethers.getContractAt(
    easyAuctionAbi,
    addresses.EasyAuction[network.name]
  );
  if ((await paymentTokenContract.allowance(deployer, auction.address)).eq(0)) {
    console.log(`Approving auction (${auction.address}) for payment token.`);
    await waitUntilMined(
      await paymentTokenContract.approve(
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
      deployerSigner,
      bond,
      paymentTokenContract,
      auctionConfig
    )
  );

  let auctionId = "0";
  try {
    auctionId = await auction.auctionCounter();
  } catch (error) {
    console.log("Error with auction, are you on testnet or forking hardhat?");
  }

  const auctionData = await auction.auctionData(auctionId);
  const {
    auctioningToken,
    biddingToken,
    orderCancellationEndDate,
    auctionEndDate,
  } = auctionData;

  console.log(`
  Created auction ${auctionId} for ${bondAddress}.
  auctioningToken: ${auctioningToken}
  biddingToken: ${biddingToken}
  orderCancellationEndDate: ${orderCancellationEndDate}
  auctionEndDate: ${auctionEndDate}
  `);

  const nrOfOrders = 100;
  await placeManyOrders({
    signer: deployerSigner,
    auction,
    auctionId,
    auctionData,
    biddingToken: paymentTokenContract,
    auctioningToken: bond,
    // the price is sellAmount/buyAmount so ~9000/1000 = .9 each
    sellAmount: biddingConfig.sellAmount || (9_000).toString(),
    minBuyAmount: biddingConfig.minBuyAmount || (10_000).toString(),
    nrOfOrders: biddingConfig.nrOfOrders || nrOfOrders,
  });
  console.log("Placed auction bids.");

  // Send the remaining bond tokens to a Bond Holder to test convert, transfer,
  // redeem, and be left with 0 bonds.
  await (await bond.transfer(bondHolder, (1_000_000).toString())).wait();
  console.log("Transferred remaining bonds to bond holder.");

  await (
    await bond
      .connect(bondHolderSigner)
      .approve(bond.address, (1_000_000).toString())
  ).wait();

  await (
    await bond.connect(bondHolderSigner).convert((250_000).toString())
  ).wait();
  console.log("Bond Holder converted 1/4 remaining bonds");

  const amountUnpaid = await bond.amountUnpaid();
  await (await paymentTokenContract.approve(bond.address, amountUnpaid)).wait();
  await (await bond.pay(amountUnpaid)).wait();
  console.log("Pay off the bond");

  if (network.live) {
    console.log("Waiting for auction to end and bond to mature...");
    console.log("Create a Gnosis Safe bid for the auction now.");
    await new Promise((resolve) => setTimeout(resolve, 6 * 60 * 1000));
    await (await auction.settleAuction(auctionId)).wait();
    console.log(
      "Time's up! Claim the bid from the gnosis safe and try to convert some bonds."
    );
  } else {
    const gracePeriodEnd = await (await bond.gracePeriodEnd()).toNumber();
    await ethers.provider.send("evm_mine", [gracePeriodEnd]);
    await (await auction.settleAuction(auctionId)).wait();
  }

  await (
    await bond.connect(bondHolderSigner).redeem((250_000).toString())
  ).wait();
  console.log("Bond holder redeemed bonds.");
  await (
    await bond
      .connect(bondHolderSigner)
      .transfer(deployer, (500_000).toString())
  ).wait();
  console.log("Bond holder transferred bonds.");

  await (await bond.redeem(await bond.balanceOf(deployer))).wait();
  console.log("Issuer and bond holder redeemed bonds.");
};

module.exports.tags = ["e2e"];
module.exports.dependencies = ["permissions"];
