import { BigNumber, Contract, Event } from "ethers";

import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export interface Price {
  priceNumerator: BigNumber;
  priceDenominator: BigNumber;
}

export interface ReceivedFunds {
  auctioningTokenAmount: BigNumber;
  biddingTokenAmount: BigNumber;
}

export interface OrderResult {
  auctioningToken: string;
  biddingToken: string;
  auctionEndDate: BigNumber;
  orderCancellationEndDate: BigNumber;
  initialAuctionOrder: string;
  minimumBiddingAmountPerOrder: BigNumber;
  interimSumBidAmount: BigNumber;
  interimOrder: string;
  clearingPriceOrder: string;
  volumeClearingPriceOrder: BigNumber;
  feeNumerator: BigNumber;
}

export interface Order {
  sellAmount: BigNumber;
  buyAmount: BigNumber;
  userId: BigNumber;
}

export const createAuctionWithDefaults = async (
  biddingToken: Contract,
  auction: Contract
) => {
  const biddingTokenAddress = biddingToken.address;
  const orderCancellationEndDate = 1619195139;
  const auctionEndDate = 1819195139;
  const _auctionedSellAmount = ethers.utils.parseEther("10");
  const _minBuyAmount = ethers.utils.parseEther("1");
  const minimumBiddingAmountPerOrder = ethers.utils.parseEther(".01");
  const minFundingThreshold = ethers.utils.parseEther("1");
  const isAtomicClosureAllowed = false;
  const allowListManager = ethers.constants.AddressZero;
  const allowListData = ethers.constants.AddressZero;

  // act
  const tx = await auction.createAuction(
    biddingTokenAddress,
    orderCancellationEndDate,
    auctionEndDate,
    _auctionedSellAmount,
    _minBuyAmount,
    minimumBiddingAmountPerOrder,
    minFundingThreshold,
    isAtomicClosureAllowed,
    allowListManager,
    allowListData
  );
  const receipt = await tx.wait();

  const auctionId = receipt.events.find(
    (e: Event) => e.event === "AuctionCreated"
  ).args.auctionId;
  const auctioningTokenAddress = receipt.events.find(
    (e: Event) => e.event === "TokenDeployed"
  ).args.tokenAddress;

  return {
    auctionId,
    auctioningTokenAddress,
  };
};

export const queueStartElement =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export const placeOrders = async (
  signer: SignerWithAddress,
  easyAuction: Contract,
  sellOrder: Order,
  auctionId: BigNumber,
  hre: HardhatRuntimeEnvironment
): Promise<any> => {
  return await easyAuction
    .connect(signer)
    .placeSellOrders(
      auctionId,
      [sellOrder.buyAmount],
      [sellOrder.sellAmount],
      [queueStartElement],
      "0x"
    );
};

export const createTokensAndMintAndApprove = async (
  easyAuction: Contract,
  biddingToken: Contract,
  owner: SignerWithAddress,
  users: SignerWithAddress[],
  hre: HardhatRuntimeEnvironment
): Promise<void> => {
  for (const user of users) {
    await biddingToken
      .connect(owner)
      .transfer(user.address, ethers.utils.parseEther("10"));

    await biddingToken
      .connect(user)
      .approve(easyAuction.address, ethers.utils.parseEther("10"));
  }
};

export async function increaseTime(duration: number): Promise<void> {
  ethers.provider.send("evm_increaseTime", [duration]);
  ethers.provider.send("evm_mine", []);
}

export const closeAuction = async (
  instance: Contract,
  auctionId: BigNumber
): Promise<void> => {
  const timeRemaining = (
    await instance.getSecondsRemainingInBatch(auctionId)
  ).toNumber();
  await increaseTime(timeRemaining + 1);
};

export function encodeOrder(order: Order): string {
  return (
    "0x" +
    order.userId.toHexString().slice(2).padStart(16, "0") +
    order.buyAmount.toHexString().slice(2).padStart(24, "0") +
    order.sellAmount.toHexString().slice(2).padStart(24, "0")
  );
}
