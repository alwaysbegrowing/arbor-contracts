import { BigNumber, Contract, Event } from "ethers";
import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BiddingToken, EasyAuction as GnosisAuction } from "../typechain";

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

export interface AuctionData {
  _biddingToken: string;
  orderCancellationEndDate: BigNumber;
  auctionEndDate: BigNumber;
  _auctionedSellAmount: BigNumber;
  _minBuyAmount: BigNumber;
  minimumBiddingAmountPerOrder: BigNumber;
  minFundingThreshold: BigNumber;
  isAtomicClosureAllowed: boolean;
  accessManagerContract: string;
  accessManagerContractData: Uint8Array;
}

export interface BondData {
  bondContract: string;
  maturityDate: BigNumber;
  maturityValue: BigNumber;
}

export interface CollateralData {
  collateralAddress: string;
  collateralAmount: BigNumber;
}
export const addDaysToNow = (days: number = 0) => {
  return BigNumber.from(
    Math.floor(new Date().getTime() / 1000) + days * 24 * 60 * 60
  );
};
export const createAuctionWithDefaults = async (
  signer: SignerWithAddress,
  biddingToken: Contract,
  collateralData: CollateralData,
  porterAuction: Contract
) => {
  const auctionData: AuctionData = {
    _biddingToken: biddingToken.address,
    orderCancellationEndDate: addDaysToNow(1),
    auctionEndDate: addDaysToNow(2),
    _auctionedSellAmount: ethers.utils.parseEther("100"),
    _minBuyAmount: ethers.utils.parseEther("1"),
    minimumBiddingAmountPerOrder: ethers.utils.parseEther(".01"),
    minFundingThreshold: ethers.utils.parseEther("1"),
    isAtomicClosureAllowed: false,
    accessManagerContract: ethers.constants.AddressZero,
    accessManagerContractData: ethers.utils.arrayify("0x00"),
  };
  const bondData: BondData = {
    bondContract: ethers.constants.AddressZero,
    maturityDate: addDaysToNow(3),
    maturityValue: BigNumber.from(1),
  };

  // act
  const tx = await porterAuction
    .connect(signer)
    .createAuction(auctionData, bondData, collateralData);
  const receipt = await tx.wait();
  const { auctionId, bondTokenAddress } = receipt.events.find(
    (e: Event) => e.event === "AuctionCreated"
  )?.args;

  return {
    auctionId,
    bondTokenAddress,
  };
};

export const queueStartElement =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export async function placeOrders(
  gnosisAuction: Contract,
  sellOrders: Order[],
  auctionId: BigNumber
): Promise<any[]> {
  return sellOrders.map(async (sellOrder: Order) => {
    const orderTx = await gnosisAuction
      .connect((await ethers.getSigners())[sellOrder.userId.toNumber()])
      .placeSellOrders(
        auctionId,
        [sellOrder.buyAmount],
        [sellOrder.sellAmount],
        [queueStartElement],
        "0x"
      );
    const orderRecipt = await orderTx.wait();
    const { buyAmount, sellAmount } = orderRecipt.events.find(
      (e: Event) => e.event === "NewSellOrder"
    )?.args;
    return { sellAmount, buyAmount };
  });
}

export const createTokensAndMintAndApprove = async (
  gnosisAuction: GnosisAuction,
  biddingToken: BiddingToken,
  owner: SignerWithAddress,
  bidders: SignerWithAddress[]
): Promise<void> => {
  for (const bidder of bidders) {
    await biddingToken
      .connect(owner)
      .transfer(bidder.address, ethers.utils.parseEther("100"));

    await biddingToken
      .connect(bidder)
      .approve(gnosisAuction.address, ethers.utils.parseEther("100"));
  }
};

export async function increaseTime(duration: number): Promise<void> {
  ethers.provider.send("evm_increaseTime", [duration]);
  ethers.provider.send("evm_mine", []);
}

export const closeAuction = async (
  gnosisAuction: GnosisAuction,
  auctionId: BigNumber
): Promise<void> => {
  const timeRemaining = (
    await gnosisAuction.getSecondsRemainingInBatch(auctionId)
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
