import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestERC20, BondFactoryClone, SimpleBond } from "../typechain";
import { getBondContract } from "./utilities";

export const deployNATIVEandREPAY = async (owner: SignerWithAddress) => {
  const MockErc20Contract = await ethers.getContractFactory("TestERC20");
  console.log("factory");
  const native = (await MockErc20Contract.connect(owner).deploy(
    "Native Token",
    "NATIVE",
    ethers.utils.parseUnits("50000000", 20),
    18
  )) as TestERC20;
  console.log({ native: native.address });
  await native.deployed();

  const repay = (await MockErc20Contract.connect(owner).deploy(
    "Repayment Token",
    "REPAY",
    ethers.utils.parseUnits("500"),
    18
  )) as TestERC20;
  await repay.deployed();
  return await Promise.all([native, repay]);
};

export const createBond = async (
  owner: SignerWithAddress,
  nativeToken: TestERC20,
  repaymentToken: TestERC20,
  factory: BondFactoryClone
) => {
  // these could be converted to parameters
  const bondName = "Always be growing";
  const bondSymbol = "LEARN";
  const collateralRatio = ethers.utils.parseUnits(".5", 18);
  const convertibilityRatio = ethers.utils.parseUnits(".5", 18);
  const maturityDate = Math.round(
    new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
      1000
  );
  const maxSupply = ethers.utils.parseUnits("50000000", 18);

  const issuerRole = await factory.ISSUER_ROLE();
  const grantRoleTx = await factory
    .connect(owner)
    .grantRole(issuerRole, owner.address);
  await grantRoleTx.wait();

  const bond = await getBondContract(
    factory
      .connect(owner)
      .createBond(
        bondName,
        bondSymbol,
        owner.address,
        maturityDate,
        repaymentToken.address,
        nativeToken.address,
        collateralRatio,
        convertibilityRatio,
        maxSupply
      )
  );
  return await bond;
};

export const mint = async (
  owner: SignerWithAddress,
  nativeToken: TestERC20,
  bond: SimpleBond
) => {
  const approveTx = await nativeToken
    .connect(owner)
    .approve(bond.address, ethers.constants.MaxUint256);
  await approveTx.wait();

  const mintRole = await bond.MINT_ROLE();
  const grantRoleTx = await bond
    .connect(owner)
    .grantRole(mintRole, owner.address);
  await grantRoleTx.wait();

  const mintTx = await bond
    .connect(owner)
    .mint(ethers.utils.parseUnits("50000000", 18));
  return await mintTx.wait();
};

export const initiateAuction = async (
  auction: Contract,
  owner: SignerWithAddress,
  bond: SimpleBond,
  borrowToken: TestERC20
) => {
  const auctioningToken = bond.address;
  const biddingToken = borrowToken.address;
  const orderCancellationEndDate = 0;
  // one day from today
  const auctionEndDate = Math.round(
    new Date(new Date().setDate(new Date().getDate() + 1)).getTime() / 1000
  );
  const _auctionedSellAmount = await bond.balanceOf(owner.address);
  const _minBuyAmount = 1000000000000000;
  const minimumBiddingAmountPerOrder = 1000000000000000;
  const minFundingThreshold = 0;
  const isAtomicClosureAllowed = false;
  const accessManagerContract = ethers.constants.AddressZero;
  const accessManagerContractData = ethers.constants.HashZero;
  const approveTx = await bond
    .connect(owner)
    .approve(auction.address, ethers.constants.MaxUint256);
  await approveTx.wait();

  const initiateAuctionTx = await auction
    .connect(owner)
    .initiateAuction(
      auctioningToken,
      biddingToken,
      orderCancellationEndDate,
      auctionEndDate,
      _auctionedSellAmount,
      _minBuyAmount,
      minimumBiddingAmountPerOrder,
      minFundingThreshold,
      isAtomicClosureAllowed,
      accessManagerContract,
      accessManagerContractData
    );
  return initiateAuctionTx;
};
