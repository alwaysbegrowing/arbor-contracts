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

const { ethers } = require("hardhat");

const BondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits("2", 18),
  convertibleTokenAmount: utils.parseUnits("1", 18),
  maturityDate: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

interface BondParams {
  maturityDate?: any;
  paymentToken?: any;
  collateralToken?: any;
  collateralTokenAmount?: any;
  convertibleTokenAmount?: any;
  maxSupply?: any;
}

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

  async function createBond(factory: BondFactory, params: BondParams = {}) {
    const testMaturityDate = params.maturityDate || BondConfig.maturityDate;
    const testPaymentToken = params.paymentToken || paymentToken.address;
    const testCollateralToken =
      params.collateralToken || collateralToken.address;

    const testCollateralTokenAmount =
      params.collateralTokenAmount || BondConfig.collateralTokenAmount;
    const testConvertibleTokenAmount =
      params.convertibleTokenAmount || BondConfig.convertibleTokenAmount;
    const testMaxSupply = params.maxSupply || BondConfig.maxSupply;

    await collateralToken.approve(
      factory.address,
      BondConfig.collateralTokenAmount
    );
    return factory.createBond(
      "Bond",
      "LUG",
      testMaturityDate,
      testPaymentToken,
      testCollateralToken,
      testCollateralTokenAmount,
      testConvertibleTokenAmount,
      testMaxSupply
    );
  }

  describe("#createBond", async () => {
    it("should allow approved issuers to create a bond", async () => {
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
          collateralTokenAmount: 5000,
          convertibleTokenAmount: 10000,
        })
      ).to.be.revertedWith(
        "CollateralTokenAmountLessThanConvertibleTokenAmount"
      );
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
    it("should not withdraw collateral for zero collateral bonds", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);
      const startingBalance = await collateralToken.balanceOf(owner.address);
      createBond(factory, {
        collateralTokenAmount: 0,
        convertibleTokenAmount: 0,
      });
      const endingBalance = await collateralToken.balanceOf(owner.address);
      expect(endingBalance).to.equal(startingBalance);
    });

    it("should withdraw the correct amount of collateral on creation", async () => {
      await factory.grantRole(ISSUER_ROLE, owner.address);

      await expect(() => createBond(factory, {})).to.changeTokenBalance(
        collateralToken,
        owner,
        BondConfig.collateralTokenAmount.mul(-1)
      );
    });

    it("should handle minting a very very small amount of bonds correctly");
    it(
      "should mint a very large number of bonds and handle overflow correctly"
    );
    it("should handle a robust amount of imputs for the bond creation");
    it("should work with any amount of decimals >= 18");

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
