import { ethers } from "hardhat";
import { BondFactoryClone, ERC20, TestERC20 } from "../../typechain";

export async function bondFactoryFixture() {
  const BondFactoryClone = await ethers.getContractFactory("BondFactoryClone");
  const factory = (await BondFactoryClone.deploy()) as BondFactoryClone;
  return { factory };
}

export async function tokenFixture(decimals: number[]) {
  // always make 18 decimal tokens
  const decimalsToCreate = Array.from(new Set([18].concat(decimals)));
  const tokens = await Promise.all(
    decimalsToCreate.map(async (decimals) => {
      const RepaymentToken = await ethers.getContractFactory("TestERC20");
      const repaymentToken = (await RepaymentToken.deploy(
        "Repayment Token",
        "RT",
        ethers.constants.MaxUint256,
        decimals
      )) as TestERC20;

      const [, , attacker] = await ethers.getSigners();
      const AttackingToken = await ethers.getContractFactory("TestERC20");
      const attackingToken = (await AttackingToken.connect(attacker).deploy(
        "Attack Token",
        "AT",
        ethers.constants.MaxUint256,
        decimals
      )) as TestERC20;

      const BackingToken = await ethers.getContractFactory("TestERC20");
      const backingToken = (await BackingToken.deploy(
        "Backing Token",
        "BT",
        ethers.constants.MaxUint256,
        decimals
      )) as TestERC20;

      return {
        repaymentToken,
        attackingToken,
        backingToken,
        decimals,
      };
    })
  );

  return { tokens };
}

export async function convertToCurrencyDecimals(token: ERC20, amount: string) {
  const decimals = await token.decimals();
  return ethers.utils.parseUnits(amount, decimals);
}
