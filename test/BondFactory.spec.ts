import { BigNumber, BigNumberish, utils } from "ethers";
import { expect } from "chai";
import { BondFactoryClone } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture } from "./shared/fixtures";

const { ethers } = require("hardhat");

const maturityDate = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

const BondConfig: {
  targetBondSupply: BigNumber;
  collateralTokens: string[];
  collateralRatios: BigNumber[];
  convertibilityRatios: BigNumber[];
  maturityDate: BigNumberish;
} = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralTokens: [""],
  collateralRatios: [BigNumber.from(0)],
  convertibilityRatios: [BigNumber.from(0)],
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
    BondConfig.collateralTokens = [TEST_ADDRESSES[0], TEST_ADDRESSES[1]];
    BondConfig.collateralRatios = [
      utils.parseUnits("0.5", 18),
      utils.parseUnits("0.25", 18),
    ];
    BondConfig.convertibilityRatios = [
      utils.parseUnits("0.5", 18),
      utils.parseUnits("0.25", 18),
    ];
    return factory.createBond(
      "SimpleBond",
      "LUG",
      owner.address,
      BondConfig.maturityDate,
      TEST_ADDRESSES[0],
      BondConfig.collateralTokens,
      BondConfig.collateralRatios,
      BondConfig.convertibilityRatios
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
