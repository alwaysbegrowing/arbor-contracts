import { ethers } from "hardhat";
import { BondFactory, ERC20, TestERC20 } from "../../typechain";

export async function bondFactoryFixture() {
  const BondFactory = await ethers.getContractFactory("BondFactory");
  const factory = (await BondFactory.deploy()) as BondFactory;
  return { factory };
}

export async function tokenFixture(decimals: number[]) {
  // always make 18 decimal tokens
  const decimalsToCreate = Array.from(new Set([18].concat(decimals)));
  const tokens = await Promise.all(
    decimalsToCreate.map(async (decimals) => {
      const PaymentToken = await ethers.getContractFactory("TestERC20");
      const paymentToken = (await PaymentToken.deploy(
        "Payment Token",
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

      const CollateralToken = await ethers.getContractFactory("TestERC20");
      const collateralToken = (await CollateralToken.deploy(
        "Collateral Token",
        "BT",
        ethers.constants.MaxUint256,
        decimals
      )) as TestERC20;

      return {
        paymentToken,
        attackingToken,
        collateralToken,
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
