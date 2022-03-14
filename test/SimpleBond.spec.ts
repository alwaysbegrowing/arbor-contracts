import { BigNumber, utils, BytesLike } from "ethers";
import { expect } from "chai";
import { TestERC20, SimpleBond, BondFactoryClone } from "../typechain";
import { getBondContract, getEventArgumentsFromTransaction } from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";
import { BondConfigType } from "./interfaces";

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
const ONE = utils.parseUnits("1", 18);
// 3 years from now, in seconds
const maturityDate = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);

const BondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralToken: "",
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibilityRatio: BigNumber.from(0),
  maturityDate,
  maxSupply: utils.parseUnits("50000000", 18),
};

const ConvertibleBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits("50000000", 18), // 50 million bonds
  collateralToken: "",
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibilityRatio: utils.parseUnits("0.25", 18),
  maturityDate,
  maxSupply: utils.parseUnits("50000000", 18),
};

describe("SimpleBond", () => {
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
  let mintRole: BytesLike;

  // no args because of gh issue:
  // https://github.com/nomiclabs/hardhat/issues/849#issuecomment-860576796
  async function fixture() {
    const { factory } = await bondFactoryFixture();
    const issuerRole = await factory.ISSUER_ROLE();

    await (await factory.grantRole(issuerRole, owner.address)).wait();

    const { nativeToken, attackingToken, mockUSDCToken, borrowingToken } =
      await tokenFixture();
    BondConfig.collateralToken = nativeToken.address;

    const bond = await getBondContract(
      factory.createBond(
        "SimpleBond",
        "LUG",
        owner.address,
        BondConfig.maturityDate,
        borrowingToken.address,
        BondConfig.collateralToken,
        BondConfig.collateralRatio,
        BondConfig.convertibilityRatio,
        BondConfig.maxSupply
      )
    );

    ConvertibleBondConfig.collateralToken = mockUSDCToken.address;
    const convertibleBond = await getBondContract(
      factory.createBond(
        "SimpleBond",
        "LUG",
        owner.address,
        ConvertibleBondConfig.maturityDate,
        borrowingToken.address,
        ConvertibleBondConfig.collateralToken,
        ConvertibleBondConfig.collateralRatio,
        ConvertibleBondConfig.convertibilityRatio,
        BondConfig.maxSupply
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
    mintRole = await bond.MINT_ROLE();
  });
  describe("configuration", async () => {
    it("should revert on less collateral than convertible", async () => {
      await expect(
        factory.createBond(
          "SimpleBond",
          "LUG",
          owner.address,
          BondConfig.maturityDate,
          borrowingToken.address,
          BondConfig.collateralToken,
          BondConfig.convertibilityRatio, // these are swapped
          BondConfig.collateralRatio, // these are swapped
          BondConfig.maxSupply
        )
      ).to.be.revertedWith("BackingRatioLessThanConvertibilityRatio");
    });
  });

  describe("creation", async () => {
    it("should have no minted coins", async () => {
      expect(await bond.balanceOf(owner.address)).to.be.equal(0);
      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
    });

    it("issuer has default admin role", async () => {
      expect(
        await bond.hasRole(await bond.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.be.equal(true);
    });

    it("default admin role is role admin for withdraw role", async () => {
      expect(
        await bond.hasRole(await bond.getRoleAdmin(withdrawRole), owner.address)
      ).to.be.equal(true);
    });

    it("default admin role is role admin for mint role", async () => {
      expect(
        await bond.hasRole(await bond.getRoleAdmin(mintRole), owner.address)
      ).to.be.equal(true);
    });

    it("should return total value for an account", async () => {
      expect(
        await bond.connect(bondHolder).balanceOf(owner.address)
      ).to.be.equal(0);
    });

    it("should return public parameters", async () => {
      expect(await bond.maturityDate()).to.be.equal(BondConfig.maturityDate);
      expect(await bond.collateralToken()).to.be.equal(
        BondConfig.collateralToken
      );
      expect(await bond.backingRatio()).to.be.equal(BondConfig.collateralRatio);
      expect(await bond.convertibilityRatio()).to.be.equal(0);

      expect(await bond.borrowingToken()).to.be.equal(borrowingToken.address);
    });

    it("should have predefined ERC20 attributes", async () => {
      expect(await bond.name()).to.be.equal("SimpleBond");
      expect(await bond.symbol()).to.be.equal("LUG");
    });
  });

  describe("withdrawCollateral", async () => {
    // Withdraw function will transfer all allowed collateral out of the contract
    // Burn shares and withdraw
    // Do not burn shares and withdraw
    // Excess collateral will be available to withdraw when bonds are burned
    // Excess collateral will be available to withdraw when borrow token is partially repaid
    // Excess collateral will be available to withdraw when borrow token is fully repaid
    // Excess collateral will be available to withdraw when maturity is reached
    describe("non-convertible", async () => {
      beforeEach(async () => {
        const token = mockUSDCToken.attach(BondConfig.collateralToken);
        const amountToDeposit = BondConfig.targetBondSupply
          .mul(BondConfig.collateralRatio)
          .div(utils.parseUnits("1", 18));
        await token.approve(bond.address, amountToDeposit);
        await bond.mint(BondConfig.targetBondSupply);
      });
      [
        {
          sharesToBurn: 0,
          collateralToReceive: BigNumber.from(0),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("1000", 18)
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when bonds are burned", async () => {
          await (await bond.burn(sharesToBurn)).wait();
          expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("1000", 18)
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          borrowTokenToRepay: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("2000", 18)
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when borrow token is partially repaid", async () => {
          await (await bond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(bond.address, borrowTokenToRepay);
          await (await bond.repay(borrowTokenToRepay)).wait();
          expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: BondConfig.targetBondSupply,
          collateralToReceive: BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          borrowTokenToRepay: BondConfig.targetBondSupply,
          collateralToReceive: BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when borrow token is fully repaid", async () => {
          await (await bond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(bond.address, borrowTokenToRepay);
          await (await bond.repay(borrowTokenToRepay)).wait();
          expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: BondConfig.targetBondSupply,
          collateralToReceive: BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: 0,
          borrowTokenToRepay: BondConfig.targetBondSupply,
          collateralToReceive: BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when maturity is reached", async () => {
          await (await bond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(bond.address, borrowTokenToRepay);
          await (await bond.repay(borrowTokenToRepay)).wait();
          expect(await bond.previewWithdraw()).to.equal(collateralToReceive);
        });
      });
      it("reverts when called by non-issuer", async () => {
        await expect(
          bond.connect(attacker).withdrawCollateral()
        ).to.be.revertedWith(
          `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
        );
      });

      it("granting and revoking withdraw role works correctly", async () => {
        await bond.grantRole(withdrawRole, attacker.address);
        await expect(bond.connect(attacker).withdrawCollateral()).to.not.be
          .reverted;

        await bond.revokeRole(withdrawRole, attacker.address);
        await expect(
          bond.connect(attacker).withdrawCollateral()
        ).to.be.revertedWith(
          `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
        );
      });
    });

    describe("convertible", async () => {
      beforeEach(async () => {
        const token = mockUSDCToken.attach(
          ConvertibleBondConfig.collateralToken
        );
        const amountToDeposit = ConvertibleBondConfig.targetBondSupply
          .mul(ConvertibleBondConfig.collateralRatio)
          .div(utils.parseUnits("1", 18));
        await token.approve(convertibleBond.address, amountToDeposit);
        await convertibleBond.mint(ConvertibleBondConfig.targetBondSupply);
      });
      [
        {
          sharesToBurn: 0,
          collateralToReceive: BigNumber.from(0),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("1000", 18)
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when bonds are burned", async () => {
          await (await convertibleBond.burn(sharesToBurn)).wait();
          expect(await convertibleBond.previewWithdraw()).to.equal(
            collateralToReceive
          );
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("1000", 18)
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          borrowTokenToRepay: utils.parseUnits("1000", 18),
          collateralToReceive: utils
            .parseUnits("2000", 18)
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when borrow token is partially repaid", async () => {
          await (await convertibleBond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(
            convertibleBond.address,
            borrowTokenToRepay
          );
          await (await convertibleBond.repay(borrowTokenToRepay)).wait();
          expect(await convertibleBond.previewWithdraw()).to.equal(
            collateralToReceive
          );
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: ConvertibleBondConfig.targetBondSupply,
          collateralToReceive: ConvertibleBondConfig.targetBondSupply
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: utils.parseUnits("1000", 18),
          borrowTokenToRepay: ConvertibleBondConfig.targetBondSupply,
          collateralToReceive: ConvertibleBondConfig.targetBondSupply
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when borrow token is fully repaid", async () => {
          await (await convertibleBond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(
            convertibleBond.address,
            borrowTokenToRepay
          );
          await (await convertibleBond.repay(borrowTokenToRepay)).wait();
          expect(await convertibleBond.previewWithdraw()).to.equal(
            collateralToReceive
          );
        });
      });

      [
        {
          sharesToBurn: 0,
          borrowTokenToRepay: ConvertibleBondConfig.targetBondSupply.div(4),
          collateralToReceive: ConvertibleBondConfig.targetBondSupply
            .div(4)
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
        {
          sharesToBurn: 0,
          borrowTokenToRepay: ConvertibleBondConfig.targetBondSupply,
          collateralToReceive: ConvertibleBondConfig.targetBondSupply
            .mul(ConvertibleBondConfig.collateralRatio)
            .div(ONE),
        },
      ].forEach(({ sharesToBurn, borrowTokenToRepay, collateralToReceive }) => {
        it("Excess collateral will be available to withdraw when maturity is reached", async () => {
          await (await convertibleBond.burn(sharesToBurn)).wait();
          await borrowingToken.approve(
            convertibleBond.address,
            borrowTokenToRepay
          );
          await (await convertibleBond.repay(borrowTokenToRepay)).wait();
          await ethers.provider.send("evm_mine", [
            ConvertibleBondConfig.maturityDate,
          ]);
          expect(await convertibleBond.previewWithdraw()).to.equal(
            collateralToReceive
          );
        });
      });
      it("reverts when called by non-issuer", async () => {
        await expect(
          bond.connect(attacker).withdrawCollateral()
        ).to.be.revertedWith(
          `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
        );
      });

      it("granting and revoking withdraw role works correctly", async () => {
        await convertibleBond.grantRole(withdrawRole, attacker.address);
        await expect(convertibleBond.connect(attacker).withdrawCollateral()).to
          .not.be.reverted;

        await convertibleBond.revokeRole(withdrawRole, attacker.address);
        await expect(
          convertibleBond.connect(attacker).withdrawCollateral()
        ).to.be.revertedWith(
          `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
        );
      });
    });
  });

  describe("repayment", async () => {
    beforeEach(async () => {
      const token = mockUSDCToken.attach(BondConfig.collateralToken);
      const amountToDeposit = BondConfig.targetBondSupply
        .mul(BondConfig.collateralRatio)
        .div(utils.parseUnits("1", 18));
      await token.approve(bond.address, amountToDeposit);
      await expect(bond.mint(BondConfig.targetBondSupply)).to.not.be.reverted;
      await borrowingToken.approve(bond.address, BondConfig.targetBondSupply);
    });

    it("accepts partial repayment", async () => {
      await (await bond.repay(BondConfig.targetBondSupply.div(2))).wait();

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
    beforeEach(async () => {
      await mockUSDCToken
        .attach(BondConfig.collateralToken)
        .approve(
          bond.address,
          BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(utils.parseUnits("1", 18))
        );
    });

    it("reverts when called by non-issuer", async () => {
      await expect(bond.connect(attacker).mint(0)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${mintRole}`
      );
    });

    [
      {
        mintAmount: 0,
        collateralToDeposit: BigNumber.from(0),
        description: "zero target",
      },
      {
        mintAmount: BondConfig.targetBondSupply.div(4),
        collateralToDeposit: BondConfig.collateralRatio
          .mul(BondConfig.targetBondSupply.div(4))
          .div(ONE),
        description: "quarter target",
      },
      {
        mintAmount: BondConfig.targetBondSupply.div(2),
        collateralToDeposit: BondConfig.collateralRatio
          .mul(BondConfig.targetBondSupply.div(2))
          .div(ONE),
        description: "half target",
      },
      {
        mintAmount: BondConfig.targetBondSupply,
        collateralToDeposit: BondConfig.collateralRatio
          .mul(BondConfig.targetBondSupply)
          .div(ONE),
        description: "target",
      },
    ].forEach(({ mintAmount, collateralToDeposit, description }) => {
      it(`previews mint ${description}`, async () => {
        expect(await bond.previewMint(mintAmount)).to.equal(
          collateralToDeposit
        );
      });
    });

    it("mints up to collateral depositted", async () => {
      await expect(bond.mint(BondConfig.targetBondSupply)).to.not.be.reverted;
      expect(await bond.totalSupply()).to.equal(BondConfig.targetBondSupply);
    });

    it("cannot mint more than max supply", async () => {
      await expect(
        bond.mint(BondConfig.targetBondSupply.add(1))
      ).to.be.revertedWith("BondSupplyExceeded");
    });
  });

  describe("redemption", async () => {
    // Bond holder has 1000 bonds
    let sharesToSellToBondHolder = utils.parseUnits("1000", 18);
    // Bond holder will have their bonds and the contract will be able to accept deposits of borrowing token
    beforeEach(async () => {
      sharesToSellToBondHolder = utils.parseUnits("1000", 18);
      const amountToDeposit = BondConfig.targetBondSupply
        .mul(BondConfig.collateralRatio)
        .div(utils.parseUnits("1", 18));
      await mockUSDCToken
        .attach(BondConfig.collateralToken)
        .approve(bond.address, amountToDeposit);
      await bond.mint(BondConfig.targetBondSupply);
      await bond.transfer(bondHolder.address, sharesToSellToBondHolder);
      await borrowingToken.approve(bond.address, BondConfig.targetBondSupply);
    });

    [
      {
        sharesToRedeem: sharesToSellToBondHolder,
        borrowingTokenToSend: sharesToSellToBondHolder,
        collateralTokenToSend: BigNumber.from(0),
      },
      {
        sharesToRedeem: 0,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
    ].forEach(
      ({ sharesToRedeem, borrowingTokenToSend, collateralTokenToSend }) => {
        it("Bond is repaid & past maturity = Withdraw of borrowing", async () => {
          await bond.repay(BondConfig.targetBondSupply);
          await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
          expect(
            await bond.connect(bondHolder).previewRedeem(sharesToRedeem)
          ).to.deep.equal([borrowingTokenToSend, collateralTokenToSend]);
        });
      }
    );

    [
      {
        sharesToRedeem: sharesToSellToBondHolder,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
      {
        sharesToRedeem: 0,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
    ].forEach(
      ({ sharesToRedeem, borrowingTokenToSend, collateralTokenToSend }) => {
        it("Bond is repaid & not past maturity = No withdraw", async () => {
          await bond.repay(BondConfig.targetBondSupply);
          expect(
            await bond.connect(bondHolder).previewRedeem(sharesToRedeem)
          ).to.deep.equal([borrowingTokenToSend, collateralTokenToSend]);
        });
      }
    );

    [
      {
        sharesToRedeem: sharesToSellToBondHolder,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: sharesToSellToBondHolder
          .mul(BondConfig.collateralRatio)
          .div(ONE),
      },
      {
        sharesToRedeem: 0,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
    ].forEach(
      ({ sharesToRedeem, borrowingTokenToSend, collateralTokenToSend }) => {
        it("Bond is not repaid & past maturity = Withdraw of collateral", async () => {
          await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
          expect(
            await bond.connect(bondHolder).previewRedeem(sharesToRedeem)
          ).to.deep.equal([borrowingTokenToSend, collateralTokenToSend]);
        });
      }
    );

    [
      {
        sharesToRedeem: sharesToSellToBondHolder,
        borrowingTokenToSend: sharesToSellToBondHolder
          .mul(BondConfig.targetBondSupply.div(2))
          .div(BondConfig.targetBondSupply),
        collateralTokenToSend: sharesToSellToBondHolder
          .mul(
            // this is the amount of collateral in the contract. can't use await totalCollateral here since we're in the describe. could put in the beforeEach, but i'd rather be explicit here
            BondConfig.targetBondSupply
              .div(2)
              .mul(BondConfig.collateralRatio)
              .div(ONE)
          )
          .div(BondConfig.targetBondSupply.div(2)),
      },
      {
        sharesToRedeem: 0,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
    ].forEach(
      ({ sharesToRedeem, borrowingTokenToSend, collateralTokenToSend }) => {
        it("Bond is partially repaid & past maturity = Withdraw of collateral & borrowing", async () => {
          await bond.repay(BondConfig.targetBondSupply.div(2));
          await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
          expect(
            await bond.connect(bondHolder).previewRedeem(sharesToRedeem)
          ).to.deep.equal([borrowingTokenToSend, collateralTokenToSend]);
        });
      }
    );

    [
      {
        sharesToRedeem: sharesToSellToBondHolder,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
      {
        sharesToRedeem: 0,
        borrowingTokenToSend: BigNumber.from(0),
        collateralTokenToSend: BigNumber.from(0),
      },
    ].forEach(
      ({ sharesToRedeem, borrowingTokenToSend, collateralTokenToSend }) => {
        it("Bond is not repaid & not past maturity = No withdraw", async () => {
          expect(
            await bond.connect(bondHolder).previewRedeem(sharesToRedeem)
          ).to.deep.equal([borrowingTokenToSend, collateralTokenToSend]);
        });
      }
    );

    it("should redeem bond at maturity for borrowing token", async () => {
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
    it("should redeem bond at default for collateral token", async () => {
      const expectedCollateralToReceive = sharesToSellToBondHolder
        .mul(await bond.totalCollateral())
        .div(await bond.totalSupply());
      await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
      const {
        receiver,
        borrowingToken,
        collateralToken,
        amountOfBondsRedeemed,
        amountOfBorrowTokensReceived,
        amountOfCollateralReceived,
      } = await getEventArgumentsFromTransaction(
        await bond.connect(bondHolder).redeem(sharesToSellToBondHolder),
        "Redeem"
      );
      expect(receiver).to.equal(bondHolder.address);
      expect(collateralToken).to.equal(BondConfig.collateralToken);
      expect(amountOfBondsRedeemed).to.equal(sharesToSellToBondHolder);
      expect(amountOfBorrowTokensReceived).to.equal(0);
      expect(amountOfCollateralReceived).to.equal(expectedCollateralToReceive);

      expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
      expect(
        await mockUSDCToken.attach(borrowingToken).balanceOf(bondHolder.address)
      ).to.be.equal(0);
      expect(
        await mockUSDCToken
          .attach(BondConfig.collateralToken)
          .balanceOf(bondHolder.address)
      ).to.be.equal(
        BondConfig.collateralRatio
          .mul(sharesToSellToBondHolder)
          .div(utils.parseUnits("1", 18))
      );
    });
  });

  describe("conversion", async () => {
    describe("convertible bonds", async () => {
      const tokensToConvert = ConvertibleBondConfig.targetBondSupply;
      beforeEach(async () => {
        const token = mockUSDCToken.attach(
          ConvertibleBondConfig.collateralToken
        );
        const amountToDeposit = ConvertibleBondConfig.targetBondSupply
          .mul(ConvertibleBondConfig.collateralRatio)
          .div(utils.parseUnits("1", 18));
        await token.approve(convertibleBond.address, amountToDeposit);
        await convertibleBond.mint(ConvertibleBondConfig.targetBondSupply);
        await convertibleBond.transfer(bondHolder.address, tokensToConvert);
      });
      [
        { convertAmount: 0, assetsToReceive: 0, description: "zero converted" },
        {
          convertAmount: BondConfig.targetBondSupply,
          assetsToReceive: BondConfig.convertibilityRatio
            .mul(BondConfig.targetBondSupply)
            .div(ONE),
          description: "target converted",
        },
        {
          convertAmount: BondConfig.targetBondSupply.div(2),
          assetsToReceive: BondConfig.convertibilityRatio
            .mul(BondConfig.targetBondSupply.div(2))
            .div(ONE),
          description: "double target converted",
        },
      ].forEach(({ convertAmount, assetsToReceive, description }) => {
        it(`previews convert ${description}`, async () => {
          expect(await bond.previewConvert(convertAmount)).to.equal(
            assetsToReceive
          );
        });
      });
      it("converts bond amount into collateral at convertibilityRatio", async () => {
        const expectedCollateralToWithdraw = tokensToConvert
          .mul(ConvertibleBondConfig.convertibilityRatio)
          .div(utils.parseUnits("1", 18));
        await convertibleBond
          .connect(bondHolder)
          .approve(convertibleBond.address, tokensToConvert);
        const {
          convertorAddress,
          collateralToken,
          amountOfBondsConverted,
          amountOfCollateralReceived,
        } = await getEventArgumentsFromTransaction(
          await convertibleBond.connect(bondHolder).convert(tokensToConvert),
          "Converted"
        );
        expect(convertorAddress).to.equal(bondHolder.address);
        expect(collateralToken).to.equal(ConvertibleBondConfig.collateralToken);
        expect(amountOfBondsConverted).to.equal(tokensToConvert);
        expect(amountOfCollateralReceived).to.equal(
          expectedCollateralToWithdraw
        );
      });
    });
    describe("non-convertible bonds", async () => {
      it("fails to convert if bond is not convertible", async () => {
        await expect(
          bond.convert(BondConfig.targetBondSupply)
        ).to.be.revertedWith("ZeroAmount");
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
