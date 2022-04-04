import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import { BondFactory, TestERC20 } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";
import { BondConfigType } from "./interfaces";
import {
  FIFTY_MILLION,
  THREE_YEARS_FROM_NOW_IN_SECONDS,
  ELEVEN_YEARS_FROM_NOW_IN_SECONDS,
  ZERO,
} from "./constants";
import { getTargetCollateral } from "./utilities";

const { ethers } = require("hardhat");

const BondConfig: BondConfigType = {
  collateralRatio: ZERO,
  convertibleRatio: ZERO,
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

  async function createBond(factory: BondFactory, params: any = {}) {
    const testMaturityDate = params.maturityDate || BondConfig.maturityDate;
    const testPaymentToken = params.paymentToken || paymentToken.address;
    const testCollateralToken =
      params.collateralToken || collateralToken.address;

    const testCollateralRatio =
      params.collateralRatio || BondConfig.collateralRatio;
    const testConvertibleRatio =
      params.convertibleRatio || BondConfig.convertibleRatio;
    const testMaxSupply = params.maxSupply || BondConfig.maxSupply;

    await collateralToken.approve(
      factory.address,
      getTargetCollateral(BondConfig)
    );
    return factory.createBond(
      "Bond",
      "LUG",
      testMaturityDate,
      testPaymentToken,
      testCollateralToken,
      testCollateralRatio,
      testConvertibleRatio,
      testMaxSupply
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

    it("should revert on less collateral than convertible ratio", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      await expect(
        createBond(factory, {
          collateralRatio: utils.parseUnits(".25", 18),
          convertibleRatio: utils.parseUnits(".5", 18),
        })
      ).to.be.revertedWith("CollateralRatioLessThanConvertibleRatio");
    });

    it("should revert on too big of a token", async () => {
      const { paymentToken: bigPaymentToken } = await (
        await tokenFixture([20])
      ).tokens[1];

      await factory.grantRole(ISSUER_ROLE, owner.address);
      await expect(
        createBond(factory, { paymentToken: bigPaymentToken.address })
      ).to.be.revertedWith("DecimalsOver18()");
    });

    describe("invalid maturity dates", async () => {
      it("should revert on a maturity date already passed", async () => {
        await factory.grantRole(ISSUER_ROLE, owner.address);
        await expect(
          createBond(factory, { maturityDate: BigNumber.from(1) })
        ).to.be.revertedWith("InvalidMaturityDate");
      });

      it("should revert on a maturity date current timestamp", async () => {
        if (!owner?.provider) {
          throw new Error("no provider");
        }
        const currentTimestamp = (await owner.provider.getBlock("latest"))
          .timestamp;

        await factory.grantRole(ISSUER_ROLE, owner.address);
        await expect(
          createBond(factory, { maturityDate: currentTimestamp })
        ).to.be.revertedWith("InvalidMaturityDate");
      });
      it("should revert on a maturity date 10 years in the future", async () => {
        await factory.grantRole(ISSUER_ROLE, owner.address);
        await expect(
          createBond(factory, {
            maturityDate: ELEVEN_YEARS_FROM_NOW_IN_SECONDS,
          })
        ).to.be.revertedWith("InvalidMaturityDate");
      });
    });

    it("should mint max supply to the caller", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      await createBond(factory);
    });
    it("should not withdraw collateral for convert bonds", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      const startingBalance = await collateralToken.balanceOf(owner.address);
      createBond(factory, { collateralRatio: ZERO, convertibleRatio: ZERO });
      const endingBalance = await collateralToken.balanceOf(owner.address);
      expect(endingBalance).to.equal(startingBalance);
    });
    it("should withdraw the correct amount of collateral on creation", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      await expect(createBond(factory, {})).to.changeTokenBalance(
              collateralToken,
              owner,
              collateralToWithdraw
            );
    });

    it("should revert on a token without decimals", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      await expect(
        createBond(factory, { collateralToken: factory.address })
      ).to.be.revertedWith("function selector was not recognized");
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
