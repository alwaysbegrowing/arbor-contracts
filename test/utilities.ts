import { BigNumber, Contract, ContractTransaction, Event } from "ethers";
import { use } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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
}

export interface CollateralData {
  collateralAddress: string;
  collateralAmount: BigNumber;
  bondAddress: string;
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
  broker: Contract
) => {
  const auctionData: AuctionData = {
    _biddingToken: biddingToken.address,
    orderCancellationEndDate: addDaysToNow(1),
    auctionEndDate: addDaysToNow(2),
    _auctionedSellAmount: ethers.utils.parseEther("100"),
    _minBuyAmount: ethers.utils.parseEther("1"),
    minimumBiddingAmountPerOrder: ethers.utils.parseEther(".01"),
    minFundingThreshold: ethers.utils.parseEther("30"),
    isAtomicClosureAllowed: false,
    accessManagerContract: ethers.constants.AddressZero,
    accessManagerContractData: ethers.utils.arrayify("0x00"),
  };
  const bondData: BondData = {
    bondContract: ethers.constants.AddressZero,
  };

  // act
  const tx = await broker
    .connect(signer)
    .createAuction(auctionData, bondData, collateralData);

  await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

  const receipt = await tx.wait();
  const { auctionId, porterBondAddress } = receipt.events.find(
    (e: Event) => e.event === "AuctionCreated"
  )?.args;

  return {
    auctionId,
    porterBondAddress,
  };
};

export const createAuction = async (
  broker: Contract,
  auctioneer: SignerWithAddress,
  auctionData: AuctionData,
  bondAddress: string
) => {
  // act
  const tx = await broker
    .connect(auctioneer)
    .createAuction(auctionData, bondAddress);

  await mineBlock(); // ⛏⛏⛏ Mining... ⛏⛏⛏

  const receipt = await tx.wait();
  const { auctionId, porterBondAddress } = receipt.events.find(
    (e: Event) => e.event === "AuctionCreated"
  )?.args;

  return {
    auctionId,
    porterBondAddress,
  };
};

export const queueStartElement =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export async function placeOrders(
  gnosisAuction: Contract,
  sellOrders: Order[],
  auctionId: BigNumber,
  bidders: SignerWithAddress[]
): Promise<void> {
  for (let i = 0; i < sellOrders.length; i++) {
    const sellOrder = sellOrders[i];
    await gnosisAuction
      .connect(bidders[0])
      .placeSellOrders(
        auctionId,
        [sellOrder.buyAmount],
        [sellOrder.sellAmount],
        [queueStartElement],
        "0x"
      );
  }
}

export const createTokensAndMintAndApprove = async (
  gnosisAuction: Contract,
  biddingToken: Contract,
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
  gnosisAuction: Contract,
  auctionId: BigNumber
): Promise<void> => {
  const timeRemaining = (
    await gnosisAuction.getSecondsRemainingInBatch(auctionId)
  ).toNumber();
  await increaseTime(timeRemaining + 1);
};

export async function mineBlock(): Promise<void> {
  ethers.provider.send("evm_mine", []);
}

export function encodeOrder(order: Order): string {
  return (
    "0x" +
    order.userId.toHexString().slice(2).padStart(16, "0") +
    order.buyAmount.toHexString().slice(2).padStart(24, "0") +
    order.sellAmount.toHexString().slice(2).padStart(24, "0")
  );
}

export async function getEventArgumentsFromTransaction(
  tx: ContractTransaction,
  eventName: string
): Promise<any> {
  const receipt = await tx.wait();
  const args = receipt?.events?.find((e: Event) => e.event === eventName)?.args;
  if (args) return args;
  console.error(`No event with name ${eventName} found in transaction`);
  return {};
}

export const getBondContract = async (tx: Promise<any>) => {
  const [owner] = await ethers.getSigners();
  const [newBondAddress] = await getEventArgumentsFromTransaction(
    await tx,
    "BondCreated"
  );

  return await ethers.getContractAt("SimpleBond", newBondAddress, owner);
};

declare global {
  export namespace Chai {
    // eslint-disable-next-line no-unused-vars
    interface Assertion {
      revertedWithArgs(errorName: string, ...args: any): Promise<void>;
    }
  }
}
export async function useCustomErrorMatcher() {
  use(function (chai) {
    chai.Assertion.addMethod("revertedWithArgs", function (errorName, ...args) {
      const expected = `${errorName}(${args
        .map((arg) => JSON.stringify(arg))
        .join(", ")})`;
      new chai.Assertion(this._obj).to.be.revertedWith(expected);
    });
  });
}
