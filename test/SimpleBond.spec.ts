import { BigNumber } from "ethers";
import { expect } from "chai";
import { TestERC20, SimpleBond } from "../typechain";
import { getBondContract, getEventArgumentsFromTransaction } from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  bondFactoryFixture,
  collateralTokenFixture,
  borrowingTokenFixture,
  attackingTokenFixture,
} from "./shared/fixtures";

// https://ethereum-waffle.readthedocs.io/en/latest/fixtures.html
// import from waffle since we are using hardhat: https://hardhat.org/plugins/nomiclabs-hardhat-waffle.html#environment-extensions
const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

const BondStanding = {
  GOOD: 0,
  DEFAULTED: 1,
  PAID: 2,
  REDEEMED: 3,
};

// 3 years from now, in seconds
const maturityDate = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);
const BondConfig = {
  maxBondSupply: 2000000,
  collateralizationRatio: 200,
  convertibilityRatio: 50,
  maturityDate,
};
describe("SimpleBond", async () => {
  let bond: SimpleBond;
  let convertibleBond: SimpleBond;
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let bondHolder: SignerWithAddress;
  let attacker: SignerWithAddress;
  let collateralToken: TestERC20;
  let borrowingToken: TestERC20;
  let attackingToken: TestERC20;

  // no args because of gh issue:
  // https://github.com/nomiclabs/hardhat/issues/849#issuecomment-860576796
  async function fixture() {
    const [owner, issuer] = await ethers.getSigners();

    const { factory } = await bondFactoryFixture();
    const { collateralToken } = await collateralTokenFixture();
    const { borrowingToken } = await borrowingTokenFixture();
    const { attackingToken } = await attackingTokenFixture();

    const bond = await getBondContract(
      factory.createBond(
        owner.address,
        issuer.address,
        BondConfig.maturityDate,
        BondConfig.maxBondSupply,
        collateralToken.address,
        BigNumber.from(BondConfig.collateralizationRatio),
        borrowingToken.address,
        false,
        BigNumber.from(BondConfig.convertibilityRatio)
      )
    );

    const convertibleBond = await getBondContract(
      factory.createBond(
        owner.address,
        issuer.address,
        BondConfig.maturityDate,
        BondConfig.maxBondSupply,
        collateralToken.address,
        BigNumber.from(BondConfig.collateralizationRatio),
        borrowingToken.address,
        true,
        BigNumber.from(BondConfig.convertibilityRatio)
      )
    );

    return {
      bond,
      convertibleBond,
      collateralToken,
      borrowingToken,
      attackingToken,
    };
  }

  beforeEach(async () => {
    [owner, issuer, bondHolder, attacker] = await ethers.getSigners();
    ({
      bond,
      convertibleBond,
      collateralToken,
      borrowingToken,
      attackingToken,
    } = await loadFixture(fixture));
  });

  describe("creation", async () => {
    it("should have no minted coins", async function () {
      expect(await bond.balanceOf(owner.address)).to.be.equal(0);
      expect(await bond.balanceOf(issuer.address)).to.be.equal(0);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
    });

    it("should be owner", async function () {
      expect(await bond.owner()).to.be.equal(owner.address);
    });

    it("should return total value for an account", async function () {
      expect(
        await bond.connect(bondHolder).balanceOf(issuer.address)
      ).to.be.equal(0);
    });

    it("should return public parameters", async function () {
      expect(await bond.maturityDate()).to.be.equal(BondConfig.maturityDate);
      expect(await bond.collateralAddress()).to.be.equal(
        collateralToken.address
      );
      expect(await bond.collateralizationRatio()).to.be.equal(
        BondConfig.collateralizationRatio
      );
      expect(await bond.isConvertible()).to.be.equal(false);

      expect(await bond.convertibilityRatio()).to.be.equal(
        BondConfig.convertibilityRatio
      );
      expect(await bond.borrowingAddress()).to.be.equal(borrowingToken.address);
      expect(await bond.issuer()).to.be.equal(issuer.address);
      expect(await bond.maxBondSupply()).to.be.equal(BondConfig.maxBondSupply);
    });

    it("should have predefined ERC20 attributes", async () => {
      expect(await bond.name()).to.be.equal("SimpleBond");
      expect(await bond.symbol()).to.be.equal("LUG");
    });
  });

  describe("collateralize", async () => {
    const amountToDeposit =
      (BondConfig.maxBondSupply * BondConfig.collateralizationRatio) / 100;

    it("deposits collateral", async () => {
      await collateralToken
        .connect(issuer)
        .approve(bond.address, amountToDeposit);
      const { amount } = await getEventArgumentsFromTransaction(
        await bond.connect(issuer).collateralize(amountToDeposit),
        "CollateralDeposited"
      );
      expect(amount).to.be.equal(amountToDeposit);
    });

    it("reverts when insufficient allowance", async () => {
      await expect(
        bond.connect(attacker).collateralize(amountToDeposit)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("reverts on zero amount", async () => {
      await expect(bond.connect(issuer).collateralize(0)).to.be.revertedWith(
        "ZeroCollateralizationAmount"
      );
    });
  });

  describe("uncollateralize", async () => {
    const collateralToDeposit = 1000;
    const tokensToMint =
      collateralToDeposit / Math.floor(BondConfig.collateralizationRatio / 100);
    beforeEach(async () => {
      await collateralToken
        .connect(issuer)
        .approve(bond.address, collateralToDeposit);
      await bond.connect(issuer).collateralize(collateralToDeposit);
      await bond.connect(issuer).mint(tokensToMint);
    });

    it("withdraws collateral", async () => {
      await expect(bond.connect(issuer).uncollateralize()).to.be.revertedWith(
        "CollateralInContractInsufficientToCoverWithdraw"
      );
    });

    it("reverts when called by non-issuer", async () => {
      await expect(bond.connect(attacker).uncollateralize()).to.be.revertedWith(
        "OnlyIssuerOfBondMayCallThisFunction"
      );
    });
  });

  describe("repayment", async () => {
    beforeEach(async () => {
      const tokensToMint = BondConfig.maxBondSupply;
      const collateralToDeposit =
        (BondConfig.maxBondSupply * BondConfig.collateralizationRatio) / 100;
      await collateralToken
        .connect(issuer)
        .approve(bond.address, collateralToDeposit);
      await bond.connect(issuer).collateralize(collateralToDeposit);
      await expect(bond.connect(issuer).mint(tokensToMint)).to.not.be.reverted;
      await borrowingToken
        .connect(issuer)
        .approve(bond.address, BondConfig.maxBondSupply);
    });

    it("accepts partial repayment", async () => {
      await expect(
        bond.connect(issuer).repay(BondConfig.maxBondSupply / 2)
      ).to.emit(bond, "RepaymentDeposited");
      await expect(
        bond.connect(issuer).repay(BondConfig.maxBondSupply / 2)
      ).to.emit(bond, "RepaymentInFull");
    });

    it("accepts repayment", async () => {
      await expect(
        bond.connect(issuer).repay(BondConfig.maxBondSupply)
      ).to.emit(bond, "RepaymentInFull");
    });

    it("fails if already repaid", async () => {
      await bond.connect(issuer).repay(BondConfig.maxBondSupply);
      await expect(
        bond.connect(issuer).repay(BondConfig.maxBondSupply)
      ).to.be.revertedWith("RepaymentMet");
    });
  });

  describe("minting", async () => {
    const tokensToMint = BondConfig.maxBondSupply;
    const collateralToDeposit =
      (tokensToMint * BondConfig.collateralizationRatio) / 100;
    beforeEach(async () => {
      await collateralToken
        .connect(issuer)
        .approve(bond.address, collateralToDeposit);
      await bond.connect(issuer).collateralize(collateralToDeposit);
    });

    it("mints up to collateral depositted", async () => {
      await expect(bond.connect(issuer).mint(tokensToMint)).to.not.be.reverted;
    });

    it("mints tokens while collateral covers mint amount", async () => {
      await expect(bond.connect(issuer).mint(tokensToMint / 2)).to.not.be
        .reverted;
      await expect(bond.connect(issuer).mint(tokensToMint / 2)).to.not.be
        .reverted;
    });

    it("fails to mint tokens not covered by collateral", async () => {
      await expect(bond.connect(issuer).mint(tokensToMint)).to.not.be.reverted;
      await expect(bond.connect(issuer).mint(tokensToMint)).to.be.revertedWith(
        "InusfficientCollateralToCoverTokenSupply"
      );
    });

    it("fails to mint more than max supply", async () => {
      await collateralToken
        .connect(issuer)
        .approve(bond.address, collateralToDeposit);
      await bond.connect(issuer).collateralize(collateralToDeposit);
      await expect(
        bond.connect(issuer).mint(tokensToMint * 2)
      ).to.be.revertedWith("BondSupplyExceeded");
    });

    it("fails to mint if not all tokens owned by issuer", async () => {
      await expect(bond.connect(issuer).mint(tokensToMint / 2)).to.not.be
        .reverted;
      await bond.connect(issuer).transfer(owner.address, 1);
      await expect(
        bond.connect(issuer).mint(tokensToMint / 2)
      ).to.be.revertedWith("NoMintAfterIssuance");
    });
  });

  describe("redemption", async () => {
    const collateralToDeposit =
      (BondConfig.maxBondSupply * BondConfig.collateralizationRatio) / 100;
    const sharesToSellToBondHolder = 1000;
    beforeEach(async () => {
      await collateralToken
        .connect(issuer)
        .approve(bond.address, collateralToDeposit);
      await bond.connect(issuer).collateralize(collateralToDeposit);
      await bond.connect(issuer).mint(BondConfig.maxBondSupply);
      await bond
        .connect(issuer)
        .transfer(bondHolder.address, sharesToSellToBondHolder);
      await borrowingToken
        .connect(issuer)
        .approve(bond.address, BondConfig.maxBondSupply);
    });
    it("should redeem bond at maturity for borrowing token", async function () {
      await bond.connect(issuer).repay(BondConfig.maxBondSupply);
      // Fast forward to expire
      await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
      expect(await bond.state()).to.eq(BondStanding.PAID);
      await bond
        .connect(bondHolder)
        .approve(bond.address, sharesToSellToBondHolder);

      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(
        sharesToSellToBondHolder
      );
      await bond.connect(bondHolder).redeem(sharesToSellToBondHolder);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await borrowingToken.balanceOf(bondHolder.address)).to.be.equal(
        sharesToSellToBondHolder
      );
    });
    it("should redeem bond at default for collateral token", async function () {
      await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
      await bond.connect(bondHolder).redeemDefaulted(sharesToSellToBondHolder);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await borrowingToken.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await collateralToken.balanceOf(bondHolder.address)).to.be.equal(
        (sharesToSellToBondHolder * BondConfig.collateralizationRatio) / 100
      );
    });
  });

  describe("conversion", async () => {
    const tokensToConvert = BondConfig.maxBondSupply;
    const collateralToDeposit =
      (tokensToConvert * BondConfig.collateralizationRatio) / 100;
    const collateralToWithdraw =
      (tokensToConvert * BondConfig.convertibilityRatio) / 100;

    describe("convertible bonds", async () => {
      beforeEach(async () => {
        await collateralToken
          .connect(issuer)
          .approve(convertibleBond.address, collateralToDeposit);
        await convertibleBond
          .connect(issuer)
          .collateralize(collateralToDeposit);
        await expect(convertibleBond.connect(issuer).mint(tokensToConvert)).to
          .not.be.reverted;
        await convertibleBond
          .connect(issuer)
          .transfer(bondHolder.address, tokensToConvert);
      });

      it("converts bond amount into collateral at convertibilityRatio", async () => {
        await convertibleBond
          .connect(bondHolder)
          .approve(convertibleBond.address, tokensToConvert);
        expect(
          await convertibleBond.connect(bondHolder).convert(tokensToConvert)
        )
          .to.emit(convertibleBond, "Converted")
          .withArgs(bondHolder.address, tokensToConvert, collateralToWithdraw);
        expect(await collateralToken.balanceOf(bondHolder.address)).to.eq(
          collateralToWithdraw
        );
      });
    });
    describe("non-convertible bonds", async () => {
      it("fails to convert if bond is not convertible", async () => {
        await expect(
          bond.connect(issuer).convert(tokensToConvert)
        ).to.be.revertedWith("NotConvertible");
      });
    });
  });
  describe("sweep", async () => {
    it("removes a token from the contract", async () => {
      await attackingToken.connect(attacker).transfer(bond.address, 1000);
      await bond.sweep(attackingToken.address);
      expect(await attackingToken.balanceOf(owner.address)).to.be.equal(1000);
    });

    it("disallows removal of a collateral, borrowing, or itself", async () => {
      await expect(bond.sweep(bond.address)).to.be.revertedWith(
        "SweepDisallowedForToken"
      );
      await expect(bond.sweep(borrowingToken.address)).to.be.revertedWith(
        "SweepDisallowedForToken"
      );
      await expect(bond.sweep(collateralToken.address)).to.be.revertedWith(
        "SweepDisallowedForToken"
      );
    });
  });
});
