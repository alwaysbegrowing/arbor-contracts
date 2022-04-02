import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import { BondFactory, TestERC20 } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";
import { BondConfigType } from "./interfaces";
import { FIFTY_MILLION, THREE_YEARS_FROM_NOW_IN_SECONDS } from "./constants";
import { getTargetCollateral } from "./utilities";

const { ethers } = require("hardhat");

const BondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18), // 50 million bonds
  collateralRatio: BigNumber.from(0),
  convertibleRatio: BigNumber.from(0),
  maturityDate: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};

describe("BondFactory", async () => {
  let factory: BondFactory;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let collateralToken: TestERC20;
  let paymentToken: TestERC20;
  let ISSUER_ROLE: any;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    ({ factory } = await bondFactoryFixture());
    ({ collateralToken, paymentToken } = await (
      await tokenFixture([18])
    ).tokens[0]);
    ISSUER_ROLE = await factory.ISSUER_ROLE();
  });

  async function createBond(factory: BondFactory) {
    BondConfig.collateralRatio = utils.parseUnits("0.5", 18);
    BondConfig.convertibleRatio = utils.parseUnits("0.5", 18);
    await collateralToken.approve(
      factory.address,
      getTargetCollateral(BondConfig)
    );
    return factory.createBond(
      "Bond",
      "LUG",
      BondConfig.maturityDate,
      paymentToken.address,
      collateralToken.address,
      BondConfig.collateralRatio,
      BondConfig.convertibleRatio,
      BondConfig.maxSupply
    );
  }

  describe("#createBond", async () => {
    it("should allow only approved issuers to create a bond", async () => {
      await expect(createBond(factory)).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${ISSUER_ROLE}`
      );

      await factory.grantRole(ISSUER_ROLE, owner.address);

      await expect(createBond(factory)).to.emit(factory, "BondCreated");
    });

    it("should allow anyone to call createBond with allow list disabled", async () => {
      await expect(factory.setIsAllowListEnabled(false))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(false);
      expect(await factory.isAllowListEnabled()).to.be.equal(false);
      await collateralToken.transfer(
        user.address,
        await collateralToken.balanceOf(owner.address)
      );
      collateralToken
        .connect(user)
        .approve(
          factory.address,
          await collateralToken.balanceOf(user.address)
        );
      await expect(createBond(factory.connect(user))).to.emit(
        factory,
        "BondCreated"
      );
    });
  });

  describe("grantRole", async () => {
    it("should fail if non owner tries to grantRole", async () => {
      await expect(factory.connect(user).grantRole(ISSUER_ROLE, owner.address))
        .to.be.reverted;
    });

    it("should emit event", async () => {
      await expect(factory.grantRole(ISSUER_ROLE, owner.address)).to.emit(
        factory,
        "RoleGranted"
      );
    });
  });
  describe("setIsAllowListEnabled", async () => {
    it("should fail if non owner tries to update allow list", async () => {
      await expect(factory.connect(user).setIsAllowListEnabled(false)).to.be
        .reverted;
    });
    it("should toggle allow list", async () => {
      expect(await factory.isAllowListEnabled()).to.be.equal(true);

      await expect(factory.setIsAllowListEnabled(false))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(false);
      expect(await factory.isAllowListEnabled()).to.be.equal(false);
      await collateralToken.transfer(
        user.address,
        await collateralToken.balanceOf(owner.address)
      );
      collateralToken
        .connect(user)
        .approve(
          factory.address,
          await collateralToken.balanceOf(user.address)
        );
      await expect(createBond(factory.connect(user))).to.emit(
        factory,
        "BondCreated"
      );

      await expect(factory.setIsAllowListEnabled(true))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(true);
      expect(await factory.isAllowListEnabled()).to.be.equal(true);
    });
  });
});
