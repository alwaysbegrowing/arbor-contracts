import { ethers } from "hardhat";
import { BondFactoryClone, TestERC20 } from "../../typechain";
import { CollateralData } from "../utilities";

const EasyAuctionJSON = require("../../contracts/external/EasyAuction.json");
const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
  rinkeby: "0xc5992c0e0a3267c7f75493d0f717201e26be35f7",
};

export async function auctionFixture() {
  const gnosisAuction = await ethers.getContractAt(
    EasyAuctionJSON.abi,
    GNOSIS_AUCTION_ADDRESS.mainnet
  );
  return { gnosisAuction };
}

export async function bondFactoryFixture() {
  const BondFactoryClone = await ethers.getContractFactory("BondFactoryClone");
  const factory = (await BondFactoryClone.deploy()) as BondFactoryClone;
  return { factory };
}

export async function collateralTokenFixture() {
  const [owner] = await ethers.getSigners();

  const collateralData: CollateralData = {
    collateralAddress: ethers.constants.AddressZero,
    collateralAmount: ethers.utils.parseEther("1"),
    bondAddress: ethers.constants.AddressZero,
  };

  const CollateralToken = await ethers.getContractFactory("TestERC20");
  const collateralToken = (await CollateralToken.deploy(
    "Collateral Token",
    "CT",
    collateralData.collateralAmount
  )) as TestERC20;

  collateralData.collateralAddress = collateralToken.address;

  return { collateralData, collateralToken };
}

export async function borrowingTokenFixture() {
  const [owner] = await ethers.getSigners();

  const BorrowingToken = await ethers.getContractFactory("TestERC20");
  const borrowingToken = (await BorrowingToken.deploy(
    "Borrowing Token",
    "BT",
    ethers.utils.parseEther("2")
  )) as TestERC20;
  return { borrowingToken };
}

export async function attackingTokenFixture() {
  const [, , attacker] = await ethers.getSigners();

  const AttackingToken = await ethers.getContractFactory("TestERC20");
  const attackingToken = (await AttackingToken.connect(attacker).deploy(
    "Attack Token",
    "AT",
    ethers.utils.parseEther("2")
  )) as TestERC20;
  return { attackingToken };
}
