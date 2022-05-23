import {
  BigNumber,
  constants,
  Contract,
  ContractReceipt,
  ContractTransaction,
  Event,
} from "ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Bond, BondFactory, TestERC20 } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { WAD } from "./constants";
import { BondConfigType, InitiateAuctionParameters } from "./interfaces";
import { parseUnits } from "ethers/lib/utils";
export const addDaysToNow = (days: number = 0) => {
  return BigNumber.from(
    Math.floor(new Date().getTime() / 1000) + days * 24 * 60 * 60
  );
};

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp]);
  await ethers.provider.send("evm_mine", []);
}

export async function mineBlock(): Promise<void> {
  ethers.provider.send("evm_mine", []);
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

export async function getEventArgumentsFromLoop(
  tx: ContractTransaction,
  eventName: string
): Promise<any> {
  const receipt = await tx.wait();
  const args = receipt?.events
    ?.filter((e: Event) => e.event === eventName)
    ?.map((e: Event) => e.args);
  if (args) return args;
  console.error(`No event with name ${eventName} found in transaction`);
  return {};
}

export const getBondContract = async (
  txPromise: Promise<ContractTransaction>
): Promise<Bond> => {
  const [owner] = await ethers.getSigners();
  const tx = await txPromise;
  if (process.env.LOG_GAS_USAGE) {
    logGasOptions(tx);
  }
  const [newBondAddress] = await getEventArgumentsFromTransaction(
    tx,
    "BondCreated"
  );
  return (await ethers.getContractAt("Bond", newBondAddress, owner)) as Bond;
};

/**
 * This function asserts a change of tokens occurs
 * @param tx a transaction to be executed
 * @param token an erc20 token to assert the balance change
 * @param signer the sender of the token balance transactions
 * @param address the address to check the balance of
 * @param delta the change in token expected
 */
export const expectTokenDelta = async (
  tx: Function,
  token: TestERC20,
  signer: SignerWithAddress,
  address: string,
  delta: BigNumber
): Promise<void> => {
  const balanceBefore = await token.connect(signer).balanceOf(address);
  await (await tx()).wait();
  const balanceAfter = await token.connect(signer).balanceOf(address);
  expect(balanceAfter.sub(balanceBefore).abs()).to.be.equal(delta);
};

declare global {
  export namespace Chai {
    // eslint-disable-next-line no-unused-vars
    interface Assertion {
      revertedWithArgs(errorName: string, ...args: any): Promise<void>;
    }
  }
}

export const payAndWithdraw = async ({
  paymentToken,
  bond,
  paymentTokenAmount,
  collateralToReceive,
}: {
  paymentToken: TestERC20;
  bond: Bond;
  paymentTokenAmount: BigNumber;
  collateralToReceive: BigNumber;
}) => {
  await paymentToken.approve(bond.address, paymentTokenAmount);
  await (await bond.pay(paymentTokenAmount)).wait();
  expect(await bond.previewWithdrawExcessCollateral()).to.equal(
    collateralToReceive
  );
};

export const burnAndWithdraw = async ({
  bond,
  sharesToBurn,
  collateralToReceive,
}: {
  bond: Bond;
  sharesToBurn: BigNumber;
  collateralToReceive: BigNumber;
}) => {
  await (await bond.burn(sharesToBurn)).wait();
  expect(await bond.previewWithdrawExcessCollateral()).to.equal(
    collateralToReceive
  );
};

export const redeemAndCheckTokens = async ({
  bond,
  bondHolder,
  paymentToken,
  collateralToken,
  sharesToRedeem,
  paymentTokenToSend,
  collateralTokenToSend,
}: {
  bond: Bond;
  bondHolder: SignerWithAddress;
  paymentToken: TestERC20;
  collateralToken: TestERC20;
  sharesToRedeem: BigNumber;
  paymentTokenToSend: BigNumber;
  collateralTokenToSend: BigNumber;
}) => {
  const collateralBalanceBefore = await collateralToken.balanceOf(
    bondHolder.address
  );
  const paymentBalanceBefore = await paymentToken.balanceOf(bondHolder.address);
  await bond.connect(bondHolder).redeem(sharesToRedeem);
  const collateralBalanceAfter = await collateralToken.balanceOf(
    bondHolder.address
  );
  const paymentBalanceAfter = await paymentToken.balanceOf(bondHolder.address);
  expect(collateralBalanceAfter.sub(collateralBalanceBefore).abs()).to.equal(
    collateralTokenToSend
  );
  expect(paymentBalanceAfter.sub(paymentBalanceBefore).abs()).to.equal(
    paymentTokenToSend
  );
};

export const mulWad = (x: BigNumber, y: BigNumber) => {
  return x.mul(y).div(WAD);
};

export const divWad = (x: BigNumber, y: BigNumber) => {
  return x.mul(y).div(WAD);
};

export const previewRedeem = async ({
  bond,
  sharesToRedeem,
  paymentTokenToSend,
  collateralTokenToSend,
}: {
  bond: Bond;
  sharesToRedeem: BigNumber;
  paymentTokenToSend: BigNumber;
  collateralTokenToSend: BigNumber;
}) => {
  const [paymentToken, collateralToken] = await bond.previewRedeemAtMaturity(
    sharesToRedeem
  );
  expect(paymentToken).to.equal(paymentTokenToSend);
  expect(collateralToken).to.equal(collateralTokenToSend);
};

export const getBondInfo = async (
  paymentToken: TestERC20,
  collateralToken: TestERC20,
  config: BondConfigType
): Promise<{ bondName: string; bondSymbol: string }> => {
  const collateralTokenSymbol = await collateralToken.symbol();
  const paymentTokenSymbol = await paymentToken.symbol();
  const isConvertible = config.convertibleTokenAmount.gt(0);
  const productNameShort = isConvertible ? "CONVERT" : "SIMPLE";
  const productNameLong = `${isConvertible ? "Convertible" : "Simple"} Bond`;
  const maturityDate = new Date(Number(config.maturity) * 1000)
    .toLocaleString("en-gb", {
      day: "2-digit",
      year: "numeric",
      month: "short",
    })
    .toUpperCase()
    .replace(/ /g, "");
  // This call value will be calculated on the front-end with acutal prices
  const bondName = `${getDAONameFromSymbol(
    collateralTokenSymbol
  )} ${productNameLong}`;
  const bondSymbol = `${collateralTokenSymbol.toUpperCase()} ${productNameShort} ${maturityDate}${
    isConvertible ? " 25C" : ""
  } ${paymentTokenSymbol.toUpperCase()}`;

  return {
    bondName,
    bondSymbol,
  };
};

export const createBond = async (
  config: BondConfigType,
  factory: BondFactory,
  paymentTokenContract: TestERC20,
  collateralTokenContract: TestERC20
) => {
  const paymentToken = paymentTokenContract.address;
  const collateralToken = collateralTokenContract.address;
  const { bondName, bondSymbol } = await getBondInfo(
    paymentTokenContract,
    collateralTokenContract,
    config
  );
  const bond = await getBondContract(
    factory.createBond(
      bondName,
      bondSymbol,
      config.maturity,
      paymentToken,
      collateralToken,
      config.collateralTokenAmount,
      config.convertibleTokenAmount,
      config.maxSupply
    )
  );
  return await bond;
};

export const initiateAuction = async (
  auction: Contract,
  owner: SignerWithAddress,
  bond: Bond,
  borrowToken: TestERC20,
  auctionParams?: InitiateAuctionParameters
) => {
  const auctioningToken =
    auctionParams?.auctioningToken?.address || bond.address;
  const biddingToken =
    auctionParams?.biddingToken?.address || borrowToken.address;
  // one day from today
  const orderCancellationEndDate =
    auctionParams?.orderCancellationEndDate ||
    Math.round(
      new Date(new Date().setDate(new Date().getDate() + 1)).getTime() / 1000
    );
  // one week from today
  const auctionEndDate =
    auctionParams?.auctionEndDate ||
    Math.round(
      new Date(new Date().setDate(new Date().getDate() + 7)).getTime() / 1000
    );
  const tokenBalance = await bond.balanceOf(owner.address);
  const auctionedSellAmount =
    auctionParams?.auctionedSellAmount || tokenBalance;
  const minBuyAmount =
    auctionParams?.minBuyAmount ||
    BigNumber.from(auctionedSellAmount).mul(8).div(10);
  const minimumBiddingAmountPerOrder =
    auctionParams?.minimumBiddingAmountPerOrder ||
    parseUnits((1_000).toString(), 6);
  const minFundingThreshold =
    auctionParams?.minFundingThreshold ||
    BigNumber.from(auctionedSellAmount).div(8);
  const isAtomicClosureAllowed = auctionParams?.isAtomicClosureAllowed || false;
  const allowListManager =
    auctionParams?.allowListManager || constants.AddressZero;
  const allowListData = auctionParams?.allowListData || constants.HashZero;
  const approveTx = await bond
    .connect(owner)
    .approve(auction.address, constants.MaxUint256);
  await approveTx.wait();

  const initiateAuctionTx = await auction
    .connect(owner)
    .initiateAuction(
      auctioningToken,
      biddingToken,
      orderCancellationEndDate,
      auctionEndDate,
      auctionedSellAmount,
      minBuyAmount,
      minimumBiddingAmountPerOrder,
      minFundingThreshold,
      isAtomicClosureAllowed,
      allowListManager,
      allowListData
    );
  return initiateAuctionTx;
};

export const placeManyOrders = async ({
  signer,
  auction,
  auctionId,
  auctionData,
  biddingToken,
  auctioningToken,
  sellAmount,
  minBuyAmount,
  nrOfOrders,
}: {
  signer: SignerWithAddress;
  auction: Contract;
  auctionId: string;
  auctionData: any;
  biddingToken: TestERC20;
  auctioningToken: TestERC20;
  sellAmount: string;
  minBuyAmount: string;
  nrOfOrders: number;
}) => {
  const minBuyAmountInAtoms = ethers.utils.parseUnits(
    minBuyAmount,
    await biddingToken.decimals()
  );
  const sellAmountsInAtoms = ethers.utils.parseUnits(
    sellAmount,
    await auctioningToken.decimals()
  );

  const orderBlockSize = 50;
  if (nrOfOrders % orderBlockSize !== 0) {
    throw new Error("nrOfOrders must be a multiple of orderBlockSize");
  }
  for (let i = 0; i < nrOfOrders / orderBlockSize; i += 1) {
    const minBuyAmounts = [];
    for (let j = 0; j < orderBlockSize; j++) {
      minBuyAmounts.push(
        minBuyAmountInAtoms.sub(
          BigNumber.from(i * orderBlockSize + j).mul(
            minBuyAmountInAtoms.div(nrOfOrders).div(10)
          )
        )
      );
    }

    const queueStartElement =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    await waitUntilMined(
      await auction
        .connect(signer)
        .placeSellOrders(
          auctionId,
          minBuyAmounts,
          Array(orderBlockSize).fill(sellAmountsInAtoms),
          Array(orderBlockSize).fill(queueStartElement),
          "0x"
        )
    );
  }
};

export const waitUntilMined = async (
  tx: ContractTransaction
): Promise<ContractReceipt> => {
  logGasOptions(tx);
  const receipt = await tx.wait();
  if (process.env.LOG_GAS_USAGE) {
    console.log(`⛏️ Transaction mined.
gas used:${receipt.gasUsed}
`);
  }
  return receipt;
};

export const logGasOptions = ({
  nonce,
  gasPrice,
  maxFeePerGas,
  maxPriorityFeePerGas,
}: ContractTransaction) => {
  if (process.env.LOG_GAS_USAGE) {
    console.log(`📒 Transaction sent.
  nonce: ${nonce}
  gas price: ${gasPrice}
  max fee: ${maxFeePerGas}
  max priority fee: ${maxPriorityFeePerGas}
`);
  }
};

export const getDAONameFromSymbol = (tokenSymbol: string): string => {
  return (
    {
      uni: "Uniswap",
    }[tokenSymbol.toLowerCase()] || tokenSymbol
  );
};
