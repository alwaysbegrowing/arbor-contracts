import { expect } from "chai";
import { SimpleBond as SimpleBondType } from "../typechain";

// https://ethereum-waffle.readthedocs.io/en/latest/fixtures.html
// import from waffle since we are using hardhat: https://hardhat.org/plugins/nomiclabs-hardhat-waffle.html#environment-extensions
const { ethers, waffle } = require("hardhat");
const { loadFixture, deployContract } = waffle;

const SimpleBond = require("../artifacts/contracts/SimpleBond.sol/SimpleBond.json");

describe("SimpleBond", async () => {
  // 3 years from now, in seconds
  const maturityDate = Math.round(
    new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
      1000
  );

  // A realistic number for this is like 2m
  const totalBondSupply = 12500;
  const numberOfBonds = 1000;
  let payToAccount: any;
  let payToAddress: any;

  const name = "My Token";
  const symbol = "MTKN";
  let bond: SimpleBondType;
  let initialAccount: any;

  // no args because of gh issue:
  // https://github.com/nomiclabs/hardhat/issues/849#issuecomment-860576796
  async function fixture() {
    const [wallet, other] = await ethers.getSigners();
    bond = await deployContract(wallet, SimpleBond, [
      name,
      symbol,
      totalBondSupply,
      maturityDate,
    ]);
    return { bond, wallet, other };
  }

  beforeEach(async () => {
    const { wallet, other } = await loadFixture(fixture);
    payToAccount = other;
    initialAccount = await wallet.getAddress();
    payToAddress = await other.getAddress();
    await bond.transfer(payToAddress, numberOfBonds);
  });

  it("should have total supply less bond issuance in owner account", async function () {
    expect(await bond.balanceOf(initialAccount)).to.be.equal(
      totalBondSupply - numberOfBonds
    );

    expect(await bond.balanceOf(payToAddress)).to.be.equal(numberOfBonds);
  });

  it("should be owner", async function () {
    expect(await bond.owner()).to.be.equal(initialAccount);
  });

  it("should return total value for an account", async function () {
    const payeeBond = await bond.connect(payToAccount);

    expect(await payeeBond.balanceOf(payToAddress)).to.be.equal(numberOfBonds);
  });

  it("should return payment due date", async function () {
    const payeeBond = await bond.connect(payToAccount);

    expect(await payeeBond.maturityDate()).to.be.equal(maturityDate);
  });

  it("should return bond state to be not repaid", async function () {
    const payeeBond = await bond.connect(payToAccount);

    expect(await payeeBond.currentBondStanding()).to.be.equal(0);
  });

  // failing until hooked up with auction
  it("should pay back bond and return correct repaid state", async function () {
    // quick check to make sure payTo has a bond issued
    expect(await bond.balanceOf(payToAddress)).to.be.equal(numberOfBonds);

    // and that it's not already paid off
    expect(await bond.currentBondStanding()).to.be.equal(0);

    // This should repay using auction contract
    // await auctionContract.repay(address)...
    expect(await bond.currentBondStanding()).to.be.equal(2);
  });

  // failing until hooked up with auction
  it("should redeem bond at maturity", async function () {
    // Connect the pay account to this contract
    const payeeBond = bond.connect(payToAccount);

    // quick check to make sure payTo has a bond issued
    expect(await payeeBond.balanceOf(payToAddress)).to.be.equal(numberOfBonds);

    // and that it's not already paid off
    expect(await payeeBond.currentBondStanding()).to.be.equal(0);
    // This should repay using auction contract
    // await auctionContract.repay(address)...
    expect(await payeeBond.currentBondStanding()).to.be.equal(2);

    // TODO: this should approve the token payment not the bond token?
    await payeeBond.approve(payToAddress, numberOfBonds);

    // Pays 1:1 to the bond token
    await payToAccount.sendTransaction({
      to: payeeBond.address,
      value: numberOfBonds,
    });

    // Fast forward to expire
    await ethers.provider.send("evm_mine", [maturityDate]);

    const currentBal = await payToAccount.getBalance();
    await payeeBond.redeemBond(numberOfBonds);

    // This is failing, likely because sendTransaction isn't sending value in
    // a format it's expecting? not sure
    expect(await payToAccount.getBalance()).to.be.equal(
      currentBal.add(numberOfBonds)
    );

    expect(await payeeBond.currentBondStanding()).to.be.equal(3);
  });
});
