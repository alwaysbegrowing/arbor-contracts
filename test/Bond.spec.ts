import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import { TestERC20, Bond, BondFactory } from "../typechain";
import {
  expectTokenDelta,
  getBondContract,
  getEventArgumentsFromTransaction,
  burnAndWithdraw,
  payAndWithdraw,
  previewRedeem,
  redeemAndCheckTokens,
  mulWad,
  mineToGracePeriod,
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
  MaliciousBondConfig,
  GRACE_PERIOD,
} from "./constants";

// https://ethereum-waffle.readthedocs.io/en/latest/fixtures.html
// import from waffle since we are using hardhat: https://hardhat.org/plugins/nomiclabs-hardhat-waffle.html#environment-extensions
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
  // this is a list of bonds created with the specific decimal tokens
  let bonds: BondWithTokens[];

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
    const allowedToken = await factory.ALLOWED_TOKEN();

    await (await factory.grantRole(issuerRole, owner.address)).wait();
    await (await factory.grantRole(issuerRole, attacker.address)).wait();

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

          await factory.grantRole(allowedToken, paymentToken.address);
          await factory.grantRole(allowedToken, collateralToken.address);
          await factory.grantRole(allowedToken, attackingToken.address);

          await collateralToken.approve(
            factory.address,
            ethers.constants.MaxUint256
          );

          const getConfig = async (
            configWithDecimals: (decimals: number) => BondConfigType,
            decimals: number,
            paymentTokenOverride: string = paymentToken.address
          ) => {
            const config = configWithDecimals(decimals);
            return {
              config,
              bond: await getBondContract(
                factory.createBond(
                  "Bond",
                  "LUG",
                  config.maturity,
                  paymentTokenOverride, // Malicious config uses the attacking token!
                  collateralToken.address,
                  config.collateralTokenAmount,
                  config.convertibleTokenAmount,
                  config.maxSupply
                )
              ),
            };
          };
          return {
            decimals,
            attackingToken,
            paymentToken,
            collateralToken,
            nonConvertible: await getConfig(NonConvertibleBondConfig, decimals),
            convertible: await getConfig(ConvertibleBondConfig, decimals),
            uncollateralized: await getConfig(
              UncollateralizedBondConfig,
              decimals
            ),
            malicious: await getConfig(
              MaliciousBondConfig,
              decimals,
              attackingToken.address
            ),
          };
        }
      })
    );
    return {
      bonds,
      factory,
    };
  }

  beforeEach(async () => {
    // the signers are assigned here and used throughout the tests
    [owner, bondHolder, attacker] = await ethers.getSigners();
    // this is the bonds used in the getBond function
    ({ bonds, factory } = await loadFixture(fixture));
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

      describe("initialize", async () => {
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
          });
          it("reverts when trying to initialize implementation contract", async () => {
            const tokenImplementation = await ethers.getContractAt(
              "Bond",
              await factory.tokenImplementation()
            );
            await expect(
              tokenImplementation.initialize(
                "Bond",
                "LUG",
                owner.address,
                config.maturity,
                paymentToken.address,
                collateralToken.address,
                utils.parseUnits(".25", decimals),
                utils.parseUnits(".5", decimals),
                config.maxSupply
              )
            ).to.be.revertedWith(
              "Initializable: contract is already initialized"
            );
          });
          it("should disallow calling initialize again", async () => {
            await expect(
              bond.initialize(
                "Bond",
                "LUG",
                owner.address,
                config.maturity,
                paymentToken.address,
                collateralToken.address,
                utils.parseUnits(".25", decimals),
                utils.parseUnits(".5", decimals),
                config.maxSupply
              )
            ).to.be.revertedWith(
              "Initializable: contract is already initialized"
            );
          });

          it("should verifiable as bond by Factory.isBond", async () => {
            expect(await factory.isBond(bond.address)).to.be.equal(true);
          });

          it("should have minted total supply of coins", async () => {
            expect(await bond.balanceOf(owner.address)).to.be.equal(
              config.maxSupply
            );
          });

          it("should have given issuer the owner role", async () => {
            expect(await bond.owner()).to.be.equal(owner.address);
          });

          it("should return configured public parameters", async () => {
            expect(await bond.decimals()).to.equal(decimals);
          });

          it("should have configured ERC20 attributes", async () => {
            expect(await bond.name()).to.be.equal("Bond");
            expect(await bond.symbol()).to.be.equal("LUG");
          });
        });
      });
      describe("#withdrawExcessPayment", async () => {
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            await paymentToken.approve(
              bond.address,
              ethers.constants.MaxUint256
            );
          });

          it("should preview zero payment when bond is not overpaid", async () => {
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
            await paymentToken.transfer(
              bond.address,
              await bond.amountUnpaid()
            );
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
          });

          it("fails to withdraw zero payment when bond is not overpaid", async () => {
            await expect(
              bond.withdrawExcessPayment(owner.address)
            ).to.be.revertedWith("NoPaymentToWithdraw");
          });

          it("should withdraw excess payment when bond is overpaid", async () => {
            await paymentToken.transfer(
              bond.address,
              (await bond.amountUnpaid()).add(1)
            );
            expect(await bond.previewWithdrawExcessPayment()).to.equal(1);
            await bond.withdrawExcessPayment(owner.address);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
          });
          it("should withdraw excess payment when bonds are redeemed", async () => {
            const bonds = await bond.balanceOf(owner.address);
            const fullPayment = await bond.amountUnpaid();
            await paymentToken.transfer(bond.address, fullPayment.mul(2));
            expect(await bond.previewWithdrawExcessPayment()).to.equal(
              fullPayment
            );
            const [paymentOnRedeem] = await bond.previewRedeemAtMaturity(bonds);
            expect(paymentOnRedeem).to.equal(fullPayment);
            await bond.redeem(bonds);

            expect(await bond.previewWithdrawExcessPayment()).to.equal(
              fullPayment
            );
            await bond.withdrawExcessPayment(owner.address);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
          });

          it("should have available overpayment when partially paid and all bonds are burnt", async () => {
            const bonds = await bond.balanceOf(owner.address);
            const halfPayment = (await bond.amountUnpaid()).div(2);
            await paymentToken.transfer(bond.address, halfPayment);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
            await bond.burn(bonds);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(
              halfPayment
            );
          });

          it("fails to withdraw when called by non-owner", async () => {
            await expect(
              bond.connect(bondHolder).withdrawExcessPayment(owner.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });
        });
        describe("convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
            await paymentToken.approve(
              bond.address,
              ethers.constants.MaxUint256
            );
          });
          it("should withdraw excess payment when bonds are converted", async () => {
            const halfBonds = (await bond.balanceOf(owner.address)).div(2);
            const fullPayment = await bond.amountUnpaid();
            await paymentToken.transfer(bond.address, fullPayment);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
            await bond.convert(halfBonds);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(
              fullPayment.div(2)
            );
            await bond.convert(halfBonds);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(
              fullPayment
            );
            await bond.withdrawExcessPayment(owner.address);
            expect(await bond.previewWithdrawExcessPayment()).to.equal(0);
          });

          it("fails to withdraw zero payment when bond is not overpaid", async () => {
            await expect(
              bond.withdrawExcessPayment(owner.address)
            ).to.be.revertedWith("NoPaymentToWithdraw");
          });
        });
      });

      describe("pay", async () => {
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            await paymentToken.approve(bond.address, config.maxSupply);
          });

          it("should accept partial payment", async () => {
            const halfSupplyMinusOne = config.maxSupply
              .div(2)
              .sub(1)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);

            await (await bond.pay(BigNumber.from(1))).wait();
            await (await bond.pay(halfSupplyMinusOne)).wait();
            await expect(bond.pay(halfSupplyMinusOne)).to.emit(bond, "Payment");
          });

          it("should accept full payment in steps", async () => {
            const thirdSupply = config.maxSupply
              .div(3)
              .mul(utils.parseUnits("1", decimals))
              .div(ONE);
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await (await bond.pay(thirdSupply)).wait();
            await expect(bond.pay(2)).to.emit(bond, "Payment");
          });

          it("should accept payment", async () => {
            await expect(bond.pay(config.maxSupply)).to.emit(bond, "Payment");
          });

          it("should accept payment by non-owner", async () => {
            await paymentToken.transfer(bondHolder.address, config.maxSupply);
            await paymentToken
              .connect(bondHolder)
              .approve(bond.address, config.maxSupply);
            await expect(
              bond.connect(bondHolder).pay(config.maxSupply)
            ).to.emit(bond, "Payment");
          });

          it("should fail if already paid", async () => {
            await bond.pay(config.maxSupply);
            await expect(bond.pay(config.maxSupply)).to.be.revertedWith(
              "PaymentAlreadyMet"
            );
          });

          it("should fail on zero payment amount", async () => {
            await expect(bond.pay(ZERO)).to.be.revertedWith("ZeroAmount");
          });

          it("should return amount owed scaled to payment amount", async () => {
            const thirdSupply = config.maxSupply.div(3);

            expect(await bond.amountUnpaid()).to.equal(config.maxSupply);

            await (await bond.pay(thirdSupply)).wait();
            expect(await bond.amountUnpaid()).to.equal(
              config.maxSupply.sub(await bond.paymentBalance())
            );

            await (await bond.pay(thirdSupply)).wait();
            expect(await bond.amountUnpaid()).to.equal(
              config.maxSupply.sub(await bond.paymentBalance())
            );

            await (await bond.pay(thirdSupply)).wait();
            expect(await bond.amountUnpaid()).to.equal(BigNumber.from(2));

            await expect(bond.pay(2)).to.emit(bond, "Payment");
            expect(await bond.amountUnpaid()).to.equal(ZERO);
          });
        });
        describe("attacking", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.malicious.bond;
            config = bondWithTokens.malicious.config;
            await attackingToken
              .connect(attacker)
              .approve(bond.address, config.maxSupply);
          });

          it("records the actual amount transferred", async () => {
            // The attacking token has a trasnferFrom function that always
            // transfers 0 tokens. The bond should have nothing paid after pay.
            await (await bond.connect(attacker).pay(config.maxSupply)).wait();
            expect(await bond.amountUnpaid()).to.equal(config.maxSupply);
          });
        });
      });
      describe("#withdrawExcessCollateral", async () => {
        beforeEach(async () => {
          bond = bondWithTokens.nonConvertible.bond;
          config = bondWithTokens.nonConvertible.config;
          await collateralToken.approve(
            bond.address,
            config.collateralTokenAmount
          );
        });

        describe("Paid state", async () => {
          beforeEach(async () => {
            await ethers.provider.send("evm_mine", [config.maturity]);
          });
          describe("simple", async () => {
            it("should withdraw all collateral in Paid state", async () => {
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply,
                collateralToReceive: config.collateralTokenAmount,
                receiver: owner,
              });
              expect(await bond.collateralBalance()).to.equal(ZERO);
            });

            it("allows a partial withdraw", async () => {
              const owed = await bond.amountUnpaid();
              await paymentToken.approve(bond.address, owed);
              await bond.pay(owed);

              await expectTokenDelta(
                async () =>
                  bond.withdrawExcessCollateral(
                    (await bond.previewWithdrawExcessCollateral()).div(2),
                    owner.address
                  ),
                collateralToken,
                owner,
                bond.address,
                config.collateralTokenAmount.div(2)
              );

              expect(await bond.collateralBalance()).to.equal(
                config.collateralTokenAmount.div(2)
              );
            });

            it("fails if requesting too much", async () => {
              const owed = await bond.amountUnpaid();
              await paymentToken.approve(bond.address, owed);
              await bond.pay(owed);

              await expect(
                bond.withdrawExcessCollateral(
                  (await bond.previewWithdrawExcessCollateral()).add(1),
                  owner.address
                )
              ).to.be.revertedWith("NotEnoughCollateral");
            });

            it("fails to withdraw when called by non-owner", async () => {
              await expect(
                bond
                  .connect(bondHolder)
                  .withdrawExcessCollateral(
                    await bond.previewWithdrawExcessCollateral(),
                    owner.address
                  )
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });
        });
        describe("PaidEarly state", async () => {
          describe("simple", async () => {
            it("should allow all collateral to be withdrawn when PaidEarly", async () => {
              const targetPayment = config.maxSupply;
              await paymentToken.approve(bond.address, targetPayment);

              await expectTokenDelta(
                () => bond.pay(targetPayment),
                paymentToken,
                owner,
                bond.address,
                targetPayment
              );
              expect(await bond.totalSupply()).to.not.equal(0);

              await expectTokenDelta(
                async () =>
                  bond.withdrawExcessCollateral(
                    await bond.previewWithdrawExcessCollateral(),
                    owner.address
                  ),
                collateralToken,
                owner,
                bond.address,
                config.collateralTokenAmount
              );
            });
          });

          describe("convert", async () => {
            it("should require convertibleTokens to stay in contract when PaidEarly", async () => {
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply,
                collateralToReceive: config.collateralTokenAmount.sub(
                  config.convertibleTokenAmount
                ),
                receiver: owner,
              });
            });

            it("should make excess collateral available to withdraw when payment token is fully paid", async () => {
              const totalWithdrawableCollateral =
                config.collateralTokenAmount.sub(config.convertibleTokenAmount);
              await bond.burn(utils.parseUnits("1000", decimals));
              // since we've burnt 1000 bonds, the collateral has been unlocked
              const unlockedCollateral = utils
                .parseUnits("1000", decimals)
                .mul(await bond.convertibleRatio())
                .div(ONE);
              const collateralToReceive =
                totalWithdrawableCollateral.add(unlockedCollateral);
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply,
                collateralToReceive,
                receiver: owner,
              });
            });
          });
        });
        describe("Defaulted state", async () => {
          describe("convert", async () => {
            it("should withdraw collateral that was locked to give bondholders the option to convert", async () => {
              bond = bondWithTokens.convertible.bond;
              config = bondWithTokens.convertible.config;
              await ethers.provider.send("evm_mine", [config.maturity]);
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply.sub(1),
                collateralToReceive: config.collateralTokenAmount.sub(1),
                receiver: owner,
              });
            });
          });
        });
        describe("Active state", async () => {
          describe("simple", async () => {
            it("should not change amount owed", async () => {
              const targetPayment = config.maxSupply.div(2);
              await (
                await paymentToken.approve(bond.address, targetPayment)
              ).wait();
              await (await bond.pay(targetPayment)).wait();
              const amountUnpaid = await bond.amountUnpaid();
              await (
                await bond.withdrawExcessCollateral(
                  await bond.previewWithdrawExcessCollateral(),
                  owner.address
                )
              ).wait();
              expect(await bond.amountUnpaid()).to.be.equal(amountUnpaid);
            });

            it("should withdraw zero collateral when zero amount are burned", async () => {
              await burnAndWithdraw({
                bond,
                sharesToBurn: ZERO,
                collateralToReceive: ZERO,
              });
            });

            it("should withdraw zero collateral when collateral rounds down", async () => {
              await burnAndWithdraw({
                bond,
                sharesToBurn: BigNumber.from(1),
                collateralToReceive: ZERO,
              });
            });

            it("should make excess collateral available to withdraw when smallest unit are burned", async () => {
              await burnAndWithdraw({
                bond,
                sharesToBurn: ONE.div(await bond.collateralRatio()),
                collateralToReceive: BigNumber.from(1),
              });
            });

            it("should make all collateral available to withdraw when total amount are burned", async () => {
              await burnAndWithdraw({
                bond,
                sharesToBurn: config.maxSupply,
                collateralToReceive: config.collateralTokenAmount,
              });
            });

            it("should make excess collateral available to withdraw one to one", async () => {
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: utils.parseUnits("1000", decimals),
                collateralToReceive: utils
                  .parseUnits("1000", decimals)
                  .mul(await bond.collateralRatio())
                  .div(ONE),
                receiver: owner,
              });
            });

            it("should withdraw excess collateral in Active state", async () => {
              await bond.burn(utils.parseUnits("1000", decimals));
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply,
                collateralToReceive: config.collateralTokenAmount,
                receiver: owner,
              });
            });

            it("should allow all collateral to be withdrawn when all bonds are burned", async () => {
              await bond.burn(config.maxSupply);
              const excessCollateral =
                await bond.previewWithdrawExcessCollateral();
              expect(excessCollateral).to.equal(config.collateralTokenAmount);
              expect(await bond.totalSupply()).to.equal(0);
              await expectTokenDelta(
                async () =>
                  bond.withdrawExcessCollateral(
                    excessCollateral,
                    owner.address
                  ),
                collateralToken,
                owner,
                owner.address,
                config.collateralTokenAmount
              );
              expect(await collateralToken.balanceOf(bond.address)).to.equal(0);
            });
          });
          describe("convert", async () => {
            it("should have collateral required to cover convertibleRatio locked", async () => {
              bond = bondWithTokens.convertible.bond;
              config = bondWithTokens.convertible.config;
              await payAndWithdraw({
                bond,
                paymentToken,
                paymentTokenAmount: config.maxSupply.sub(1),
                collateralToReceive: config.collateralTokenAmount.sub(
                  config.convertibleTokenAmount
                ),
                receiver: owner,
              });

              it("fails to withdraw when called by non-owner", async () => {
                await expect(
                  bond
                    .connect(bondHolder)
                    .withdrawExcessCollateral(
                      await bond.previewWithdrawExcessCollateral(),
                      owner.address
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });
          });
          describe("uncollateralized", async () => {
            beforeEach(async () => {
              bond = bondWithTokens.uncollateralized.bond;
              config = bondWithTokens.uncollateralized.config;
              await collateralToken.approve(
                bond.address,
                config.collateralTokenAmount
              );
            });

            it("should have zero collateral available to withdraw when they are burned", async () => {
              await burnAndWithdraw({
                bond,
                sharesToBurn: config.maxSupply,
                collateralToReceive: ZERO,
              });
            });

            it("should make excess collateral available to withdraw", async () => {
              expect(await bond.previewWithdrawExcessCollateral()).to.equal(
                ZERO
              );
              await collateralToken.approve(
                bond.address,
                utils.parseEther("100")
              );
              await collateralToken.transfer(
                bond.address,
                utils.parseEther("0.0001")
              );
              expect(await bond.previewWithdrawExcessCollateral()).to.equal(
                utils.parseEther("0.0001")
              );
              await collateralToken.transfer(
                bond.address,
                utils.parseEther("1")
              );
              expect(await bond.previewWithdrawExcessCollateral()).to.equal(
                utils.parseEther("1.0001")
              );
              await collateralToken.transfer(
                bond.address,
                utils.parseEther("100")
              );
              expect(await bond.previewWithdrawExcessCollateral()).to.equal(
                utils.parseEther("101.0001")
              );
            });
          });
        });
      });
      describe("#redeem", async () => {
        beforeEach(async () => {
          bond = bondWithTokens.nonConvertible.bond;
          config = bondWithTokens.nonConvertible.config;
          await paymentToken.approve(bond.address, config.maxSupply);
        });

        describe("Paid state", async () => {
          it("should redeem for payment token", async () => {
            await bond.pay(config.maxSupply);
            await ethers.provider.send("evm_mine", [config.maturity]);
            const sharesToRedeem = utils.parseUnits("333", decimals);
            await bond.transfer(bondHolder.address, sharesToRedeem);
            await previewRedeem({
              bond,
              sharesToRedeem,
              paymentTokenToSend: sharesToRedeem,
              collateralTokenToSend: ZERO,
            });

            await redeemAndCheckTokens({
              bond,
              bondHolder,
              paymentToken,
              collateralToken,
              sharesToRedeem,
              paymentTokenToSend: sharesToRedeem,
              collateralTokenToSend: ZERO,
            });
          });
        });
        describe("PaidEarly state", async () => {
          it("should redeem for payment token when bond is PaidEarly", async () => {
            await bond.pay(await bond.amountUnpaid());
            const sharesToRedeem = utils.parseUnits("1000", decimals);
            await bond.transfer(bondHolder.address, sharesToRedeem);
            await previewRedeem({
              bond,
              sharesToRedeem: sharesToRedeem,
              paymentTokenToSend: sharesToRedeem,
              collateralTokenToSend: ZERO,
            });
            await redeemAndCheckTokens({
              bond,
              bondHolder,
              paymentToken,
              collateralToken,
              sharesToRedeem: sharesToRedeem,
              paymentTokenToSend: sharesToRedeem,
              collateralTokenToSend: ZERO,
            });
          });

          it("should revert if 0 bonds are passed in & PaidEarly", async () => {
            await bond.pay(await bond.amountUnpaid());
            await previewRedeem({
              bond,
              sharesToRedeem: ZERO,
              paymentTokenToSend: ZERO,
              collateralTokenToSend: ZERO,
            });
            await expect(bond.redeem(ZERO)).to.be.revertedWith("ZeroAmount");
          });
        });

        describe("Defaulted state (during grace period)", async () => {
          beforeEach(async () => {
            // Skip to maturity as this is the start of the grace period
            await ethers.provider.send("evm_mine", [config.maturity]);
          });

          it("fails when trying to redeem", async () => {
            await expect(bond.redeem(1)).to.be.revertedWith(
              "BondBeforeGracePeriodAndNotPaid"
            );
          });
        });
        describe("Defaulted state (after grace period)", async () => {
          beforeEach(async () => {
            await mineToGracePeriod(bond);
          });

          it("should not be possible to redeem zero bonds", async () => {
            await previewRedeem({
              bond,
              sharesToRedeem: ZERO,
              paymentTokenToSend: ZERO,
              collateralTokenToSend: ZERO,
            });
            await expect(bond.redeem(ZERO)).to.be.revertedWith("ZeroAmount");
          });

          it("should withdraw collateral", async () => {
            const sharesToRedeem = (await bond.balanceOf(owner.address)).div(5);
            const collateralTokenToSend = mulWad(
              sharesToRedeem,
              await bond.collateralRatio()
            );

            await previewRedeem({
              bond,
              sharesToRedeem,
              paymentTokenToSend: ZERO,
              collateralTokenToSend,
            });

            await redeemAndCheckTokens({
              bond,
              bondHolder: owner,
              paymentToken,
              collateralToken,
              sharesToRedeem,
              paymentTokenToSend: ZERO,
              collateralTokenToSend,
            });
          });

          it("should redeem payment and collateral portions when partly paid", async () => {
            const paymentAmount = utils.parseUnits("4000", decimals);
            await bond.pay(paymentAmount);

            const portionOfTotalBonds = paymentAmount
              .mul(ONE)
              .div(config.maxSupply);
            const portionOfPaymentAmount = portionOfTotalBonds
              .mul(paymentAmount)
              .div(ONE);

            // the amount of bonds not covered by the payment amount
            const totalUncoveredSupply = config.maxSupply.sub(
              utils.parseUnits("4000", decimals)
            );
            const totalCollateralTokens = totalUncoveredSupply
              .mul(await bond.collateralRatio())
              .div(ONE);
            const portionOfCollateralAmount = totalCollateralTokens
              .mul(utils.parseUnits("4000", decimals))
              .div(config.maxSupply);
            await redeemAndCheckTokens({
              bond,
              bondHolder: owner,
              paymentToken,
              collateralToken,
              sharesToRedeem: utils.parseUnits("4000", decimals),
              paymentTokenToSend: portionOfPaymentAmount,
              collateralTokenToSend: portionOfCollateralAmount,
            });
          });

          describe("uncollateralized bond", async () => {
            beforeEach(async () => {
              bond = bondWithTokens.uncollateralized.bond;
              config = bondWithTokens.uncollateralized.config;

              await paymentToken.approve(bond.address, config.maxSupply);
            });

            it("should withdraw zero collateral when bond is Defaulted ", async () => {
              await previewRedeem({
                bond,
                sharesToRedeem: utils.parseUnits("1000", decimals),
                paymentTokenToSend: ZERO,
                collateralTokenToSend: ZERO,
              });

              await expect(
                bond.redeem(utils.parseUnits("1000", decimals))
              ).to.be.revertedWith("ZeroAmount");
            });

            it("redeems correct amount of tokens when partially paid", async () => {
              const amountUnpaid = (await bond.amountUnpaid()).div(2);
              await bond.pay(amountUnpaid);

              const portionOfTotalBonds = amountUnpaid
                .mul(ONE)
                .div(config.maxSupply);
              const portionOfPaymentAmount = portionOfTotalBonds
                .mul(amountUnpaid)
                .div(ONE);
              const sharesToRedeem = amountUnpaid;

              await bond.transfer(bondHolder.address, sharesToRedeem);
              await redeemAndCheckTokens({
                bond,
                bondHolder,
                paymentToken,
                collateralToken,
                sharesToRedeem,
                paymentTokenToSend: portionOfPaymentAmount,
                collateralTokenToSend: ZERO,
              });
            });
          });
        });
        describe("Active state", async () => {
          it("should redeem for zero tokens when bond is Active", async () => {
            await bond.pay((await bond.amountUnpaid()).sub(1));
            await previewRedeem({
              bond,
              sharesToRedeem: ZERO,
              paymentTokenToSend: ZERO,
              collateralTokenToSend: ZERO,
            });

            await expect(
              bond.connect(bondHolder).redeem(ZERO)
            ).to.be.revertedWith("BondBeforeGracePeriodAndNotPaid");
          });

          it("returns 0 if all bonds are burned", async () => {
            const bonds = await bond.balanceOf(owner.address);
            await bond.burn(bonds);
            await previewRedeem({
              bond,
              sharesToRedeem: ZERO,
              paymentTokenToSend: ZERO,
              collateralTokenToSend: ZERO,
            });
          });
        });
      });
      describe("convert", async () => {
        describe("convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
            await collateralToken.approve(
              bond.address,
              config.collateralTokenAmount
            );
            await bond.transfer(bondHolder.address, config.maxSupply);
          });

          it("previews convert zero converted", async () => {
            expect(await bond.previewConvertBeforeMaturity(ZERO)).to.equal(
              ZERO
            );
          });

          it("previews convert target converted", async () => {
            expect(
              await bond.previewConvertBeforeMaturity(config.maxSupply)
            ).to.equal(config.convertibleTokenAmount);
          });

          it("previews convert half target converted", async () => {
            expect(
              await bond.previewConvertBeforeMaturity(config.maxSupply.div(2))
            ).to.equal(config.convertibleTokenAmount.div(2));
          });

          it("should convert bond amount into collateral at convertibleRatio", async () => {
            const {
              from,
              collateralToken: convertedCollateralToken,
              amountOfBondsConverted,
              amountOfCollateralTokens,
            } = await getEventArgumentsFromTransaction(
              await bond.connect(bondHolder).convert(config.maxSupply),
              "Convert"
            );
            expect(from).to.equal(bondHolder.address);
            expect(convertedCollateralToken).to.equal(collateralToken.address);
            expect(amountOfBondsConverted).to.equal(config.maxSupply);
            expect(amountOfCollateralTokens).to.equal(
              config.convertibleTokenAmount
            );
          });

          it("should lower amount owed when bonds are converted", async () => {
            const amountUnpaid = await bond.amountUnpaid();
            await bond.connect(bondHolder).convert(config.maxSupply.div(2));
            expect(await bond.amountUnpaid()).to.be.equal(amountUnpaid.div(2));
            expect(await bond.amountUnpaid()).to.be.equal(
              config.maxSupply.div(2)
            );
          });

          it("fails to convert zero bonds", async () => {
            await expect(
              bond.connect(bondHolder).convert(0)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("should fail to convert after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturity]);

            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("BondPastMaturity");
          });

          it("should fail to convert with zero bonds", async () => {
            await expect(bond.connect(bondHolder).convert(config.maxSupply)).to
              .not.be.reverted;
            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("ERC20: burn amount exceeds balance");
          });
        });
        describe("non-convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            await bond.transfer(bondHolder.address, config.maxSupply);
          });

          it("should fail to convert if bond is not convertible", async () => {
            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("fails to convert zero bonds", async () => {
            await expect(
              bond.connect(bondHolder).convert(0)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("should fail to convert after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturity]);

            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("BondPastMaturity");
          });
        });
        describe("uncollateralized", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.uncollateralized.bond;
            config = bondWithTokens.uncollateralized.config;
            await bond.transfer(bondHolder.address, config.maxSupply);
          });

          it("should fail to convert if bond is uncollateralized and therefore unconvertible", async () => {
            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("fails to convert zero bonds", async () => {
            await expect(
              bond.connect(bondHolder).convert(0)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("should fail to convert after maturity", async () => {
            await ethers.provider.send("evm_mine", [config.maturity]);

            await expect(
              bond.connect(bondHolder).convert(config.maxSupply)
            ).to.be.revertedWith("BondPastMaturity");
          });
        });
      });
      describe("sweep", async () => {
        describe("non convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
            paymentToken.transfer(bond.address, utils.parseEther("1"));
            collateralToken.transfer(bond.address, utils.parseEther("1"));
          });

          it("sweeps ERC20 token out of bond contract", async () => {
            await attackingToken.connect(attacker).transfer(bond.address, 1000);
            const balanceBefore = await attackingToken.balanceOf(
              attacker.address
            );
            await expect(
              bond.sweep(attackingToken.address, attacker.address)
            ).to.emit(bond, "TokenSweep");
            const balanceAfter = await attackingToken.balanceOf(
              attacker.address
            );

            expect(balanceAfter.sub(balanceBefore)).to.be.equal(1000);
          });

          it("reverts when sweeping a token that has no balance", async () => {
            await expect(
              bond.sweep(attackingToken.address, owner.address)
            ).to.be.revertedWith("ZeroAmount");
          });

          it("reverts if called by non-owner", async () => {
            await expect(
              bond
                .connect(attacker)
                .sweep(attackingToken.address, owner.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });

          it("reverts when trying to sweep paymentTokens or collateralTokens", async () => {
            await expect(
              bond.sweep(paymentToken.address, owner.address)
            ).to.be.revertedWith("SweepDisallowedForToken");
            await expect(
              bond.sweep(collateralToken.address, owner.address)
            ).to.be.revertedWith("SweepDisallowedForToken");
          });

          it("reverts when sweeping a token that has no balance", async () => {
            await expect(
              bond.sweep(attackingToken.address, owner.address)
            ).to.be.revertedWith("ZeroAmount");
          });
        });
      });
      describe("#previewWithdrawExcessCollateralAfterPayment", async () => {
        describe("non convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
          });
          it("previews after payment before maturity", async () => {
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(ZERO)
            ).to.equal(ZERO);

            // pay off half of bond
            await collateralToken.approve(bond.address, config.maxSupply);
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                config.maxSupply.div(2)
              )
            ).to.equal(config.collateralTokenAmount.div(2));

            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                config.maxSupply
              )
            ).to.equal(config.collateralTokenAmount);

            // overpay - there should maximum amount of collateral token amount
            const amountToPay = config.maxSupply.add(utils.parseEther("2"));
            await collateralToken.approve(bond.address, amountToPay);
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                amountToPay
              )
            ).to.equal(config.collateralTokenAmount);
          });
          it("has zero excess collateral as is", async () => {
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(ZERO)
            ).to.equal(ZERO);
          });
          it("has half collateral available after half paid", async () => {
            await collateralToken.approve(bond.address, config.maxSupply);
            // pay off half of bond
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                config.maxSupply.div(2)
              )
            ).to.equal(config.collateralTokenAmount.div(2));
          });
          it("has all collateral available after full payment", async () => {
            await (
              await bond.transfer(bondHolder.address, config.maxSupply.div(2))
            ).wait();
          });
          it("can not withdraw collateral after bonds have been redeemed", async () => {
            await bond.transfer(bondHolder.address, config.maxSupply);
            await mineToGracePeriod(bond);
            // a bond holder redeems the other half of bonds
            await expectTokenDelta(
              () => bond.connect(bondHolder).redeem(config.maxSupply),
              collateralToken,
              bondHolder,
              bondHolder.address,
              config.collateralTokenAmount
            );

            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(ZERO)
            ).to.equal(ZERO);
          });
        });
        describe("convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.convertible.bond;
            config = bondWithTokens.convertible.config;
          });
          it("has zero excess collateral as is", async () => {
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(ZERO)
            ).to.equal(ZERO);
          });
          it("has available collateral to retrieve if convertible amount is covered", async () => {
            await collateralToken.approve(bond.address, config.maxSupply);
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                config.maxSupply.div(2)
              )
            ).to.equal(config.collateralTokenAmount.div(2));
          });
          it("requires convertible collateral to remain", async () => {
            // paying off full bond less
            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(
                config.maxSupply
              )
            ).to.equal(
              config.collateralTokenAmount.sub(config.convertibleTokenAmount)
            );
          });
          it("has collateral available after conversion", async () => {
            await (
              await bond.transfer(bondHolder.address, config.maxSupply)
            ).wait();

            await expectTokenDelta(
              () => bond.connect(bondHolder).convert(config.maxSupply),
              collateralToken,
              bondHolder,
              bondHolder.address,
              config.convertibleTokenAmount
            );

            expect(
              await bond.previewWithdrawExcessCollateralAfterPayment(ZERO)
            ).to.equal(
              config.collateralTokenAmount.sub(config.convertibleTokenAmount)
            );
          });
        });
      });
      describe("configuration", async () => {
        describe("non convertible", async () => {
          beforeEach(async () => {
            bond = bondWithTokens.nonConvertible.bond;
            config = bondWithTokens.nonConvertible.config;
          });
          describe("localConfig", async () => {
            // sanity check our constant config is set correctly
            it("has the variables set from local config", async () => {
              expect(await bond.maturity()).to.be.equal(config.maturity);
              expect(await bond.totalSupply()).to.be.equal(config.maxSupply);
            });
          });
          describe("#isMature", async () => {
            it("is not mature before the maturity date", async () => {
              expect(await bond.isMature()).to.equal(false);
              await ethers.provider.send("evm_mine", [
                BigNumber.from(config.maturity).sub(100).toNumber(),
              ]);
              expect(await bond.isMature()).to.equal(false);
            });
            it("is mature after the maturity date is reached", async () => {
              await ethers.provider.send("evm_mine", [config.maturity]);
              expect(await bond.isMature()).to.equal(true);
              await ethers.provider.send("evm_mine", [
                BigNumber.from(config.maturity).add(100).toNumber(),
              ]);
              expect(await bond.isMature()).to.equal(true);
            });
            it("is the correct date", async () => {
              const maturityDate = await bond.maturity();
              expect(maturityDate).to.be.equal(config.maturity);
              await ethers.provider.send("evm_mine", [
                maturityDate.sub(1000).toNumber(),
              ]);
              expect(await bond.isMature()).to.be.equal(false);
              await ethers.provider.send("evm_mine", [
                maturityDate.add(1000).toNumber(),
              ]);
              expect(await bond.isMature()).to.be.equal(true);
            });
          });
          describe("#gracePeriodEnd", async () => {
            it("has a gracePeriodEnd that is the maturity + GRACE_PERIOD", async () => {
              expect(await bond.gracePeriodEnd()).to.be.equal(
                (await bond.maturity()).add(GRACE_PERIOD)
              );
            });
          });
          describe("#collateralBalance", async () => {
            it("has the correct collateralBalance", async () => {
              expect(await bond.collateralBalance()).to.equal(
                config.collateralTokenAmount
              );
              await paymentToken.approve(bond.address, config.maxSupply);

              await bond.pay(config.maxSupply.div(2));
              await bond.withdrawExcessCollateral(
                config.collateralTokenAmount.div(2),
                owner.address
              );
              expect(await bond.collateralBalance()).to.equal(
                config.collateralTokenAmount.div(2)
              );
              await bond.burn(config.maxSupply.div(2));

              await bond.withdrawExcessCollateral(
                config.collateralTokenAmount.div(2),
                owner.address
              );
              expect(await bond.collateralBalance()).to.equal(ZERO);
            });
          });
        });
      });
    });
  });
});
