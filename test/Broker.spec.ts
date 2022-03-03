import { type Contract, BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  addDaysToNow,
  AuctionData,
  createAuction,
  getBondContract,
  useCustomErrorMatcher,
} from "./utilities";
import type { Broker, SimpleBond } from "../typechain";
import { borrowingTokenFixture, brokerFixture } from "./shared/fixtures";
const { loadFixture } = waffle;

useCustomErrorMatcher();
describe("Broker", async () => {
  // address of the example DAO which configures and runs the auction
  let issuerSigner: SignerWithAddress;
  let eveSigner: SignerWithAddress;
  let broker: Broker;
  let gnosisAuction: Contract;
  let bond: SimpleBond;

  const maxBondSupply = 12500;

  // 3 years from now, in seconds
  const maturityDate = Math.round(
    new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
      1000
  );

  async function fixture() {
    const { broker, collateralData, gnosisAuction, collateralToken } =
      await brokerFixture();
    const { borrowingToken } = await borrowingTokenFixture();
    const bond = await getBondContract(
      broker.createBond(
        issuerSigner.address,
        maturityDate,
        maxBondSupply,
        collateralData.collateralAddress,
        BigNumber.from(150),
        borrowingToken.address,
        BigNumber.from(50)
      )
    );

    // todo: this flow is weird
    // first we approve the bond to transfer collateral from the issuer
    await collateralToken
      .connect(issuerSigner)
      .approve(bond.address, collateralData.collateralAmount);
    // then we transfer the collateral into the bond
    await bond
      .connect(issuerSigner)
      .collateralize(collateralData.collateralAmount);
    // after the collateral is in the bond, we can mint tokens to the issuer
    await bond.connect(issuerSigner).mint(maxBondSupply);
    // then we approve the broker to transfer tokens to the auction...
    await bond.connect(issuerSigner).approve(broker.address, maxBondSupply);

    return { bond, broker, collateralData, collateralToken, gnosisAuction };
  }

  beforeEach(async () => {
    [, issuerSigner, eveSigner] = await ethers.getSigners();
    ({ bond, broker, gnosisAuction } = await loadFixture(fixture));
  });

  it("starts an auction", async () => {
    const auctionData: AuctionData = {
      _biddingToken: bond.address,
      orderCancellationEndDate: addDaysToNow(1),
      auctionEndDate: addDaysToNow(2),
      _auctionedSellAmount: BigNumber.from(maxBondSupply),
      _minBuyAmount: ethers.utils.parseEther("1"),
      minimumBiddingAmountPerOrder: ethers.utils.parseEther(".01"),
      minFundingThreshold: ethers.utils.parseEther("30"),
      isAtomicClosureAllowed: false,
      accessManagerContract: ethers.constants.AddressZero,
      accessManagerContractData: ethers.utils.arrayify("0x00"),
    };
    const currentAuction = parseInt(await gnosisAuction.auctionCounter());
    const { auctionId } = await createAuction(
      broker,
      issuerSigner,
      auctionData,
      bond.address
    );
    expect(auctionId).to.be.equal(currentAuction + 1);
  });

  it("bars unauthorized auctioneer", async () => {
    const auctionData: AuctionData = {
      _biddingToken: bond.address,
      orderCancellationEndDate: addDaysToNow(1),
      auctionEndDate: addDaysToNow(2),
      _auctionedSellAmount: BigNumber.from(maxBondSupply),
      _minBuyAmount: ethers.utils.parseEther("1"),
      minimumBiddingAmountPerOrder: ethers.utils.parseEther(".01"),
      minFundingThreshold: ethers.utils.parseEther("30"),
      isAtomicClosureAllowed: false,
      accessManagerContract: ethers.constants.AddressZero,
      accessManagerContractData: ethers.utils.arrayify("0x00"),
    };

    await expect(
      createAuction(broker, eveSigner, auctionData, bond.address)
    ).to.be.revertedWith("UnauthorizedInteractionWithBond");
  });

  it("creates a bond through the deployed clone factory", async () => {
    expect(bond.address).to.not.be.eq(null);
  });
});
