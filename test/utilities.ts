import { BigNumber, BigNumberish, ContractTransaction, Event } from "ethers";
import { use, expect } from "chai";
import { ethers } from "hardhat";
import { Bond, TestERC20 } from "../typechain";
import { BondConfigType } from "./interfaces";
import { ONE } from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const addDaysToNow = (days: number = 0) => {
  return BigNumber.from(
    Math.floor(new Date().getTime() / 1000) + days * 24 * 60 * 60
  );
};

export async function increaseTime(duration: number): Promise<void> {
  ethers.provider.send("evm_increaseTime", [duration]);
  ethers.provider.send("evm_mine", []);
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

export const getBondContract = async (tx: Promise<any>): Promise<Bond> => {
  const [owner] = await ethers.getSigners();

  const [newBondAddress] = await getEventArgumentsFromTransaction(
    await tx,
    "BondCreated"
  );

  return (await ethers.getContractAt("Bond", newBondAddress, owner)) as Bond;
};

export const getTargetCollateral = (bondConfig: BondConfigType): BigNumber => {
  const { targetBondSupply, collateralRatio } = bondConfig;
  return targetBondSupply.mul(collateralRatio).div(ONE);
};

export const getTargetConvertibleCollateral = (
  bondConfig: BondConfigType
): BigNumber => {
  const { targetBondSupply, convertibleRatio } = bondConfig;
  return targetBondSupply.mul(convertibleRatio).div(ONE);
};

export const getTargetPayment = (
  bondConfig: BondConfigType,
  decimals: BigNumberish
): BigNumber => {
  const { targetBondSupply } = bondConfig;
  return targetBondSupply.mul(ethers.utils.parseUnits("1", decimals)).div(ONE);
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

export const previewMintAndMint = async ({
  bond,
  collateralToken,
  mintAmount,
  collateralToDeposit,
}: {
  bond: Bond;
  collateralToken: TestERC20;
  mintAmount: BigNumber;
  collateralToDeposit: BigNumber;
}) => {
  expect(await bond.previewMintBeforeMaturity(mintAmount)).to.equal(
    collateralToDeposit
  );
  await expect(bond.mint(mintAmount)).to.not.be.reverted;
  expect(await bond.totalSupply()).to.equal(mintAmount);
  expect(await collateralToken.balanceOf(bond.address)).to.be.equal(
    collateralToDeposit
  );
};

export const failPreviewMint = async ({
  bond,
  mintAmount,
  collateralToDeposit,
}: {
  bond: Bond;
  mintAmount: BigNumber;
  collateralToDeposit: BigNumber;
}) => {
  expect(await bond.previewMintBeforeMaturity(mintAmount)).to.not.equal(
    collateralToDeposit
  );
};

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
  expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
};

export const payAndWithdrawAtMaturity = async ({
  paymentToken,
  bond,
  paymentTokenAmount,
  collateralToReceive,
  maturityDate,
}: {
  paymentToken: TestERC20;
  bond: Bond;
  paymentTokenAmount: BigNumber;
  collateralToReceive: BigNumber;
  maturityDate: BigNumberish;
}) => {
  await paymentToken.approve(bond.address, paymentTokenAmount);
  await (await bond.pay(paymentTokenAmount)).wait();
  await ethers.provider.send("evm_mine", [maturityDate]);
  expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
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
  expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
};

export const redeemAtMaturity = async ({
  bond,
  sharesToRedeem,
  paymentTokenToSend,
  collateralTokenToSend,
  maturityDate,
}: {
  bond: Bond;
  sharesToRedeem: BigNumber;
  paymentTokenToSend: BigNumber;
  collateralTokenToSend: BigNumber;
  maturityDate: BigNumberish;
}) => {
  await ethers.provider.send("evm_mine", [maturityDate]);

  const [paymentToken, collateralToken] = await bond.previewRedeemAtMaturity(
    sharesToRedeem
  );
  expect(paymentToken).to.equal(paymentTokenToSend);
  expect(collateralToken).to.equal(collateralTokenToSend);
};
