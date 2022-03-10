import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import { BondFactoryClone } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture } from "./shared/fixtures";
import { BondConfigType } from "./interfaces";

const { ethers } = require("hardhat");

const maturityDate = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

const BondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralToken: "",
  collateralRatio: BigNumber.from(0),
  convertibilityRatio: BigNumber.from(0),
  maturityDate,
};

describe("BondFactory", async () => {
  let factory: BondFactoryClone;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let ISSUER_ROLE: any;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    ({ factory } = await bondFactoryFixture());
    ISSUER_ROLE = await factory.ISSUER_ROLE();
  });

  async function createBond(factory: BondFactoryClone) {
    BondConfig.collateralToken = TEST_ADDRESSES[0];
    BondConfig.collateralRatio = utils.parseUnits("0.5", 18);
    BondConfig.convertibilityRatio = utils.parseUnits("0.5", 18);
    return factory.createBond(
      "SimpleBond",
      "LUG",
      owner.address,
      BondConfig.maturityDate,
      TEST_ADDRESSES[0],
      BondConfig.collateralToken,
      BondConfig.collateralRatio,
      BondConfig.convertibilityRatio
    );
  }

  describe("#createBond", async () => {
    it("only approved issuers can create a bond", async () => {
      await expect(createBond(factory)).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${ISSUER_ROLE}`
      );

      await factory.grantRole(ISSUER_ROLE, owner.address);

      await expect(createBond(factory)).to.emit(factory, "BondCreated");
    });

    it("anyone can call createBond with allowList disabled", async () => {
      await expect(factory.setIsAllowListEnabled(false))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(false);
      expect(await factory.isAllowListEnabled()).to.be.false;
      await expect(createBond(factory.connect(user))).to.emit(
        factory,
        "BondCreated"
      );
    });
  });

  describe("#grantRole", async () => {
    it("fails if non owner tries to grantRole", async () => {
      await expect(factory.connect(user).grantRole(ISSUER_ROLE, owner.address))
        .to.be.reverted;
    });

    it("emits event", async () => {
      await expect(factory.grantRole(ISSUER_ROLE, owner.address)).to.emit(
        factory,
        "RoleGranted"
      );
    });
  });
  describe("#setIsAllowList", async () => {
    it("fails if non owner tries to update allow list", async () => {
      await expect(factory.connect(user).setIsAllowListEnabled(false)).to.be
        .reverted;
    });
    it("allowList toggle works correctly", async () => {
      expect(await factory.isAllowListEnabled()).to.be.true;

      await expect(factory.setIsAllowListEnabled(false))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(false);
      expect(await factory.isAllowListEnabled()).to.be.false;
      await expect(createBond(factory.connect(user))).to.emit(
        factory,
        "BondCreated"
      );

      await expect(factory.setIsAllowListEnabled(true))
        .to.emit(factory, "AllowListEnabled")
        .withArgs(true);
      expect(await factory.isAllowListEnabled()).to.be.true;
    });
  });
});
