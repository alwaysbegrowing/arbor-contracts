import { ethers } from "hardhat";
import { BondFactoryClone, ERC20, TestERC20 } from "../../typechain";

export async function bondFactoryFixture() {
  const BondFactoryClone = await ethers.getContractFactory("BondFactoryClone");
  const factory = (await BondFactoryClone.deploy()) as BondFactoryClone;
  return { factory };
}

export async function tokenFixture() {
  const BorrowingToken = await ethers.getContractFactory("TestERC20");
  const borrowingToken = (await BorrowingToken.deploy(
    "Borrowing Token",
    "BT",
    ethers.utils.parseEther("200000000"),
    18
  )) as TestERC20;

  const [, , attacker] = await ethers.getSigners();
  const AttackingToken = await ethers.getContractFactory("TestERC20");
  const attackingToken = (await AttackingToken.connect(attacker).deploy(
    "Attack Token",
    "AT",
    ethers.utils.parseEther("2000000000"),
    20
  )) as TestERC20;

  const NativeToken = await ethers.getContractFactory("TestERC20");
  const nativeToken = (await NativeToken.deploy(
    "Native Token",
    "NT",
    ethers.utils.parseEther("2000000000"),
    18
  )) as TestERC20;

  const MockUSDCToken = await ethers.getContractFactory("TestERC20");
  const mockUSDCToken = (await MockUSDCToken.deploy(
    "USDC",
    "USDC",
    ethers.utils.parseEther("2000000000"),
    6
  )) as TestERC20;

  return { borrowingToken, attackingToken, nativeToken, mockUSDCToken };
}

export async function convertToCurrencyDecimals(token: ERC20, amount: string) {
  const decimals = await token.decimals();
  return ethers.utils.parseUnits(amount, decimals);
}
