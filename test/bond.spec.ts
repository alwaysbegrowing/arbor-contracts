import { BigNumber, utils, BytesLike } from "ethers";
import { expect, util } from "chai";
import { TestERC20, Bond, BondFactory } from "../typechain";
import {
  expectTokenDelta,
  getBondContract,
  getEventArgumentsFromTransaction,
  getTargetCollateral,
  getTargetPayment,
} from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";
import { BondConfigType, BondWithTokens } from "./interfaces";
import {
  ONE,
  ZERO,
  NonConvertibleBondConfig,
  ConvertibleBondConfig,
  UncollateralizedBondConfig,
} from "./constants";

// <https://ethereum-waffle.readthedocs.io/en/latest/fixtures.html>
// import from waffle since we are using hardhat: <https://hardhat.org/plugins/nomiclabs-hardhat-waffle.html#environment-extensions>
const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

// Used throughout tests to use multiple instances of different-decimal tokens
const DECIMALS_TO_TEST = [6, 8, 18];

/**
  The following `describe` encompasses the whole Bond contract split
  up into the main functions of the contract. Most of the defined variables
  inside this main `describe` are assigned in the first `beforeEach`.
  The rest of the variables are assigned in the `beforeEach` within
  the main DECIMALS_TO_TEST forEach loop. Within each main category
  also contains usage of different bond types (see the above configs):

  bond - a bond with a ZERO convertibilityRatio (not convertible)
  convertibleBond - a bond with a defined convertibilityRatio
  uncollateralizedBond - a bond with zero collateral (not convertible)
  
  Recommended to use your editors "fold all" and unfolding the test of interest.
  "command / ctrl + k" -> "command / ctrl 0" for Visual Studio Code
*/
describe("Bond", () => {
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

  beforeEach(async () => {
    // the signers are assigned here and used throughout the tests
    [owner, bondHolder, attacker] = await ethers.getSigners();
    // this is the bonds used in the getBond function
    ({ bonds, factory, roles } = await loadFixture(fixture));
    ({ mintRole, withdrawRole } = roles);
  });

  /**
    Here, loop over all DECIMALS_TO_TEST list of decimals, running all of the tests.
    In the `beforeEach` the bonds configured with either the `BondConfig`, `ConvertibleBondConfig`,
    or `UncollateralizedBondConfig` and the tokens within use the specified decimals. See the `fixture()`
    to understand how this bond list is created.
  */
  DECIMALS_TO_TEST.forEach((decimals) => {
    describe(`${decimals}-decimal payment token`, async () => {
      // bond instance to test. overwritten throughout testing
      let bond: Bond;
      let bondWithTokens: BondWithTokens;
      let config: BondConfigType;
      // tokens used throughout testing and are also overwritten (different decimal versions)
      let collateralToken: TestERC20;
      let attackingToken: TestERC20;
      let paymentToken: TestERC20;
      beforeEach(async () => {
        bondWithTokens = getBond({ decimals });
        ({ attackingToken, collateralToken, paymentToken } = bondWithTokens);
      });
      describe("initialization", async () => {
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
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

          it("should return total value for an account", async () => {
            expect(
              await bond.connect(bondHolder).balanceOf(owner.address)
            ).to.be.equal(0);
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

          it("should revert on less collateral than convertible ratio", async () => {
            await expect(
              factory.createBond(
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
            ).to.be.revertedWith("CollateralRatioLessThanConvertibleRatio");
          });

          it("should revert on too big of a token", async () => {
            const token = (await tokenFixture([20])).tokens.find(
              (token) => token.decimals === 20
            );
            if (token) {
              const { paymentToken } = token;
              await expect(
                factory.createBond(
                  "Bond",
                  "LUG",
                  owner.address,
                  config.maturityDate,
                  paymentToken.address,
                  collateralToken.address,
                  config.collateralRatio,
                  config.convertibleRatio,
                  config.maxSupply
                )
              ).to.be.revertedWith("TokenOverflow");
            } else {
              throw new Error("Token not found!");
            }
          });
          it("should revert on a token without decimals", async () => {
            await expect(
              factory.createBond(
                "Bond",
                "LUG",
                owner.address,
                config.maturityDate,
                factory.address, // using the factory as a non-erc20 address here
                collateralToken.address,
                config.collateralRatio,
                config.convertibleRatio,
                config.maxSupply
              )
            ).to.be.revertedWith("function selector was not recognized");
          });
        });
      });
      describe(`mint`, async () => {
        describe("convertible", () => {
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
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

          it(`should preview mint and mint`, async () => {
            [
              {
                mintAmount: 0,
                collateralToDeposit: ZERO,
                description: "with zero target",
              },
              {
                mintAmount: config.targetBondSupply.div(4),
                collateralToDeposit: config.collateralRatio
                  .mul(config.targetBondSupply.div(4))
                  .div(ONE),
                description: "with quarter target",
              },
              {
                mintAmount: config.targetBondSupply.div(2),
                collateralToDeposit: config.collateralRatio
                  .mul(config.targetBondSupply.div(2))
                  .div(ONE),
                description: "with half target",
              },
              {
                mintAmount: config.targetBondSupply,
                collateralToDeposit: getTargetCollateral(config),
                description: "with target",
              },
              {
                mintAmount: utils.parseUnits("1", 18).sub(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "when collateral rounds up",
              },
            ].forEach(
              async ({ mintAmount, collateralToDeposit, description }) => {
                expect(
                  await bond.previewMintBeforeMaturity(mintAmount)
                ).to.equal(collateralToDeposit);

                await expect(bond.mint(mintAmount)).to.not.be.reverted;
                expect(await bond.totalSupply()).to.equal(mintAmount);
                expect(
                  await collateralToken.balanceOf(bond.address)
                ).to.be.equal(collateralToDeposit);
              }
            );
          });

          it(`should fail to mint`, async () => {
            [
              {
                mintAmount: utils.parseUnits("1", 18),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE)
                  .sub(1),
                description: "when collateral rounds down",
              },
              {
                mintAmount: utils.parseUnits("1", 18).add(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "when collateral rounds down",
              },
              {
                mintAmount: utils.parseUnits("1", 18).sub(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE)
                  .sub(1),
                description: "when both round down",
              },
            ].forEach(
              async ({ mintAmount, collateralToDeposit, description }) => {
                expect(
                  await bond.previewMintBeforeMaturity(mintAmount)
                ).to.not.equal(collateralToDeposit);
              }
            );
          });

          it("should not mint more than max supply", async () => {
            await expect(
              bond.mint(config.targetBondSupply.add(1))
            ).to.be.revertedWith("BondSupplyExceeded");
          });

          it("should not mint after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturityDate]);
            await expect(bond.mint(config.targetBondSupply)).to.be.revertedWith(
              "BondPastMaturity"
            );
          });
        });
        describe("non-convertible", () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
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

          it(`should preview mint and mint`, async () => {
            [
              {
                mintAmount: 0,
                collateralToDeposit: ZERO,
                description: "with zero target",
              },
              {
                mintAmount: config.targetBondSupply.div(4),
                collateralToDeposit: config.collateralRatio
                  .mul(config.targetBondSupply.div(4))
                  .div(ONE),
                description: "with quarter target",
              },
              {
                mintAmount: config.targetBondSupply.div(2),
                collateralToDeposit: config.collateralRatio
                  .mul(config.targetBondSupply.div(2))
                  .div(ONE),
                description: "with half target",
              },
              {
                mintAmount: config.targetBondSupply,
                collateralToDeposit: getTargetCollateral(config),
                description: "with target",
              },
              {
                mintAmount: utils.parseUnits("1", 18).sub(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "when collateral rounds up",
              },
            ].forEach(
              async ({ mintAmount, collateralToDeposit, description }) => {
                expect(
                  await bond.previewMintBeforeMaturity(mintAmount)
                ).to.equal(collateralToDeposit);
                await expect(bond.mint(mintAmount)).to.not.be.reverted;
                expect(await bond.totalSupply()).to.equal(mintAmount);
                expect(
                  await collateralToken.balanceOf(bond.address)
                ).to.be.equal(collateralToDeposit);
              }
            );
          });

          it(`should fail to mint`, async () => {
            [
              {
                mintAmount: utils.parseUnits("1", 18),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE)
                  .sub(1),
                description: "when collateral rounds down",
              },
              {
                mintAmount: utils.parseUnits("1", 18).add(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "when collateral rounds down",
              },
              {
                mintAmount: utils.parseUnits("1", 18).sub(1),
                collateralToDeposit: utils
                  .parseUnits("1", 18)
                  .mul(config.collateralRatio)
                  .div(ONE)
                  .sub(1),
                description: "when both round down",
              },
            ].forEach(
              async ({ mintAmount, collateralToDeposit, description }) => {
                expect(
                  await bond.previewMintBeforeMaturity(mintAmount)
                ).to.not.equal(collateralToDeposit);
              }
            );
          });

          it("should not mint more than max supply", async () => {
            await expect(
              bond.mint(config.targetBondSupply.add(1))
            ).to.be.revertedWith("BondSupplyExceeded");
          });

          it("should not mint after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturityDate]);
            await expect(bond.mint(config.targetBondSupply)).to.be.revertedWith(
              "BondPastMaturity"
            );
          });
        });
        describe("uncollateralized", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.uncollateralized.bond;
            config = bondWithTokens.uncollateralized.config;
          });
          it("should revert when called by non-minter", async () => {
            await expect(bond.connect(attacker).mint(0)).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${mintRole}`
            );
          });

          it(`should preview mint and mint`, async () => {
            [
              {
                mintAmount: 0,
                collateralToDeposit: ZERO,
                description: "with zero target",
              },
              {
                mintAmount: config.targetBondSupply.div(4),
                collateralToDeposit: ZERO,
                description: "with quarter target",
              },
              {
                mintAmount: config.targetBondSupply.div(2),
                collateralToDeposit: ZERO,
                description: "with half target",
              },
              {
                mintAmount: config.targetBondSupply,
                collateralToDeposit: ZERO,
                description: "with target",
              },
              {
                mintAmount: utils.parseUnits("1", 18).sub(1),
                collateralToDeposit: ZERO,
                description: "when collateral rounds up",
              },
            ].forEach(
              async ({ mintAmount, collateralToDeposit, description }) => {
                expect(
                  await bond.previewMintBeforeMaturity(mintAmount)
                ).to.equal(collateralToDeposit);
                await expect(bond.mint(mintAmount)).to.not.be.reverted;
                expect(await bond.totalSupply()).to.equal(mintAmount);
                expect(
                  await collateralToken.balanceOf(bond.address)
                ).to.be.equal(collateralToDeposit);
              }
            );
          });

          it("should not mint more than max supply", async () => {
            await expect(
              bond.mint(config.targetBondSupply.add(1))
            ).to.be.revertedWith("BondSupplyExceeded");
          });

          it("should not mint after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturityDate]);
            await expect(bond.mint(config.targetBondSupply)).to.be.revertedWith(
              "BondPastMaturity"
            );
          });
        });
      });
      describe(`pay`, async () => {
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
            await expect(bond.mint(config.targetBondSupply)).to.not.be.reverted;
            await paymentToken.approve(
              bond.address,
              config.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            );
          });
          it("should accept partial payment", async () => {
            const halfSupplyMinusOne = config.targetBondSupply
              .div(2)
              .sub(1)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);

            await (await bond.pay(BigNumber.from(1))).wait();
            await (await bond.pay(halfSupplyMinusOne)).wait();
            await expect(bond.pay(halfSupplyMinusOne)).to.emit(bond, "Payment");
          });

          it("should accept full payment in steps", async () => {
            const thirdSupply = config.targetBondSupply
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await expect(bond.pay(2)).to.emit(bond, "Payment");
          });

          it("should accept payment", async () => {
            await expect(bond.pay(getTargetPayment(config, decimals))).to.emit(
              bond,
              "Payment"
            );
          });

          it("should fail if already repaid", async () => {
            await bond.pay(
              config.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            );
            await expect(
              bond.pay(getTargetPayment(config, decimals))
            ).to.be.revertedWith("PaymentMet");
          });
        });
      });
      describe("withdrawCollateral", async () => {
        describe(`non-convertible`, async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
            await bond.mint(config.targetBondSupply);
          });
          it(`should make excess collateral available to withdraw when they are burned`, async () => {
            [
              {
                sharesToBurn: 0,
                collateralToReceive: ZERO,
                description: "zero amount",
              },
              {
                sharesToBurn: BigNumber.from(1),
                collateralToReceive: ZERO,
                description: "collateral rounded down",
              },
              {
                sharesToBurn: ONE.div(config.collateralRatio),
                collateralToReceive: BigNumber.from(1),
                description: "smallest unit",
              },
              {
                sharesToBurn: config.targetBondSupply,
                collateralToReceive: getTargetCollateral(config),
                description: "total amount",
              },
            ].forEach(
              async ({ sharesToBurn, collateralToReceive, description }) => {
                await (await bond.burn(sharesToBurn)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it(`should make excess collateral available to withdraw they when payment token is partially repaid`, async () => {
            [
              {
                paymentTokenAmount: utils.parseUnits("1000", decimals),
                collateralToReceive: utils
                  .parseUnits("1000", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "one to one",
              },
              {
                paymentTokenAmount: utils.parseUnits("1000", decimals).add(1),
                collateralToReceive: utils
                  .parseUnits("1000", 18)
                  .add(utils.parseUnits("1", 18 - decimals))
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "collateral in scaled magnitude",
              },
              {
                paymentTokenAmount: utils.parseUnits("1000", decimals).sub(1),
                collateralToReceive: utils
                  .parseUnits("1000", 18)
                  .sub(utils.parseUnits("1", 18 - decimals))
                  .mul(config.collateralRatio)
                  .div(ONE),
                description: "collateral in scaled magnitude",
              },
            ].forEach(
              async ({
                paymentTokenAmount,
                collateralToReceive,
                description,
              }) => {
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should make excess collateral available to withdraw when payment token is fully repaid", async () => {
            [
              {
                sharesToBurn: 0,
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
              {
                sharesToBurn: utils.parseUnits("1000", 18),
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
            ].forEach(
              async ({
                sharesToBurn,
                paymentTokenAmount,
                collateralToReceive,
              }) => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should make excess collateral available to withdraw when maturity is reached", async () => {
            [
              {
                sharesToBurn: 0,
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
              {
                sharesToBurn: 0,
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
            ].forEach(
              async ({
                sharesToBurn,
                paymentTokenAmount,
                collateralToReceive,
              }) => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should allow all collateral to be withdrawn when all bonds are burned", async () => {
            await bond.burn(config.targetBondSupply);
            expect(await bond.totalSupply()).to.equal(0);
            await expectTokenDelta(
              bond.withdrawCollateral,
              collateralToken,
              owner,
              owner.address,
              getTargetCollateral(config)
            );
            expect(await collateralToken.balanceOf(bond.address)).to.equal(0);
          });

          it("should allow all collateral to be withdrawn when fully paid", async () => {
            const targetPayment = getTargetPayment(config, decimals);
            await paymentToken.approve(bond.address, targetPayment);
            await expectTokenDelta(
              bond.pay.bind(this, targetPayment),
              paymentToken,
              owner,
              bond.address,
              targetPayment
            );
            expect(await bond.totalSupply()).to.not.equal(0);
            await expectTokenDelta(
              bond.withdrawCollateral,
              collateralToken,
              owner,
              bond.address,
              getTargetCollateral(config)
            );
          });

          it("should revert when called by non-withdrawer", async () => {
            await expect(
              bond.connect(attacker).withdrawCollateral()
            ).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
            );
          });

          it("should grant and revoke withdraw role", async () => {
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
        describe(`convertible`, async () => {
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
            await bond.mint(config.targetBondSupply);
          });
          [
            {
              sharesToBurn: 0,
              collateralToReceive: ZERO,
            },
            {
              sharesToBurn: utils.parseUnits("1000", 18),
              collateralToReceive: utils
                .parseUnits("1000", 18)
                .mul(config.collateralRatio)
                .div(ONE),
            },
          ].forEach(async ({ sharesToBurn, collateralToReceive }) => {
            it("should make collateral available to withdraw when bonds are burned", async () => {
              await (await bond.burn(sharesToBurn)).wait();
              expect(await bond.previewWithdraw()).to.equal(
                collateralToReceive
              );
            });
          });

          it("should make excess collateral available to withdraw when payment token is partially repaid", async () => {
            [
              {
                sharesToBurn: 0,
                paymentTokenAmount: utils.parseUnits("1000", decimals),
                collateralToReceive: utils
                  .parseUnits("1000", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
              },
              {
                sharesToBurn: utils.parseUnits("1000", 18),
                paymentTokenAmount: utils.parseUnits("1000", decimals),
                collateralToReceive: utils
                  .parseUnits("2000", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
              },
            ].forEach(
              async ({
                sharesToBurn,
                paymentTokenAmount,
                collateralToReceive,
              }) => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should make excess collateral available to withdraw when payment token is fully repaid", async () => {
            [
              {
                sharesToBurn: 0,
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
              {
                sharesToBurn: utils.parseUnits("1000", 18),
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
            ].forEach(
              async ({
                sharesToBurn,
                paymentTokenAmount,
                collateralToReceive,
              }) => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should make excess collateral available to withdraw when maturity is reached", async () => {
            [
              {
                sharesToBurn: 0,
                paymentTokenAmount: config.targetBondSupply
                  .div(4)
                  .mul(utils.parseUnits("1", decimals))
                  .div(ONE),
                collateralToReceive: config.targetBondSupply
                  .div(4)
                  .mul(config.collateralRatio)
                  .div(ONE),
              },
              {
                sharesToBurn: 0,
                paymentTokenAmount: getTargetPayment(config, decimals),
                collateralToReceive: getTargetCollateral(config),
              },
            ].forEach(
              async ({
                sharesToBurn,
                paymentTokenAmount,
                collateralToReceive,
              }) => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                await ethers.provider.send("evm_mine", [config.maturityDate]);
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });
          it("should revert when called by non-withdrawer", async () => {
            await expect(
              bond.connect(attacker).withdrawCollateral()
            ).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
            );
          });

          it("should grant and revoke withdraw role", async () => {
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
        describe(`uncollateralized`, async () => {
          beforeEach(async () => {
            bond = bondWithTokens.uncollateralized.bond;
            config = bondWithTokens.uncollateralized.config;
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(UncollateralizedBondConfig)
            );
            await bond.mint(config.targetBondSupply);
          });
          it(`should have zero collateral available to withdraw when they are burned`, async () => {
            [
              {
                sharesToBurn: 0,
                collateralToReceive: ZERO,
                description: "zero amount",
              },
              {
                sharesToBurn: BigNumber.from(1),
                collateralToReceive: ZERO,
                description: "collateral rounded down",
              },
              {
                sharesToBurn: config.targetBondSupply,
                collateralToReceive: getTargetCollateral(
                  UncollateralizedBondConfig
                ),
                description: "total amount",
              },
            ].forEach(
              async ({ sharesToBurn, collateralToReceive, description }) => {
                await (await bond.burn(sharesToBurn)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              }
            );
          });

          it("should make excess collateral available to withdraw", async () => {
            await collateralToken.approve(bond.address, utils.parseEther("1"));
            await collateralToken.transfer(bond.address, utils.parseEther("1"));
            expect(await bond.previewWithdraw()).to.equal(
              utils.parseEther("1")
            );
          });

          it("should revert when called by non-withdrawer", async () => {
            await expect(
              bond.connect(attacker).withdrawCollateral()
            ).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
            );
          });

          it("should grant and revoke withdraw role", async () => {
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
      });
      describe(`redeem`, async () => {
        describe("non-convertible", async () => {
          let totalPaid: BigNumber;
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            totalPaid = config.targetBondSupply
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
            await bond.mint(config.targetBondSupply);
            await bond.transfer(
              bondHolder.address,
              utils.parseUnits("4000", 18)
            );
            await paymentToken.approve(bond.address, config.targetBondSupply);
          });
          // Bond holder will have their bonds and the contract will be able to accept deposits of payment token

          it("should withdraw of payment token when bond is repaid & past maturity", async () => {
            [
              {
                sharesToRedeem: utils.parseUnits("1000", 18),
                paymentTokenToSend: utils.parseUnits("1000", decimals),
                collateralTokenToSend: ZERO,
              },
              {
                sharesToRedeem: 0,
                paymentTokenToSend: ZERO,
                collateralTokenToSend: ZERO,
              },
              {
                sharesToRedeem: utils.parseUnits("333", 18),
                paymentTokenToSend: utils.parseUnits("333", decimals),
                collateralTokenToSend: ZERO,
              },
            ].forEach(
              async ({
                sharesToRedeem,
                paymentTokenToSend,
                collateralTokenToSend,
              }) => {
                await bond.pay(totalPaid);
                await ethers.provider.send("evm_mine", [config.maturityDate]);

                const [paymentToken, collateralToken] = await bond
                  .connect(bondHolder)
                  .previewRedeemAtMaturity(sharesToRedeem);
                expect(paymentToken).to.equal(paymentTokenToSend);
                expect(collateralToken).to.equal(collateralTokenToSend);
              }
            );
          });

          it("should allow withdraw of collateral when bond is not repaid & past maturity ", async () => {
            [
              {
                sharesToRedeem: utils.parseUnits("1000", 18),
                paymentTokenToSend: ZERO,
                collateralTokenToSend: utils
                  .parseUnits("1000", 18)
                  .mul(config.collateralRatio)
                  .div(ONE),
              },
              {
                sharesToRedeem: 0,
                paymentTokenToSend: ZERO,
                collateralTokenToSend: ZERO,
              },
            ].forEach(
              async ({
                sharesToRedeem,
                paymentTokenToSend,
                collateralTokenToSend,
              }) => {
                await ethers.provider.send("evm_mine", [config.maturityDate]);
                const [paymentTokens, collateralTokens] = await bond
                  .connect(bondHolder)
                  .previewRedeemAtMaturity(sharesToRedeem);
                expect(paymentTokens).to.equal(paymentTokenToSend);
                expect(collateralTokens).to.equal(collateralTokenToSend);
              }
            );
          });

          it("should allow withdraw of collateral & payment token when bond is partially repaid & past maturity =", async () => {
            [
              {
                // this is the most confusing thing i've seen in my entire life.
                // I appreciate your looking
                // These tokens are being sent in to pay() - imagine the issuer paying partially
                tokensToPay: utils.parseUnits("4000", decimals),
                // These are the shares requested by the bond holder
                sharesToRedeem: utils.parseUnits("4000", 18),
                // this is the expected amount of payment tokens to send to the bond holder
                paymentTokenToSend: utils // first we get our portion of the total tokens
                  .parseUnits("4000", 18)
                  .mul(ONE)
                  .div(config.targetBondSupply)
                  .mul(utils.parseUnits("4000", decimals)) // then multiply that by the payment amount
                  .div(ONE),
                collateralTokenToSend: config.targetBondSupply // here we get the total supply minus the repaid tokens
                  .sub(utils.parseUnits("4000", 18))
                  .mul(config.collateralRatio) // multipy by the collateral ratio to get the amount of collateral tokens to send
                  .div(ONE)
                  .mul(utils.parseUnits("4000", 18)) // and then use our portion of the total amount of tokens to get how many owed
                  .div(config.targetBondSupply),
              },
            ].forEach(
              async ({
                tokensToPay,
                sharesToRedeem,
                paymentTokenToSend,
                collateralTokenToSend,
              }) => {
                await bond.pay(tokensToPay);
                await ethers.provider.send("evm_mine", [config.maturityDate]);
                const [paymentTokens, collateralTokens] = await bond
                  .connect(bondHolder)
                  .previewRedeemAtMaturity(sharesToRedeem);
                expect(paymentTokens).to.equal(paymentTokenToSend);
                expect(collateralTokens).to.equal(collateralTokenToSend);
              }
            );
          });

          it("should redeem bond at maturity for payment token", async () => {
            await bond.pay(
              config.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            );
            // Fast forward to expire
            await ethers.provider.send("evm_mine", [config.maturityDate]);

            expect(await bond.balanceOf(bondHolder.address)).to.be.equal(
              utils.parseUnits("4000", 18)
            );
            await bond.connect(bondHolder).redeem(utils.parseUnits("4000", 18));
            expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
            expect(
              await paymentToken.balanceOf(bondHolder.address)
            ).to.be.equal(utils.parseUnits("4000", decimals));
          });
          it("should redeem bond at default for collateral token", async () => {
            const expectedCollateralToReceive = utils
              .parseUnits("4000", 18)
              .mul(await bond.totalCollateral())
              .div(await bond.totalSupply());
            await ethers.provider.send("evm_mine", [config.maturityDate]);
            const {
              from,
              paymentToken: paymentTokenAddress,
              collateralToken: convertedCollateralToken,
              amountOfBondsRedeemed,
              amountOfPaymentTokensReceived,
              amountOfCollateralTokens,
            } = await getEventArgumentsFromTransaction(
              await bond
                .connect(bondHolder)
                .redeem(utils.parseUnits("4000", 18)),
              "Redeem"
            );
            expect(from).to.equal(bondHolder.address);
            expect(convertedCollateralToken).to.equal(collateralToken.address);
            expect(amountOfBondsRedeemed).to.equal(
              utils.parseUnits("4000", 18)
            );
            expect(amountOfPaymentTokensReceived).to.equal(0);
            expect(amountOfCollateralTokens).to.equal(
              expectedCollateralToReceive
            );

            expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
            expect(
              await paymentToken
                .attach(paymentTokenAddress)
                .balanceOf(bondHolder.address)
            ).to.be.equal(0);
            expect(
              await collateralToken.balanceOf(bondHolder.address)
            ).to.be.equal(
              config.collateralRatio.mul(utils.parseUnits("4000", 18)).div(ONE)
            );
          });
        });
      });
      describe("convert", async () => {
        describe("convertible", async () => {
          let tokensToConvert: BigNumber;
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
            tokensToConvert = config.targetBondSupply;
            await collateralToken.approve(
              bond.address,
              getTargetCollateral(config)
            );
            await bond.mint(config.targetBondSupply);
            await bond.transfer(bondHolder.address, tokensToConvert);
          });
          it(`previews convert they`, async () => {
            [
              {
                convertAmount: 0,
                assetsToReceive: 0,
                description: "zero converted",
              },
              {
                convertAmount: config.targetBondSupply,
                assetsToReceive: config.convertibleRatio
                  .mul(config.targetBondSupply)
                  .div(ONE),
                description: "target converted",
              },
              {
                convertAmount: config.targetBondSupply.div(2),
                assetsToReceive: config.convertibleRatio
                  .mul(config.targetBondSupply.div(2))
                  .div(ONE),
                description: "double target converted",
              },
            ].forEach(
              async ({ convertAmount, assetsToReceive, description }) => {
                expect(
                  await bond.previewConvertBeforeMaturity(convertAmount)
                ).to.equal(assetsToReceive);
              }
            );
          });
          it("should convert bond amount into collateral at convertibleRatio", async () => {
            const expectedCollateralToWithdraw = tokensToConvert
              .mul(config.convertibleRatio)
              .div(ONE);
            await bond
              .connect(bondHolder)
              .approve(bond.address, tokensToConvert);
            const {
              from,
              collateralToken: convertedCollateralToken,
              amountOfBondsConverted,
              amountOfCollateralTokens,
            } = await getEventArgumentsFromTransaction(
              await bond.connect(bondHolder).convert(tokensToConvert),
              "Convert"
            );
            expect(from).to.equal(bondHolder.address);
            expect(convertedCollateralToken).to.equal(collateralToken.address);
            expect(amountOfBondsConverted).to.equal(tokensToConvert);
            expect(amountOfCollateralTokens).to.equal(
              expectedCollateralToWithdraw
            );
          });
        });
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
          });
          it("should fail to convert if bond is not convertible", async () => {
            await expect(
              bond.convert(config.targetBondSupply)
            ).to.be.revertedWith("ZeroAmount");
          });
        });
        describe("uncollateralized", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.uncollateralized.bond;
            config = bondWithTokens.uncollateralized.config;
          });
          it("should fail to convert if bond is uncollateralized and therefore unconvertible", async () => {
            await expect(
              bond.convert(config.targetBondSupply)
            ).to.be.revertedWith("ZeroAmount");
          });
        });
      });
      describe("sweep", async () => {
        describe("non convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
          });
          it("should remove a token from the contract", async () => {
            await attackingToken.connect(attacker).transfer(bond.address, 1000);
            await bond.sweep(attackingToken.address);
            expect(await attackingToken.balanceOf(owner.address)).to.be.equal(
              1000
            );
          });

          it("should disallow removal of tokens: collateral, payment, or itself", async () => {
            await expect(bond.sweep(bond.address)).to.be.revertedWith(
              "SweepDisallowedForToken"
            );
            await expect(bond.sweep(paymentToken.address)).to.be.revertedWith(
              "SweepDisallowedForToken"
            );
            await expect(
              bond.sweep(collateralToken.address)
            ).to.be.revertedWith("SweepDisallowedForToken");
          });
        });
      });
    });
  });
});
