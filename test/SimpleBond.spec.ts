import { BigNumber, BigNumberish, utils } from "ethers";
import { expect } from "chai";
import {
  TestERC20,
  SimpleBond,
  IERC20__factory,
  ERC20__factory,
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

const ISSUER_ROLE = utils.id("ISSUER_ROLE");

// 3 years from now, in seconds
const maturityDate = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);
const BondConfig: {
  targetBondSupply: BigNumber;
  collateralAddresses: string[];
  collateralRatios: BigNumber[];
  convertibilityRatios: BigNumber[];
  maturityDate: BigNumberish;
} = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralAddresses: [""],
  collateralRatios: [BigNumber.from(0)],
  convertibilityRatios: [BigNumber.from(0)],
  maturityDate,
};

const ConvertibleBondConfig: {
  targetBondSupply: BigNumber;
  collateralAddresses: string[];
  collateralRatios: BigNumber[];
  convertibilityRatios: BigNumber[];
  maturityDate: BigNumberish;
} = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralAddresses: [""],
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

  // no args because of gh issue:
  // https://github.com/nomiclabs/hardhat/issues/849#issuecomment-860576796
  async function fixture() {
    const { factory } = await bondFactoryFixture();
    await factory.grantRole(ISSUER_ROLE, owner.address);

    const { nativeToken, attackingToken, mockUSDCToken, borrowingToken } =
      await tokenFixture();
    BondConfig.collateralAddresses = [
      nativeToken.address,
      mockUSDCToken.address,
    ];
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
        BondConfig.collateralAddresses,
        BondConfig.collateralRatios,
        BondConfig.convertibilityRatios
      )
    );

    ConvertibleBondConfig.collateralAddresses = [
      nativeToken.address,
      mockUSDCToken.address,
    ];
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
        [nativeToken.address],
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
    } = await loadFixture(fixture));
  });

  describe("creation", async () => {
    it("should have no minted coins", async function () {
      expect(await bond.balanceOf(owner.address)).to.be.equal(0);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
    });

    it("should be owner", async function () {
      expect(await bond.owner()).to.be.equal(owner.address);
    });

    it("should return total value for an account", async function () {
      expect(
        await bond.connect(bondHolder).balanceOf(owner.address)
      ).to.be.equal(0);
    });

    it("should return public parameters", async function () {
      expect(await bond.maturityDate()).to.be.equal(BondConfig.maturityDate);
      expect(await bond.collateralAddresses(0)).to.be.equal(
        nativeToken.address
      );
      expect(await bond.backingRatios(0)).to.be.equal(
        BondConfig.collateralRatios[0]
      );
      expect(await bond.convertibilityRatios(0)).to.be.equal(0);

      expect(await bond.borrowingAddress()).to.be.equal(borrowingToken.address);
      expect(await bond.owner()).to.be.equal(owner.address);
    });

    it("should have predefined ERC20 attributes", async () => {
      expect(await bond.name()).to.be.equal("SimpleBond");
      expect(await bond.symbol()).to.be.equal("LUG");
    });
  });

  describe("depositCollateral", async () => {
    it("deposits collateral", async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralAddresses.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      const args = await getEventArgumentsFromLoop(
        await bond.depositCollateral(
          BondConfig.collateralAddresses,
          amountsToDeposit
        ),
        "CollateralDeposited"
      );
      args.forEach(({ amount }: { amount: string }, index: number) => {
        expect(amount).to.be.equal(amountsToDeposit[index]);
      });
    });

    it("reverts when insufficient allowance", async () => {
      await expect(
        bond
          .connect(attacker)
          .depositCollateral([nativeToken.address], [utils.parseUnits("1", 18)])
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("reverts on zero amount", async () => {
      await expect(
        bond.depositCollateral([nativeToken.address], [0])
      ).to.be.revertedWith("ZeroCollateralizationAmount");
    });
  });

  describe("withdrawCollateral", async () => {
    let amountsToDeposit = [BigNumber.from(0)];
    beforeEach(async () => {
      amountsToDeposit = await Promise.all(
        BondConfig.collateralAddresses.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(
        BondConfig.collateralAddresses,
        amountsToDeposit
      );
      await bond.mint();
    });

    it("withdraws collateral", async () => {
      await expect(
        bond.withdrawCollateral(
          BondConfig.collateralAddresses,
          amountsToDeposit
        )
      ).to.be.revertedWith("CollateralInContractInsufficientToCoverWithdraw");
    });

    it("reverts when called by non-issuer", async () => {
      await expect(
        bond
          .connect(attacker)
          .withdrawCollateral(BondConfig.collateralAddresses, amountsToDeposit)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("repayment", async () => {
    beforeEach(async () => {
      const amountsToDeposit = await Promise.all(
        BondConfig.collateralAddresses.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(
        BondConfig.collateralAddresses,
        amountsToDeposit
      );
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
        BondConfig.collateralAddresses.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(
        BondConfig.collateralAddresses,
        amountsToDeposit
      );
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
        BondConfig.collateralAddresses.map(async (address, index) => {
          const token = IERC20__factory.connect(address, owner);
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatios[index])
            .div(utils.parseUnits("1", 18));
          await token.approve(bond.address, amountToDeposit);
          return amountToDeposit;
        })
      );
      await bond.depositCollateral(
        BondConfig.collateralAddresses,
        amountsToDeposit
      );
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
        await bond
          .connect(bondHolder)
          .redeemDefaulted(sharesToSellToBondHolder),
        "RedeemDefaulted"
      );
      args.forEach(
        (
          {
            receiver,
            collateralAddress,
            amountOfBondsRedeemed,
            amountOfCollateralReceived,
          }: any,
          index: number
        ) => {
          expect(receiver).to.equal(bondHolder.address);
          expect(collateralAddress).to.equal(
            ConvertibleBondConfig.collateralAddresses[index]
          );
          expect(amountOfBondsRedeemed).to.equal(sharesToSellToBondHolder);
          expect(amountOfCollateralReceived).to.equal(
            expectedCollateralToReceive[index]
          );
        }
      );

      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await borrowingToken.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(await nativeToken.balanceOf(bondHolder.address)).to.be.equal(
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
          ConvertibleBondConfig.collateralAddresses.map(
            async (address, index) => {
              const token = IERC20__factory.connect(address, owner);
              const amountToDeposit = ConvertibleBondConfig.targetBondSupply
                .mul(ConvertibleBondConfig.collateralRatios[index])
                .div(utils.parseUnits("1", 18));
              await token.approve(convertibleBond.address, amountToDeposit);
              return amountToDeposit;
            }
          )
        );
        await convertibleBond.depositCollateral(
          ConvertibleBondConfig.collateralAddresses,
          amountsToDeposit
        );
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
              collateralAddress,
              amountOfBondsConverted,
              amountOfCollateralReceived,
            }: any,
            index: number
          ) => {
            expect(convertorAddress).to.equal(bondHolder.address);
            expect(collateralAddress).to.equal(
              ConvertibleBondConfig.collateralAddresses[index]
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
