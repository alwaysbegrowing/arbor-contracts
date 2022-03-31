import { utils, BytesLike, BigNumber } from "ethers";
import { expect } from "chai";
import { TestERC20, Bond, BondFactory } from "../../typechain";
import {
  expectTokenDelta,
  getBondContract,
  getEventArgumentsFromTransaction,
  getTargetCollateral,
  getTargetPayment,
  previewMintAndMint,
  previewRedeem,
  redeemAndCheckTokens,
} from "../utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "../shared/fixtures";
import { BondConfigType, BondWithTokens } from "../interfaces";
import {
  NonConvertibleBondConfig,
  ConvertibleBondConfig,
  UncollateralizedBondConfig,
  MaliciousBondConfig,
  ZERO,
  ONE,
} from "../constants";

const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

// Used throughout tests to use multiple instances of different-decimal tokens
const DECIMALS_TO_TEST = [6, 8, 18];

describe("e2e: Create -> Mint -> Convert -> Pay -> Withdraw -> Mature -> Redeem", () => {
  // owner deploys and is the "issuer"
  let owner: SignerWithAddress;
  // bondHolder is one who has the bonds and will redeem or convert them
  let bondHolder: SignerWithAddress;
  // attacker is trying to break the contract
  let attacker: SignerWithAddress;
  // our factory contract that deploys bonds
  let factory: BondFactory;
  // roles used with access control
  let withdrawRole: BytesLike;
  let mintRole: BytesLike;
  // this is a list of bonds created with the specific decimal tokens
  let bonds: BondWithTokens[];
  let roles: {
    defaultAdminRole: string;
    mintRole: string;
    withdrawRole: string;
  };
  // function to retrieve the bonds and tokens by decimal used
  const getBond = ({ decimals }: { decimals: number }) => {
    const foundBond = bonds.find((bond) => bond.decimals === decimals);
    if (!foundBond) {
      throw new Error(`No bond found for ${decimals}`);
    }
    return foundBond;
  };
  /** 
    the waffle "fixture" which creates the factory, tokens, bonds, and saves the state
    of the blockchain to speed up the re-execution of every test since this "resets"
    the state on the main beforeEach
  */
  async function fixture() {
    const { factory } = await bondFactoryFixture();
    const issuerRole = await factory.ISSUER_ROLE();

    await (await factory.grantRole(issuerRole, owner.address)).wait();

    /** 
      Create and deploy all tokens with corresponding decimals for DECIMALS_TO_TEST.
      The collateral token is not scaled in the same way that the payment token is.
      The collateral token can be scaled by the `collateralRatio`.
    */
    const { tokens } = await tokenFixture(DECIMALS_TO_TEST);
    /**
      The following maps over the DECIMALS_TO_TEST and returns a promise with an object
      containing the tokens, bonds, and the specific `decimals` used for that creation.
      This bond list resolves to deployed contracts and saved in this fixture.
      This fixture takes a snapshot of the blockchain with these contracts and will
      be fetched new upon `loadFixture()` in this "Bond" `beforeEach`.
    */
    const bonds = await Promise.all(
      DECIMALS_TO_TEST.map(async (decimals: number) => {
        // get the corresponding tokens for the decimal specified to use in the new bonds
        const token = tokens.find((token) => token.decimals === decimals);
        if (token) {
          const { attackingToken, paymentToken, collateralToken } = token;
          return {
            decimals,
            attackingToken,
            paymentToken,
            collateralToken,
            nonConvertible: {
              bond: await getBondContract(
                factory.createBond(
                  "Bond",
                  "LUG",
                  owner.address,
                  NonConvertibleBondConfig.maturityDate,
                  paymentToken.address,
                  collateralToken.address,
                  NonConvertibleBondConfig.collateralRatio,
                  NonConvertibleBondConfig.convertibleRatio,
                  NonConvertibleBondConfig.maxSupply
                )
              ),
              config: NonConvertibleBondConfig,
            },
            convertible: {
              bond: await getBondContract(
                factory.createBond(
                  "Bond",
                  "LUG",
                  owner.address,
                  ConvertibleBondConfig.maturityDate,
                  paymentToken.address,
                  collateralToken.address,
                  ConvertibleBondConfig.collateralRatio,
                  ConvertibleBondConfig.convertibleRatio,
                  ConvertibleBondConfig.maxSupply
                )
              ),
              config: ConvertibleBondConfig,
            },
            uncollateralized: {
              bond: await getBondContract(
                factory.createBond(
                  "Bond",
                  "LUG",
                  owner.address,
                  UncollateralizedBondConfig.maturityDate,
                  paymentToken.address,
                  collateralToken.address,
                  UncollateralizedBondConfig.collateralRatio,
                  UncollateralizedBondConfig.convertibleRatio,
                  UncollateralizedBondConfig.maxSupply
                )
              ),
              config: UncollateralizedBondConfig,
            },
            malicious: {
              bond: await getBondContract(
                factory.createBond(
                  "Bond",
                  "LUG",
                  owner.address,
                  MaliciousBondConfig.maturityDate,
                  attackingToken.address,
                  attackingToken.address,
                  MaliciousBondConfig.collateralRatio,
                  MaliciousBondConfig.convertibleRatio,
                  MaliciousBondConfig.maxSupply
                )
              ),
              config: MaliciousBondConfig,
            },
          };
        }
      })
    );

    // all bonds will be the same roles - take the first one
    let roles;
    if (bonds[0]) {
      const { nonConvertible } = bonds[0];
      roles = {
        defaultAdminRole: await nonConvertible.bond.DEFAULT_ADMIN_ROLE(),
        mintRole: await nonConvertible.bond.MINT_ROLE(),
        withdrawRole: await nonConvertible.bond.WITHDRAW_ROLE(),
      };
    }

    return {
      bonds,
      factory,
      roles,
    };
  }

  DECIMALS_TO_TEST.forEach((decimals) => {
    describe(`${decimals}-decimal payment token`, async () => {
      // bond instance to test. overwritten throughout testing
      let bond: Bond;
      let bondWithTokens: BondWithTokens;
      let config: BondConfigType;
      // tokens used throughout testing and are also overwritten (different decimal versions)
      let collateralToken: TestERC20;
      let paymentToken: TestERC20;

      describe("non-convertible", async () => {
        before(async () => {
          // the signers are assigned here and used throughout the tests
          [owner, bondHolder, attacker] = await ethers.getSigners();
          // this is the bonds used in the getBond function
          ({ bonds, factory, roles } = await loadFixture(fixture));
          ({ mintRole, withdrawRole } = roles);
          bondWithTokens = getBond({ decimals });
          ({ collateralToken, paymentToken } = bondWithTokens);
          bond = bondWithTokens.nonConvertible.bond;
          config = bondWithTokens.nonConvertible.config;
        });
        describe("bond is created", async () => {
          it("should disallow calling initialize again", async () => {
            await expect(
              bond.initialize(
                "Bond",
                "LUG",
                owner.address,
                config.maturityDate,
                paymentToken.address,
                collateralToken.address,
                utils.parseUnits(".25", 18),
                utils.parseUnits(".5", 18),
                config.maxSupply
              )
            ).to.be.revertedWith(
              "Initializable: contract is already initialized"
            );
          });

          it("should verifiable as bond by Factory.isBond", async () => {
            expect(await factory.isBond(bond.address)).to.be.equal(true);
          });

          it("should have no minted coins", async () => {
            expect(await bond.balanceOf(owner.address)).to.be.equal(0);
            expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
          });

          it("should have given issuer the default admin role", async () => {
            expect(
              await bond.hasRole(await bond.DEFAULT_ADMIN_ROLE(), owner.address)
            ).to.be.equal(true);
          });

          it("should return the issuer as the role admin for the withdraw role", async () => {
            expect(
              await bond.hasRole(
                await bond.getRoleAdmin(withdrawRole),
                owner.address
              )
            ).to.be.equal(true);
          });

          it("should return the issuer as the role admin for the mint role", async () => {
            expect(
              await bond.hasRole(
                await bond.getRoleAdmin(mintRole),
                owner.address
              )
            ).to.be.equal(true);
          });

          it("should return configured public parameters", async () => {
            expect(await bond.maturityDate()).to.be.equal(config.maturityDate);
            expect(await bond.collateralToken()).to.be.equal(
              collateralToken.address
            );
            expect(await bond.collateralRatio()).to.be.equal(
              config.collateralRatio
            );
            expect(await bond.convertibleRatio()).to.be.equal(
              config.convertibleRatio
            );

            expect(await bond.paymentToken()).to.be.equal(paymentToken.address);
          });

          it("should have configured ERC20 attributes", async () => {
            expect(await bond.name()).to.be.equal("Bond");
            expect(await bond.symbol()).to.be.equal("LUG");
          });
        });
        describe("issuer deposits collateral and mints bonds", async () => {
          it("should let issuer approve collateral transfer", async () => {
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
          });

          it("should revert when called by non-minter", async () => {
            await expect(bond.connect(attacker).mint(0)).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${mintRole}`
            );
          });

          it(`should preview mint and mint with zero target`, async () => {
            await previewMintAndMint({
              bond,
              collateralToken,
              mintAmount: ZERO,
              collateralToDeposit: ZERO,
            });
          });

          it(`should preview mint and mint with quarter target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(4))).to.not.be
              .reverted;
          });

          it(`should preview mint and mint with quarter target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(4))).to.not.be
              .reverted;
          });

          it(`should preview mint and mint with half target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(2))).to.not.be
              .reverted;
          });

          it("should not mint more than max supply", async () => {
            await expect(bond.mint(BigNumber.from(1))).to.be.revertedWith(
              "ERC20Capped: cap exceeded"
            );
          });
        });
        describe("bond holder can not convert part of their shares before maturity", async () => {
          it("should transfer bonds to bond holder", async () => {
            await bond.transfer(
              bondHolder.address,
              utils.parseUnits("1000", 18)
            );
          });

          it(`previews convert target converted`, async () => {
            expect(
              await bond.previewConvertBeforeMaturity(config.targetBondSupply)
            ).to.equal(ZERO);
          });

          it("should not allow conversion", async () => {
            await expect(
              bond.connect(bondHolder).convert(config.targetBondSupply)
            ).to.be.revertedWith("ZeroAmount");
          });
        });
        describe("issuer pays back the bond", async () => {
          it("should have issuer approve payment token", async () => {
            await paymentToken.approve(
              bond.address,
              config.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            );
          });

          it("should accept one third payment", async () => {
            const thirdSupply = config.targetBondSupply
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
          });

          it("should accept the remaining payment", async () => {
            const thirdSupply = config.targetBondSupply
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await expect(bond.pay(2)).to.emit(bond, "Payment");
          });

          it("should fail if already paid", async () => {
            await expect(bond.pay(BigNumber.from(1))).to.be.revertedWith(
              "PaymentMet"
            );
          });
        });
        describe("issuer withdraws maximum collateral possible", async () => {
          it("should allow all collateral to be withdrawn when fully paid", async () => {
            const targetPayment = getTargetPayment(config, decimals);
            await paymentToken.approve(bond.address, targetPayment);
            expect(await bond.totalSupply()).to.not.equal(0);
            await expectTokenDelta(
              bond.withdrawCollateral,
              collateralToken,
              owner,
              bond.address,
              getTargetCollateral(config)
            );
          });
        });
        describe("maturity is reached", async () => {
          it("should reach maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturityDate]);
          });
        });
        describe("redeem", async () => {
          it("should transfer tokens to the bond holder", async () => {
            await bond.transfer(
              bondHolder.address,
              utils.parseUnits("1000", 18)
            );
          });

          it("should redeem for payment token when bond is fully paid & not past maturity", async () => {
            await previewRedeem({
              bond,
              sharesToRedeem: utils.parseUnits("1000", 18),
              paymentTokenToSend: utils.parseUnits("1000", decimals),
              collateralTokenToSend: ZERO,
            });
            await redeemAndCheckTokens({
              bond,
              bondHolder,
              paymentToken,
              collateralToken,
              sharesToRedeem: utils.parseUnits("1000", 18),
              paymentTokenToSend: utils.parseUnits("1000", decimals),
              collateralTokenToSend: ZERO,
            });
          });
        });
      });
      describe("convertible", async () => {
        before(async () => {
          // the signers are assigned here and used throughout the tests
          [owner, bondHolder, attacker] = await ethers.getSigners();
          // this is the bonds used in the getBond function
          ({ bonds, factory, roles } = await loadFixture(fixture));
          ({ mintRole, withdrawRole } = roles);
          bondWithTokens = getBond({ decimals });
          ({ collateralToken, paymentToken } = bondWithTokens);
          bond = bondWithTokens.convertible.bond;
          config = bondWithTokens.convertible.config;
        });
        describe("bond is created", async () => {
          it("should disallow calling initialize again", async () => {
            await expect(
              bond.initialize(
                "Bond",
                "LUG",
                owner.address,
                config.maturityDate,
                paymentToken.address,
                collateralToken.address,
                utils.parseUnits(".25", 18),
                utils.parseUnits(".5", 18),
                config.maxSupply
              )
            ).to.be.revertedWith(
              "Initializable: contract is already initialized"
            );
          });

          it("should verifiable as bond by Factory.isBond", async () => {
            expect(await factory.isBond(bond.address)).to.be.equal(true);
          });

          it("should have no minted coins", async () => {
            expect(await bond.balanceOf(owner.address)).to.be.equal(0);
            expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
          });

          it("should have given issuer the default admin role", async () => {
            expect(
              await bond.hasRole(await bond.DEFAULT_ADMIN_ROLE(), owner.address)
            ).to.be.equal(true);
          });

          it("should return the issuer as the role admin for the withdraw role", async () => {
            expect(
              await bond.hasRole(
                await bond.getRoleAdmin(withdrawRole),
                owner.address
              )
            ).to.be.equal(true);
          });

          it("should return the issuer as the role admin for the mint role", async () => {
            expect(
              await bond.hasRole(
                await bond.getRoleAdmin(mintRole),
                owner.address
              )
            ).to.be.equal(true);
          });

          it("should return configured public parameters", async () => {
            expect(await bond.maturityDate()).to.be.equal(config.maturityDate);
            expect(await bond.collateralToken()).to.be.equal(
              collateralToken.address
            );
            expect(await bond.collateralRatio()).to.be.equal(
              config.collateralRatio
            );
            expect(await bond.convertibleRatio()).to.be.equal(
              config.convertibleRatio
            );

            expect(await bond.paymentToken()).to.be.equal(paymentToken.address);
          });

          it("should have configured ERC20 attributes", async () => {
            expect(await bond.name()).to.be.equal("Bond");
            expect(await bond.symbol()).to.be.equal("LUG");
          });
        });
        describe("issuer deposits collateral and mints bonds", async () => {
          it("should let issuer approve collateral transfer", async () => {
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
          });

          it("should revert when called by non-minter", async () => {
            await expect(bond.connect(attacker).mint(0)).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${mintRole}`
            );
          });

          it(`should preview mint and mint with zero target`, async () => {
            await previewMintAndMint({
              bond,
              collateralToken,
              mintAmount: ZERO,
              collateralToDeposit: ZERO,
            });
          });

          it(`should preview mint and mint with quarter target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(4))).to.not.be
              .reverted;
          });

          it(`should preview mint and mint with quarter target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(4))).to.not.be
              .reverted;
          });

          it(`should preview mint and mint with half target`, async () => {
            await expect(bond.mint(config.targetBondSupply.div(2))).to.not.be
              .reverted;
          });

          it("should not mint more than max supply", async () => {
            await expect(bond.mint(BigNumber.from(1))).to.be.revertedWith(
              "ERC20Capped: cap exceeded"
            );
          });
        });
        describe("bond holder can convert part of their shares before maturity", async () => {
          it("should transfer bonds to bond holder", async () => {
            await bond.transfer(
              bondHolder.address,
              utils.parseUnits("1000", 18)
            );
          });

          it(`previews convert target converted`, async () => {
            expect(
              await bond.previewConvertBeforeMaturity(config.targetBondSupply)
            ).to.equal(
              config.targetBondSupply.mul(config.convertibleRatio).div(ONE)
            );
          });

          it("should allow conversion", async () => {
            const {
              from,
              collateralToken: convertedCollateralToken,
              amountOfBondsConverted,
              amountOfCollateralTokens,
            } = await getEventArgumentsFromTransaction(
              await bond
                .connect(bondHolder)
                .convert(utils.parseUnits("1000", 18)),
              "Convert"
            );
            expect(from).to.equal(bondHolder.address);
            expect(convertedCollateralToken).to.equal(collateralToken.address);
            expect(amountOfBondsConverted).to.equal(
              utils.parseUnits("1000", 18)
            );
            expect(amountOfCollateralTokens).to.equal(
              utils.parseUnits("1000", 18).mul(config.convertibleRatio).div(ONE)
            );
          });
        });
        describe("issuer withdraws the portion of collateral unlocked by the conversion", async () => {
          it("should allow withdrawl of the portion of collateral", async () => {
            expect(await bond.totalSupply()).to.equal(
              config.targetBondSupply.sub(utils.parseUnits("1000", 18))
            );
            const totalBonds = await bond.totalSupply();
            const totalCollateralRequired = totalBonds
              .mul(config.collateralRatio)
              .div(ONE);
            const collateralToWithdraw = (await bond.totalCollateral()).sub(
              totalCollateralRequired
            );
            await expect(bond.withdrawCollateral).to.changeTokenBalance(
              collateralToken,
              owner,
              collateralToWithdraw
            );
          });
        });
        describe("issuer pays back the bond", async () => {
          it("should have issuer approve payment token", async () => {
            await paymentToken.approve(
              bond.address,
              config.targetBondSupply
                .sub(utils.parseUnits("1000", 18))
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            );
          });

          it("should accept one third payment", async () => {
            const thirdSupply = config.targetBondSupply
              .sub(utils.parseUnits("1000", 18))
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
          });

          it("should accept the remaining payment", async () => {
            const thirdSupply = config.targetBondSupply
              .sub(utils.parseUnits("1000", 18))
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await expect(bond.pay(1)).to.emit(bond, "Payment");
          });

          it("should fail if already paid", async () => {
            await expect(bond.pay(BigNumber.from(1))).to.be.revertedWith(
              "PaymentMet"
            );
          });
        });
        describe("issuer withdraws maximum collateral possible", async () => {
          it("should allow non-convertible collateral to be withdrawn when fully paid", async () => {
            const convertibleCollateralRequired = (await bond.totalSupply())
              .mul(config.convertibleRatio)
              .div(ONE);
            await expect(bond.withdrawCollateral).to.changeTokenBalance(
              collateralToken,
              owner,
              (await bond.totalCollateral()).sub(convertibleCollateralRequired)
            );
          });
        });
        describe("maturity is reached", async () => {
          it("should reach maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturityDate]);
          });
        });
        describe("redeem", async () => {
          it("should transfer tokens to the bond holder", async () => {
            await bond.transfer(
              bondHolder.address,
              utils.parseUnits("1000", 18)
            );
          });

          it("should redeem for payment token when bond is fully paid & not past maturity", async () => {
            await previewRedeem({
              bond,
              sharesToRedeem: utils.parseUnits("1000", 18),
              paymentTokenToSend: utils.parseUnits("1000", decimals),
              collateralTokenToSend: ZERO,
            });
            await redeemAndCheckTokens({
              bond,
              bondHolder,
              paymentToken,
              collateralToken,
              sharesToRedeem: utils.parseUnits("1000", 18),
              paymentTokenToSend: utils.parseUnits("1000", decimals),
              collateralTokenToSend: ZERO,
            });
          });
        });
      });
    });
  });
});
