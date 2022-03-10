import { BigNumber, BigNumberish, utils, BytesLike } from "ethers";
import { expect } from "chai";
import {
  TestERC20,
  SimpleBond,
  IERC20__factory,
  ERC20__factory,
  BondFactoryClone,
} from "../typechain";
import { getBondContract, getEventArgumentsFromLoop } from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";

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

const ConvertibleBondConfig: {
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

describe("SimpleBond", async () => {
  let bond: SimpleBond;
  let convertibleBond: SimpleBond;
  let owner: SignerWithAddress;
  let bondHolder: SignerWithAddress;
  let attacker: SignerWithAddress;
  let nativeToken: TestERC20;
  let attackingToken: TestERC20;
  let mockUSDCToken: TestERC20;
  let borrowingToken: TestERC20;
  let factory: BondFactoryClone;
  let withdrawRole: BytesLike;

  // no args because of gh issue:
  // https://github.com/nomiclabs/hardhat/issues/849#issuecomment-860576796
  async function fixture() {
    const { factory } = await bondFactoryFixture();
    const issuerRole = await factory.ISSUER_ROLE();

    await factory.grantRole(issuerRole, owner.address);

    const { nativeToken, attackingToken, mockUSDCToken, borrowingToken } =
      await tokenFixture();
    BondConfig.collateralTokens = [
      mockUSDCToken.address,
      nativeToken.address,
    ].sort();
    BondConfig.collateralRatios = [
      utils.parseUnits("0.5", 18),
      utils.parseUnits("0.25", 18),
    ];
    BondConfig.convertibilityRatios = [
      utils.parseUnits("0", 18),
      utils.parseUnits("0", 18),
    ];
    const bond = await getBondContract(
      factory.createBond(
        "SimpleBond",
        "LUG",
        owner.address,
        BondConfig.maturityDate,
        borrowingToken.address,
        BondConfig.collateralTokens,
        BondConfig.collateralRatios,
        BondConfig.convertibilityRatios
      )
    );

    ConvertibleBondConfig.collateralTokens = [
      mockUSDCToken.address,
      nativeToken.address,
    ].sort();
    ConvertibleBondConfig.collateralRatios = [
      utils.parseUnits("0.5", 18),
      utils.parseUnits("0.25", 18),
    ];
    ConvertibleBondConfig.convertibilityRatios = [
      utils.parseUnits("0.5", 18),
      utils.parseUnits("0.25", 18),
    ];
    const convertibleBond = await getBondContract(
      factory.createBond(
        "SimpleBond",
        "LUG",
        owner.address,
        ConvertibleBondConfig.maturityDate,
        borrowingToken.address,
        ConvertibleBondConfig.collateralTokens,
        ConvertibleBondConfig.collateralRatios,
        ConvertibleBondConfig.convertibilityRatios
      )
    );

    return {
      bond,
      convertibleBond,
      nativeToken,
      attackingToken,
      mockUSDCToken,
      borrowingToken,
      factory,
    };
  }

  beforeEach(async () => {
    [owner, bondHolder, attacker] = await ethers.getSigners();
    ({
      bond,
      convertibleBond,
      nativeToken,
      attackingToken,
      mockUSDCToken,
      borrowingToken,
      factory,
    } = await loadFixture(fixture));
    withdrawRole = await bond.WITHDRAW_ROLE();
  });
  describe("configuration", async () => {
    it("should revert on non-sorted addresses", async () => {
      await expect(
        factory.createBond(
          "SimpleBond",
          "LUG",
          owner.address,
          BondConfig.maturityDate,
          borrowingToken.address,
          [BondConfig.collateralTokens[1], BondConfig.collateralTokens[0]],
          BondConfig.collateralRatios,
          BondConfig.convertibilityRatios
        )
      ).to.be.revertedWith("CollateralTokensUnsorted");
    });
    it("should revert on non-equal lengths", async () => {
      await expect(
        factory.createBond(
          "SimpleBond",
          "LUG",
          owner.address,
          BondConfig.maturityDate,
          borrowingToken.address,
          BondConfig.collateralTokens,
          BondConfig.collateralRatios.slice(0, 1),
          BondConfig.convertibilityRatios
        )
      ).to.be.revertedWith("LengthMismatch");
    });
    it("should revert on less collateral than convertible", async () => {
      await expect(
        factory.createBond(
          "SimpleBond",
          "LUG",
          owner.address,
          BondConfig.maturityDate,
          borrowingToken.address,
          BondConfig.collateralTokens,
          BondConfig.convertibilityRatios, // these are swapped
          BondConfig.collateralRatios // these are swapped
        )
      ).to.be.revertedWith("BackingRatioLessThanConvertibilityRatio");
    });
  });

  describe("creation", async () => {
    it("should have no minted coins", async function () {
      expect(await bond.balanceOf(owner.address)).to.be.equal(0);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
    });

    it("issuer has default admin role", async function () {
      expect(await bond.hasRole(await bond.DEFAULT_ADMIN_ROLE(), owner.address))
        .to.be.true;
    });

    it("default admin role is role admin for withdraw role", async function () {
      expect(
        await bond.hasRole(
          await bond.getRoleAdmin(withdrawRole),
          owner.address
        )
      ).to.be.true;
    });

    it("should return total value for an account", async function () {
      expect(
        await bond.connect(bondHolder).balanceOf(owner.address)
      ).to.be.equal(0);
    });

    it("should return public parameters", async function () {
      expect(await bond.maturityDate()).to.be.equal(BondConfig.maturityDate);
      expect(await bond.collateralTokens(0)).to.be.equal(
        BondConfig.collateralTokens[0]
      );
      expect(await bond.backingRatios(0)).to.be.equal(
        BondConfig.collateralRatios[0]
      );
      expect(await bond.convertibilityRatios(0)).to.be.equal(0);

      expect(await bond.borrowingToken()).to.be.equal(borrowingToken.address);
    });

    it("should have predefined ERC20 attributes", async () => {
      expect(await bond.name()).to.be.equal("SimpleBond");
      expect(await bond.symbol()).to.be.equal("LUG");
    });
  });

  describe("depositCollateral", async () => {
    it("deposits collateral", async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralTokens.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      const args = await getEventArgumentsFromLoop(
        await bond.depositCollateral(amountsToDeposit),
        "CollateralDeposited"
      );
      args.forEach(({ amount }: { amount: string }, index: number) => {
        expect(amount).to.be.equal(amountsToDeposit[index]);
      });
    });

    it("reverts when insufficient allowance", async () => {
      await expect(
        bond.connect(attacker).depositCollateral([utils.parseUnits("1", 18)])
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("withdrawCollateral", async () => {
    let amountsToDeposit = [BigNumber.from(0)];
    beforeEach(async () => {
      amountsToDeposit = await Promise.all(
        BondConfig.collateralTokens.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(amountsToDeposit);
      await bond.mint();
    });

    it("withdraws collateral", async () => {
      await expect(bond.withdrawCollateral(0)).to.be.revertedWith(
        "CollateralInContractInsufficientToCoverWithdraw"
      );
    });

    it("owner can withdraw collateral", async () => {
      await expect(bond.withdrawCollateral(0)).to.be.revertedWith(
        "CollateralInContractInsufficientToCoverWithdraw"
      );
    });

    it("reverts when called by non-issuer", async () => {
      await expect(
        bond.connect(attacker).withdrawCollateral(0)
      ).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
      );
    });

    it("granting and revoking withdraw role works correctly", async () => {
      await bond.grantRole(withdrawRole, attacker.address);
      await expect(
        bond.connect(attacker).withdrawCollateral(0)
      ).to.be.revertedWith("CollateralInContractInsufficientToCoverWithdraw");

      await bond.revokeRole(withdrawRole, attacker.address);
      await expect(
        bond.connect(attacker).withdrawCollateral(0)
      ).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
      );
    });
  });

  describe("repayment", async () => {
    beforeEach(async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralTokens.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(amountsToDeposit);
      await expect(bond.mint()).to.not.be.reverted;
      await borrowingToken.approve(bond.address, BondConfig.targetBondSupply);
    });

    it("accepts partial repayment", async () => {
      await bond.repay(BondConfig.targetBondSupply.div(2));

      await expect(bond.repay(BondConfig.targetBondSupply.div(2))).to.emit(
        bond,
        "RepaymentInFull"
      );
    });

    it("accepts repayment", async () => {
      await expect(bond.repay(BondConfig.targetBondSupply)).to.emit(
        bond,
        "RepaymentInFull"
      );
    });

    it("fails if already repaid", async () => {
      await bond.repay(BondConfig.targetBondSupply);
      await expect(bond.repay(BondConfig.targetBondSupply)).to.be.revertedWith(
        "RepaymentMet"
      );
    });
  });
  describe("minting", async () => {
    const targetTokens = BondConfig.targetBondSupply;
    beforeEach(async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralTokens.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(amountsToDeposit);
    });

    it("mints up to collateral depositted", async () => {
      await expect(bond.mint()).to.not.be.reverted;
      expect(await bond.totalSupply()).to.equal(targetTokens);
    });

    it("fails to mint tokens after minted", async () => {
      await expect(bond.mint()).to.not.be.reverted;
      await expect(bond.mint()).to.be.revertedWith("NoMintAfterIssuance");
    });

    it("fails to mint if not all tokens owned by issuer", async () => {
      await expect(bond.mint()).to.not.be.reverted;
      await bond.transfer(owner.address, 1);
      await expect(bond.mint()).to.be.revertedWith("NoMintAfterIssuance");
    });
  });

  describe("redemption", async () => {
    const sharesToSellToBondHolder = utils.parseUnits("1000", 18);
    beforeEach(async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralTokens.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(amountsToDeposit);
      await bond.mint();
      await bond.transfer(bondHolder.address, sharesToSellToBondHolder);
      await borrowingToken.approve(bond.address, BondConfig.targetBondSupply);
    });
    it("should redeem bond at maturity for borrowing token", async function () {
      await bond.repay(BondConfig.targetBondSupply);
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
      const expectedCollateralToReceive =
        ConvertibleBondConfig.convertibilityRatios.map((ratio) =>
          sharesToSellToBondHolder.mul(ratio).div(utils.parseUnits("1", 18))
        );
      await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
      const args = await getEventArgumentsFromLoop(
        await bond.connect(bondHolder).redeem(sharesToSellToBondHolder),
        "Redeem"
      );
      args.forEach(
        (
          {
            receiver,
            token,
            amountOfBondsRedeemed,
            amountOfTokensReceived,
          }: any,
          index: number
        ) => {
          expect(receiver).to.equal(bondHolder.address);
          expect(token).to.equal(ConvertibleBondConfig.collateralTokens[index]);
          expect(amountOfBondsRedeemed).to.equal(sharesToSellToBondHolder);
          expect(amountOfTokensReceived).to.equal(
            expectedCollateralToReceive[index]
          );
        }
      );

      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await borrowingToken.balanceOf(bondHolder.address)).to.be.equal(0);
      // this isn't necessarily USDC - it's attaching at the address specified
      // this is because the tokens are sorted and we can not be sure which token it is
      expect(
        await mockUSDCToken
          .attach(BondConfig.collateralTokens[0])
          .balanceOf(bondHolder.address)
      ).to.be.equal(
        BondConfig.collateralRatios[0]
          .mul(sharesToSellToBondHolder)
          .div(utils.parseUnits("1", 18))
      );
    });
  });

  describe("conversion", async () => {
    describe("convertible bonds", async () => {
      const tokensToConvert = ConvertibleBondConfig.targetBondSupply;
      beforeEach(async () => {
        const amountsToDeposit = await Promise.all(
          ConvertibleBondConfig.collateralTokens.map(async (address, index) => {
            const token = IERC20__factory.connect(address, owner);
            const amountToDeposit = ConvertibleBondConfig.targetBondSupply
              .mul(ConvertibleBondConfig.collateralRatios[index])
              .div(utils.parseUnits("1", 18));
            await token.approve(convertibleBond.address, amountToDeposit);
            return amountToDeposit;
          })
        );
        await convertibleBond.depositCollateral(amountsToDeposit);
        await convertibleBond.mint();
        await convertibleBond.transfer(bondHolder.address, tokensToConvert);
      });

      it("converts bond amount into collateral at convertibilityRatio", async () => {
        const expectedCollateralToWithdraw =
          ConvertibleBondConfig.convertibilityRatios.map((ratio) =>
            tokensToConvert.mul(ratio).div(utils.parseUnits("1", 18))
          );
        await convertibleBond
          .connect(bondHolder)
          .approve(convertibleBond.address, tokensToConvert);
        const args = await getEventArgumentsFromLoop(
          await convertibleBond.connect(bondHolder).convert(tokensToConvert),
          "Converted"
        );
        args.forEach(
          (
            {
              convertorAddress,
              collateralToken,
              amountOfBondsConverted,
              amountOfCollateralReceived,
            }: any,
            index: number
          ) => {
            expect(convertorAddress).to.equal(bondHolder.address);
            expect(collateralToken).to.equal(
              ConvertibleBondConfig.collateralTokens[index]
            );
            expect(amountOfBondsConverted).to.equal(tokensToConvert);
            expect(amountOfCollateralReceived).to.equal(
              expectedCollateralToWithdraw[index]
            );
          }
        );
      });
    });
    describe("non-convertible bonds", async () => {
      const tokensToConvert = ConvertibleBondConfig.targetBondSupply;
      it("fails to convert if bond is not convertible", async () => {
        await expect(bond.convert(tokensToConvert)).to.be.revertedWith(
          "NotConvertible"
        );
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
      await expect(bond.sweep(nativeToken.address)).to.be.revertedWith(
        "SweepDisallowedForToken"
      );
    });
  });
});
