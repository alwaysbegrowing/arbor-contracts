import { BigNumber, utils, BytesLike } from "ethers";
import { expect } from "chai";
import { TestERC20, Bond, BondFactory } from "../typechain";
import {
  getBondContract,
  getEventArgumentsFromTransaction,
  getTargetCollateral,
} from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { bondFactoryFixture, tokenFixture } from "./shared/fixtures";
import { BondConfigType } from "./interfaces";
import { FIFTY_MILLION, ONE, THREE_YEARS_FROM_NOW, ZERO } from "./constants";

// https://ethereum-waffle.readthedocs.io/en/latest/fixtures.html
// import from waffle since we are using hardhat: https://hardhat.org/plugins/nomiclabs-hardhat-waffle.html#environment-extensions
const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

// Used throughout tests to use multiple instances of different-decimal tokens
const DECIMALS_TO_TEST = [6, 8, 18];

// The config objects are used as anchors to test against - these values will not change
// and will usually be used to create bonds
const BondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibleRatio: ZERO,
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};
const ConvertibleBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibleRatio: utils.parseUnits("0.25", 18),
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};
const UncollateralizedBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: ZERO,
  convertibleRatio: ZERO,
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};

describe("Bond", () => {
  // bond instances that are used and overwritten throughout testing
  let bond: Bond;
  let convertibleBond: Bond;
  let uncollateralizedBond: Bond;
  // owner deploys and is the "issuer"
  let owner: SignerWithAddress;
  // bondHolder is one who has the bonds and will redeem or convert them
  let bondHolder: SignerWithAddress;
  // attacker is trying to break the contract
  let attacker: SignerWithAddress;
  // tokens used throughout testing and are also overwritten (different decimal versions)
  let collateralToken: TestERC20;
  let attackingToken: TestERC20;
  let paymentToken: TestERC20;
  // our factory contract that deploys bonds
  let factory: BondFactory;
  // roles used with access control
  let withdrawRole: BytesLike;
  let mintRole: BytesLike;
  // this is a list of bonds created with the specific decimal tokens
  let bonds: {
    decimals: number;
    bond: Bond;
    convertibleBond: Bond;
    uncollateralizedBond: Bond;
    attackingToken: TestERC20;
    paymentToken: TestERC20;
    collateralToken: TestERC20;
  }[];
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
            bond: await getBondContract(
              factory.createBond(
                "Bond",
                "LUG",
                owner.address,
                BondConfig.maturityDate,
                paymentToken.address,
                collateralToken.address,
                BondConfig.collateralRatio,
                BondConfig.convertibleRatio,
                BondConfig.maxSupply
              )
            ),
            convertibleBond: await getBondContract(
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
            uncollateralizedBond: await getBondContract(
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
          };
        }
      })
    );

    // all bonds will be the same roles - take the first one
    let roles;
    if (bonds[0]) {
      const { bond } = bonds[0];
      roles = {
        defaultAdminRole: await bond.DEFAULT_ADMIN_ROLE(),
        mintRole: await bond.MINT_ROLE(),
        withdrawRole: await bond.WITHDRAW_ROLE(),
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
      beforeEach(async () => {
        ({
          bond,
          convertibleBond,
          collateralToken,
          attackingToken,
          paymentToken,
        } = getBond({ decimals }));
      });
      describe("initialization", async () => {
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
            await bond.hasRole(await bond.getRoleAdmin(mintRole), owner.address)
          ).to.be.equal(true);
        });

        it("should return total value for an account", async () => {
          expect(
            await bond.connect(bondHolder).balanceOf(owner.address)
          ).to.be.equal(0);
        });

        it("should return configured public parameters", async () => {
          expect(await bond.maturityDate()).to.be.equal(
            BondConfig.maturityDate
          );
          expect(await bond.collateralToken()).to.be.equal(
            collateralToken.address
          );
          expect(await bond.collateralRatio()).to.be.equal(
            BondConfig.collateralRatio
          );
          expect(await bond.convertibleRatio()).to.be.equal(0);

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
              BondConfig.maturityDate,
              paymentToken.address,
              collateralToken.address,
              utils.parseUnits(".25", 18),
              utils.parseUnits(".5", 18),
              BondConfig.maxSupply
            )
          ).to.be.revertedWith("CollateralRatioLessThanConvertibleRatio");
        });

        it("should revert on too big of a token", async () => {
          const tokens = (await tokenFixture([20])).tokens.find(
            (token) => token.decimals === 20
          );
          if (tokens) {
            const { paymentToken } = tokens;
            await expect(
              factory.createBond(
                "Bond",
                "LUG",
                owner.address,
                BondConfig.maturityDate,
                paymentToken.address,
                collateralToken.address,
                BondConfig.collateralRatio,
                BondConfig.convertibleRatio,
                BondConfig.maxSupply
              )
            ).to.be.revertedWith("TokenOverflow");
          } else {
            throw new Error("Token not found!");
          }
        });
      });
      describe(`mint`, async () => {
        beforeEach(async () => {
          await collateralToken
            .attach(collateralToken.address)
            .approve(bond.address, getTargetCollateral(BondConfig));
        });

        it("should revert when called by non-minter", async () => {
          await expect(bond.connect(attacker).mint(0)).to.be.revertedWith(
            `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${mintRole}`
          );
        });

        [
          {
            mintAmount: 0,
            collateralToDeposit: ZERO,
            description: "with zero target",
          },
          {
            mintAmount: BondConfig.targetBondSupply.div(4),
            collateralToDeposit: BondConfig.collateralRatio
              .mul(BondConfig.targetBondSupply.div(4))
              .div(ONE),
            description: "with quarter target",
          },
          {
            mintAmount: BondConfig.targetBondSupply.div(2),
            collateralToDeposit: BondConfig.collateralRatio
              .mul(BondConfig.targetBondSupply.div(2))
              .div(ONE),
            description: "with half target",
          },
          {
            mintAmount: BondConfig.targetBondSupply,
            collateralToDeposit: getTargetCollateral(BondConfig),
            description: "with target",
          },
          {
            mintAmount: utils.parseUnits("1", 18).sub(1),
            collateralToDeposit: utils
              .parseUnits("1", 18)
              .mul(BondConfig.collateralRatio)
              .div(ONE),
            description: "when collateral rounds up",
          },
        ].forEach(({ mintAmount, collateralToDeposit, description }) => {
          it(`should preview mint ${description}`, async () => {
            expect(await bond.previewMintBeforeMaturity(mintAmount)).to.equal(
              collateralToDeposit
            );
          });
        });

        [
          {
            mintAmount: utils.parseUnits("1", 18),
            collateralToDeposit: utils
              .parseUnits("1", 18)
              .mul(BondConfig.collateralRatio)
              .div(ONE)
              .sub(1),
            description: "when collateral rounds down",
          },
          {
            mintAmount: utils.parseUnits("1", 18).add(1),
            collateralToDeposit: utils
              .parseUnits("1", 18)
              .mul(BondConfig.collateralRatio)
              .div(ONE),
            description: "when collateral rounds down",
          },
          {
            mintAmount: utils.parseUnits("1", 18).sub(1),
            collateralToDeposit: utils
              .parseUnits("1", 18)
              .mul(BondConfig.collateralRatio)
              .div(ONE)
              .sub(1),
            description: "when both round down",
          },
        ].forEach(({ mintAmount, collateralToDeposit, description }) => {
          it(`should fail preview mint ${description}`, async () => {
            expect(
              await bond.previewMintBeforeMaturity(mintAmount)
            ).to.not.equal(collateralToDeposit);
          });
        });
        it(`should preview mint zero target`, async () => {
          expect(await bond.previewMintBeforeMaturity(ZERO)).to.equal(ZERO);
        });
        [
          {
            mintAmount: BondConfig.targetBondSupply.div(4),
            collateralToDeposit: BondConfig.collateralRatio
              .mul(BondConfig.targetBondSupply.div(4))
              .div(ONE),
            description: "with quarter target",
          },
          {
            mintAmount: BondConfig.targetBondSupply.div(2),
            collateralToDeposit: BondConfig.collateralRatio
              .mul(BondConfig.targetBondSupply.div(2))
              .div(ONE),
            description: "with half target",
          },
          {
            mintAmount: BondConfig.targetBondSupply,
            collateralToDeposit: getTargetCollateral(BondConfig),
            description: "with target",
          },
        ].forEach(({ mintAmount, collateralToDeposit, description }) => {
          it(`should preview mint ${description}`, async () => {
            expect(await bond.previewMintBeforeMaturity(mintAmount)).to.equal(
              collateralToDeposit
            );
          });
          it(`should mint up to collateral depositted ${description}`, async () => {
            await expect(bond.mint(mintAmount)).to.not.be.reverted;
            expect(await bond.totalSupply()).to.equal(mintAmount);
            expect(await collateralToken.balanceOf(bond.address)).to.be.equal(
              collateralToDeposit
            );
          });
        });

        it("should mint up to collateral deposit", async () => {
          await expect(bond.mint(BondConfig.targetBondSupply)).to.not.be
            .reverted;
          expect(await bond.totalSupply()).to.equal(
            BondConfig.targetBondSupply
          );
        });

        it("should not mint more than max supply", async () => {
          await expect(
            bond.mint(BondConfig.targetBondSupply.add(1))
          ).to.be.revertedWith("BondSupplyExceeded");
        });
      });
      describe(`pay`, async () => {
        beforeEach(async () => {
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE);
          await collateralToken.approve(bond.address, amountToDeposit);
          await expect(bond.mint(BondConfig.targetBondSupply)).to.not.be
            .reverted;
          await paymentToken.approve(
            bond.address,
            BondConfig.targetBondSupply
              .mul(utils.parseUnits("1", decimals))
              .div(ONE)
          );
        });
        it("should accept partial payment", async () => {
          const halfSupplyMinusOne = BondConfig.targetBondSupply
            .div(2)
            .sub(1)
            .mul(utils.parseUnits("1", decimals))
            .div(ONE);

          await (await bond.pay(BigNumber.from(1))).wait();
          await (await bond.pay(halfSupplyMinusOne)).wait();
          await expect(bond.pay(halfSupplyMinusOne)).to.emit(bond, "Payment");
        });

        it("should accept full payment in steps", async () => {
          const thirdSupply = BondConfig.targetBondSupply
            .div(3)
            .mul(utils.parseUnits("1", decimals))
            .div(ONE);
          await (await bond.pay(thirdSupply)).wait();
          await (await bond.pay(thirdSupply)).wait();
          await (await bond.pay(thirdSupply)).wait();
          await expect(bond.pay(2)).to.emit(bond, "PaymentInFull");
        });

        it("should accept payment", async () => {
          await expect(
            bond.pay(
              BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            )
          ).to.emit(bond, "PaymentInFull");
        });

        it("should fail if already repaid", async () => {
          await bond.pay(
            BondConfig.targetBondSupply
              .mul(utils.parseUnits("1", decimals))
              .div(ONE)
          );
          await expect(
            bond.pay(
              BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE)
            )
          ).to.be.revertedWith("PaymentMet");
        });
      });
      describe("withdrawCollateral", async () => {
        describe(`non-convertible`, async () => {
          beforeEach(async () => {
            const token = collateralToken.attach(collateralToken.address);
            const amountToDeposit = getTargetCollateral(BondConfig);
            await token.approve(bond.address, amountToDeposit);
            await bond.mint(BondConfig.targetBondSupply);
          });
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
              sharesToBurn: ONE.div(BondConfig.collateralRatio),
              collateralToReceive: BigNumber.from(1),
              description: "smallest unit",
            },
            {
              sharesToBurn: utils.parseUnits("1", 18),
              collateralToReceive: utils
                .parseUnits("1", 18)
                .mul(BondConfig.collateralRatio)
                .div(ONE),
              description: "equivilant amount of collateral ratio",
            },
          ].forEach(({ sharesToBurn, collateralToReceive, description }) => {
            it(`should make excess collateral available to withdraw when ${description} are burned`, async () => {
              await (await bond.burn(sharesToBurn)).wait();
              expect(await bond.previewWithdraw()).to.equal(
                collateralToReceive
              );
            });
          });

          [
            {
              paymentTokenAmount: utils.parseUnits("1000", decimals),
              collateralToReceive: utils
                .parseUnits("1000", 18)
                .mul(BondConfig.collateralRatio)
                .div(ONE),
              description: "one to one",
            },
            {
              paymentTokenAmount: utils.parseUnits("1000", decimals).add(1),
              collateralToReceive: utils
                .parseUnits("1000", 18)
                .add(utils.parseUnits("1", 18 - decimals))
                .mul(BondConfig.collateralRatio)
                .div(ONE),
              description: "collateral in scaled magnitude",
            },
            {
              paymentTokenAmount: utils.parseUnits("1000", decimals).sub(1),
              collateralToReceive: utils
                .parseUnits("1000", 18)
                .sub(utils.parseUnits("1", 18 - decimals))
                .mul(BondConfig.collateralRatio)
                .div(ONE),
              description: "collateral in scaled magnitude",
            },
          ].forEach(
            ({ paymentTokenAmount, collateralToReceive, description }) => {
              it(`should make excess collateral available to withdraw ${description} when payment token is partially repaid`, async () => {
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );

          [
            {
              sharesToBurn: 0,
              paymentTokenAmount: BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(BondConfig),
            },
            {
              sharesToBurn: utils.parseUnits("1000", 18),
              paymentTokenAmount: BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(BondConfig),
            },
          ].forEach(
            ({ sharesToBurn, paymentTokenAmount, collateralToReceive }) => {
              it("should make excess collateral available to withdraw when payment token is fully repaid", async () => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );

          [
            {
              sharesToBurn: 0,
              paymentTokenAmount: BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(BondConfig),
            },
            {
              sharesToBurn: 0,
              paymentTokenAmount: BondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(BondConfig),
            },
          ].forEach(
            ({ sharesToBurn, paymentTokenAmount, collateralToReceive }) => {
              it("should make excess collateral available to withdraw when maturity is reached", async () => {
                await (await bond.burn(sharesToBurn)).wait();
                await paymentToken.approve(bond.address, paymentTokenAmount);
                await (await bond.pay(paymentTokenAmount)).wait();
                expect(await bond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );
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
        describe(`convertible decimals`, async () => {
          beforeEach(async () => {
            const token = collateralToken.attach(collateralToken.address);
            const amountToDeposit = getTargetCollateral(ConvertibleBondConfig);
            await token.approve(convertibleBond.address, amountToDeposit);
            await convertibleBond.mint(ConvertibleBondConfig.targetBondSupply);
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
                .mul(ConvertibleBondConfig.collateralRatio)
                .div(ONE),
            },
          ].forEach(({ sharesToBurn, collateralToReceive }) => {
            it("should make collateral available to withdraw when bonds are burned", async () => {
              await (await convertibleBond.burn(sharesToBurn)).wait();
              expect(await convertibleBond.previewWithdraw()).to.equal(
                collateralToReceive
              );
            });
          });

          [
            {
              sharesToBurn: 0,
              paymentTokenAmount: utils.parseUnits("1000", decimals),
              collateralToReceive: utils
                .parseUnits("1000", 18)
                .mul(ConvertibleBondConfig.collateralRatio)
                .div(ONE),
            },
            {
              sharesToBurn: utils.parseUnits("1000", 18),
              paymentTokenAmount: utils.parseUnits("1000", decimals),
              collateralToReceive: utils
                .parseUnits("2000", 18)
                .mul(ConvertibleBondConfig.collateralRatio)
                .div(ONE),
            },
          ].forEach(
            ({ sharesToBurn, paymentTokenAmount, collateralToReceive }) => {
              it("should make excess collateral available to withdraw when payment token is partially repaid", async () => {
                await (await convertibleBond.burn(sharesToBurn)).wait();
                await paymentToken.approve(
                  convertibleBond.address,
                  paymentTokenAmount
                );
                await (await convertibleBond.pay(paymentTokenAmount)).wait();
                expect(await convertibleBond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );

          [
            {
              sharesToBurn: 0,
              paymentTokenAmount: ConvertibleBondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(ConvertibleBondConfig),
            },
            {
              sharesToBurn: utils.parseUnits("1000", 18),
              paymentTokenAmount: ConvertibleBondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(ConvertibleBondConfig),
            },
          ].forEach(
            ({ sharesToBurn, paymentTokenAmount, collateralToReceive }) => {
              it("should make excess collateral available to withdraw when payment token is fully repaid", async () => {
                await (await convertibleBond.burn(sharesToBurn)).wait();
                await paymentToken.approve(
                  convertibleBond.address,
                  paymentTokenAmount
                );
                await (await convertibleBond.pay(paymentTokenAmount)).wait();
                expect(await convertibleBond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );

          [
            {
              sharesToBurn: 0,
              paymentTokenAmount: ConvertibleBondConfig.targetBondSupply
                .div(4)
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: ConvertibleBondConfig.targetBondSupply
                .div(4)
                .mul(ConvertibleBondConfig.collateralRatio)
                .div(ONE),
            },
            {
              sharesToBurn: 0,
              paymentTokenAmount: ConvertibleBondConfig.targetBondSupply
                .mul(utils.parseUnits("1", decimals))
                .div(ONE),
              collateralToReceive: getTargetCollateral(ConvertibleBondConfig),
            },
          ].forEach(
            ({ sharesToBurn, paymentTokenAmount, collateralToReceive }) => {
              it("should make excess collateral available to withdraw when maturity is reached", async () => {
                await (await convertibleBond.burn(sharesToBurn)).wait();
                await paymentToken.approve(
                  convertibleBond.address,
                  paymentTokenAmount
                );
                await (await convertibleBond.pay(paymentTokenAmount)).wait();
                await ethers.provider.send("evm_mine", [
                  ConvertibleBondConfig.maturityDate,
                ]);
                expect(await convertibleBond.previewWithdraw()).to.equal(
                  collateralToReceive
                );
              });
            }
          );
          it("should revert when called by non-withdrawer", async () => {
            await expect(
              bond.connect(attacker).withdrawCollateral()
            ).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
            );
          });

          it("should grant and revoke withdraw role", async () => {
            await convertibleBond.grantRole(withdrawRole, attacker.address);
            await expect(convertibleBond.connect(attacker).withdrawCollateral())
              .to.not.be.reverted;

            await convertibleBond.revokeRole(withdrawRole, attacker.address);
            await expect(
              convertibleBond.connect(attacker).withdrawCollateral()
            ).to.be.revertedWith(
              `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${withdrawRole}`
            );
          });
        });
      });
      describe(`redeem`, async () => {
        const totalPaid = BondConfig.targetBondSupply
          .mul(utils.parseUnits("1", decimals))
          .div(ONE);
        // Bond holder will have their bonds and the contract will be able to accept deposits of payment token
        beforeEach(async () => {
          const amountToDeposit = BondConfig.targetBondSupply
            .mul(BondConfig.collateralRatio)
            .div(ONE);
          await collateralToken
            .attach(collateralToken.address)
            .approve(bond.address, amountToDeposit);
          await bond.mint(BondConfig.targetBondSupply);
          await bond.transfer(bondHolder.address, utils.parseUnits("4000", 18));
          await paymentToken.approve(bond.address, BondConfig.targetBondSupply);
        });

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
          ({ sharesToRedeem, paymentTokenToSend, collateralTokenToSend }) => {
            it("should withdraw of payment token when bond is repaid & past maturity", async () => {
              await bond.pay(totalPaid);
              await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);

              const [paymentToken, collateralToken] = await bond
                .connect(bondHolder)
                .previewRedeemAtMaturity(sharesToRedeem);
              expect(paymentToken).to.equal(paymentTokenToSend);
              expect(collateralToken).to.equal(collateralTokenToSend);
            });
          }
        );

        [
          {
            sharesToRedeem: utils.parseUnits("1000", 18),
            paymentTokenToSend: ZERO,
            collateralTokenToSend: utils
              .parseUnits("1000", 18)
              .mul(BondConfig.collateralRatio)
              .div(ONE),
          },
          {
            sharesToRedeem: 0,
            paymentTokenToSend: ZERO,
            collateralTokenToSend: ZERO,
          },
        ].forEach(
          ({ sharesToRedeem, paymentTokenToSend, collateralTokenToSend }) => {
            it("should allow withdraw of collateral when bond is not repaid & past maturity ", async () => {
              await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
              const [paymentTokens, collateralTokens] = await bond
                .connect(bondHolder)
                .previewRedeemAtMaturity(sharesToRedeem);
              expect(paymentTokens).to.equal(paymentTokenToSend);
              expect(collateralTokens).to.equal(collateralTokenToSend);
            });
          }
        );

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
              .div(BondConfig.targetBondSupply)
              .mul(utils.parseUnits("4000", decimals)) // then multiply that by the payment amount
              .div(ONE),
            collateralTokenToSend: BondConfig.targetBondSupply // here we get the total supply minus the repaid tokens
              .sub(utils.parseUnits("4000", 18))
              .mul(BondConfig.collateralRatio) // multipy by the collateral ratio to get the amount of collateral tokens to send
              .div(ONE)
              .mul(utils.parseUnits("4000", 18)) // and then use our portion of the total amount of tokens to get how many owed
              .div(BondConfig.targetBondSupply),
          },
        ].forEach(
          ({
            tokensToPay,
            sharesToRedeem,
            paymentTokenToSend,
            collateralTokenToSend,
          }) => {
            it("should allow withdraw of collateral & payment token when bond is partially repaid & past maturity =", async () => {
              await bond.pay(tokensToPay);
              await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
              const [paymentTokens, collateralTokens] = await bond
                .connect(bondHolder)
                .previewRedeemAtMaturity(sharesToRedeem);
              expect(paymentTokens).to.equal(paymentTokenToSend);
              expect(collateralTokens).to.equal(collateralTokenToSend);
            });
          }
        );

        it("should redeem bond at maturity for payment token", async () => {
          await bond.pay(
            BondConfig.targetBondSupply
              .mul(utils.parseUnits("1", decimals))
              .div(ONE)
          );
          // Fast forward to expire
          await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
          await bond
            .connect(bondHolder)
            .approve(bond.address, utils.parseUnits("4000", 18));

          expect(await bond.balanceOf(bondHolder.address)).to.be.equal(
            utils.parseUnits("4000", 18)
          );
          await bond.connect(bondHolder).redeem(utils.parseUnits("4000", 18));
          expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
          expect(await paymentToken.balanceOf(bondHolder.address)).to.be.equal(
            utils.parseUnits("4000", decimals)
          );
        });
        it("should redeem bond at default for collateral token", async () => {
          const expectedCollateralToReceive = utils
            .parseUnits("4000", 18)
            .mul(await bond.totalCollateral())
            .div(await bond.totalSupply());
          await ethers.provider.send("evm_mine", [BondConfig.maturityDate]);
          const {
            from,
            paymentToken,
            collateralToken: convertedCollateralToken,
            amountOfBondsRedeemed,
            amountOfPaymentTokensReceived,
            amountOfCollateralTokens,
          } = await getEventArgumentsFromTransaction(
            await bond.connect(bondHolder).redeem(utils.parseUnits("4000", 18)),
            "Redeem"
          );
          expect(from).to.equal(bondHolder.address);
          expect(convertedCollateralToken).to.equal(collateralToken.address);
          expect(amountOfBondsRedeemed).to.equal(utils.parseUnits("4000", 18));
          expect(amountOfPaymentTokensReceived).to.equal(0);
          expect(amountOfCollateralTokens).to.equal(
            expectedCollateralToReceive
          );

          expect(await bond.balanceOf(bondHolder.address)).to.be.equal(0);
          expect(
            await collateralToken
              .attach(paymentToken)
              .balanceOf(bondHolder.address)
          ).to.be.equal(0);
          expect(
            await collateralToken
              .attach(collateralToken.address)
              .balanceOf(bondHolder.address)
          ).to.be.equal(
            BondConfig.collateralRatio
              .mul(utils.parseUnits("4000", 18))
              .div(ONE)
          );
        });
      });
      describe("convert", async () => {
        describe("convertible bonds", async () => {
          const tokensToConvert = ConvertibleBondConfig.targetBondSupply;
          beforeEach(async () => {
            const token = collateralToken.attach(collateralToken.address);
            const amountToDeposit = getTargetCollateral(BondConfig);
            await token.approve(convertibleBond.address, amountToDeposit);
            await convertibleBond.mint(ConvertibleBondConfig.targetBondSupply);
            await convertibleBond.transfer(bondHolder.address, tokensToConvert);
          });
          [
            {
              convertAmount: 0,
              assetsToReceive: 0,
              description: "zero converted",
            },
            {
              convertAmount: BondConfig.targetBondSupply,
              assetsToReceive: BondConfig.convertibleRatio
                .mul(BondConfig.targetBondSupply)
                .div(ONE),
              description: "target converted",
            },
            {
              convertAmount: BondConfig.targetBondSupply.div(2),
              assetsToReceive: BondConfig.convertibleRatio
                .mul(BondConfig.targetBondSupply.div(2))
                .div(ONE),
              description: "double target converted",
            },
          ].forEach(({ convertAmount, assetsToReceive, description }) => {
            it(`previews convert ${description}`, async () => {
              expect(
                await bond.previewConvertBeforeMaturity(convertAmount)
              ).to.equal(assetsToReceive);
            });
          });
          it("should convert bond amount into collateral at convertibleRatio", async () => {
            const expectedCollateralToWithdraw = tokensToConvert
              .mul(ConvertibleBondConfig.convertibleRatio)
              .div(ONE);
            await convertibleBond
              .connect(bondHolder)
              .approve(convertibleBond.address, tokensToConvert);
            const {
              from,
              collateralToken: convertedCollateralToken,
              amountOfBondsConverted,
              amountOfCollateralTokens,
            } = await getEventArgumentsFromTransaction(
              await convertibleBond
                .connect(bondHolder)
                .convert(tokensToConvert),
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
        describe("non-convertible bonds", async () => {
          it("should fail to convert if bond is not convertible", async () => {
            await expect(
              bond.convert(BondConfig.targetBondSupply)
            ).to.be.revertedWith("ZeroAmount");
          });
        });
      });
      describe("sweep", async () => {
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
          await expect(bond.sweep(collateralToken.address)).to.be.revertedWith(
            "SweepDisallowedForToken"
          );
        });
      });
    });
  });
});
