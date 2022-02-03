/* eslint-disable prettier/prettier */
import { expect } from "chai";
import { BigNumber, Contract, Event } from "ethers";

import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CollateralData, createAuctionWithDefaults } from "./utilities";

describe("Auction", async () => {
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let auction: Contract;
  let biddingToken: Contract;
  let collateralToken: Contract;
  let gnosisAuction: Contract;
  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    const GnosisAuction = await ethers.getContractFactory("EasyAuction");
    gnosisAuction = await GnosisAuction.deploy();
    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy(gnosisAuction.address);

    const BondToken = await ethers.getContractFactory("BondToken");
    biddingToken = await BondToken.deploy(
      "BiddingToken",
      "BT",
      ethers.utils.parseEther("100")
    );
    // Give addr1 100 ether of tokens of collateral
    collateralToken = await BondToken.connect(addr1).deploy(
      "Collateral Token",
      "CT",
      ethers.utils.parseEther("100")
    );
  });
  xdescribe("Auction", async () => {
    it("should set up collateral", async () => {
      const collateralData: CollateralData = {
        collateralAddress: collateralToken.address,
        collateralValue: BigNumber.from(0),
      };
      collateralToken.increaseAllowance(
        auction.address,
        collateralData.collateralValue
      );
      const receipt = await (
        await auction.configureCollateral(collateralData)
      ).wait();
      const collateralValue = receipt.events.find(
        (event: Event) => event.event === "CollateralDeposited"
      )?.args?.collateralValue;
      expect(collateralValue).to.be.equal(collateralData.collateralValue);
    });
    it("should set up auction", async () => {
      // setup

      const collateralData: CollateralData = {
        collateralAddress: collateralToken.address,
        collateralValue: ethers.utils.parseEther("100"),
      };
      const { auctionId } = await createAuctionWithDefaults(
        owner,
        biddingToken,
        collateralData,
        auction
      );
      expect(auctionId).to.be.equal(1);
    });
    it("should accept bids", async () => {
      const collateralData: CollateralData = {
        collateralAddress: collateralToken.address,
        collateralValue: ethers.utils.parseEther("100"),
      };
      const receipt = await (
        await auction.configureCollateral(collateralData)
      ).wait();
      const collateralValue = receipt.events.find(
        (event: Event) => event.event === "CollateralDeposited"
      )?.args?.collateralValue;
      const { auctionId } = await createAuctionWithDefaults(
        owner,
        biddingToken,
        collateralData,
        auction
      );
      expect(auctionId).to.be.equal(1);
    });
  });
});
