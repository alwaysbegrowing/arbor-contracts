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
