import { BigNumber } from "ethers";

import { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  closeAuction,
  CollateralData,
  createAuctionWithDefaults,
  createTokensAndMintAndApprove,
  encodeOrder,
  placeOrders,
} from "./utilities";
import { expect } from "chai";
import type {
  BondToken as BondTokenType,
  CollateralToken as CollateralTokenType,
  PorterAuction as PorterAuctionType,
  EasyAuction as GnosisAuctionType,
  BiddingToken as BiddingTokenType,
} from "../typechain";

describe("Auction", async () => {
  // default deployer address of contracts
  let porterSigner: SignerWithAddress;
  // address of the example DAO which configures and runs the auction
  let auctioneerSigner: SignerWithAddress;
  // addresses of the bidders
  let bidders: SignerWithAddress[];
  let porterAuction: PorterAuctionType;
  let gnosisAuction: GnosisAuctionType;
  let biddingToken: BiddingTokenType;
  let collateralToken: CollateralTokenType;
  let bondToken: BondTokenType;
  beforeEach(async () => {
    [porterSigner, auctioneerSigner, ...bidders] = await ethers.getSigners();

    const GnosisAuction = await ethers.getContractFactory("EasyAuction");
    gnosisAuction = (await GnosisAuction.deploy()) as GnosisAuctionType;

    const PorterAuction = await ethers.getContractFactory("PorterAuction");
    porterAuction = (await PorterAuction.deploy(
      gnosisAuction.address
    )) as PorterAuctionType;

    const BiddingToken = await ethers.getContractFactory("BiddingToken");
    biddingToken = (await BiddingToken.deploy(
      "Bidding Token",
      "BT",
      ethers.utils.parseEther("10000")
    )) as BiddingTokenType;

    // Mint 100 ether of tokens of collateral for auctioneerSigner
    const CollateralToken = await ethers.getContractFactory("CollateralToken");
    collateralToken = (await CollateralToken.connect(auctioneerSigner).deploy(
      "Collateral Token",
      "CT",
      ethers.utils.parseEther("100")
    )) as CollateralTokenType;

    // The tokens minted here do not matter. The Porter Auction will mint the bondToken
    const BondToken = await ethers.getContractFactory("BondToken");
    bondToken = (await BondToken.connect(porterSigner).deploy(
      "Bond Token",
      "BT",
      ethers.utils.parseEther("100")
    )) as BondTokenType;
  });
  describe("Porter Auction E2E", async () => {
    it("deposits collateral, initiates auction, settles auction", async () => {
      /* --------------------------------------------------
      |                                                    |
      |                   debug info                       |
      |                                                    |
      -------------------------------------------------- */
      console.log({
        porter: porterSigner.address,
        auctioneer: auctioneerSigner.address,
        [`bidders(${bidders.length})`]: bidders.map((b) => b.address),
        bondTokenAddress: bondToken.address,
        collateralTokenAddress: collateralToken.address,
        biddingTokenAddress: biddingToken.address,
        porterAuctionAddress: porterAuction.address,
        gnosisAuctionAddress: gnosisAuction.address,
      });
      /* --------------------------------------------------
      |                                                    |
      |                 set up collateral                  |
      |                                                    |
      ---------------------------------------------------- */
      const collateralData: CollateralData = {
        collateralAddress: collateralToken.address,
        collateralValue: ethers.utils.parseEther("100"),
      };

      // from auctioneerSigner, approve the value of collateral to the porterAuction contract
      await collateralToken
        .connect(auctioneerSigner)
        .increaseAllowance(
          porterAuction.address,
          collateralData.collateralValue
        );

      const configureCollateralTx = await porterAuction
        .connect(auctioneerSigner)
        .configureCollateral(collateralData);

      expect(configureCollateralTx, "Collateral deposited")
        .to.emit(porterAuction, "CollateralDeposited")
        .withArgs(
          auctioneerSigner.address,
          collateralToken.address,
          collateralData.collateralValue
        );

      // The deposited collateral should exist in the porterAuction contract
      expect(
        await porterAuction.collateralInContract(
          auctioneerSigner.address,
          collateralToken.address
        ),
        "Collateral in contract"
      ).to.be.equal(collateralData.collateralValue);

      /* --------------------------------------------------
      |                                                    |
      |               set up GnosisAuction                 |
      |                                                    |
      ---------------------------------------------------- */
      // This creates the GnosisAuction and returns the auctionId of the newly created auction
      const { auctionId, bondTokenAddress } = await createAuctionWithDefaults(
        auctioneerSigner,
        biddingToken,
        collateralData,
        porterAuction
      );

      // After the auction is created, the auctionCount should be 1
      expect(auctionId, "GnosisAuction counter incremented").to.be.equal(1);

      // After the auction is created, the collateralInContract should be 0
      // (or in practice, the existing value minus the collateralValue)
      expect(
        await porterAuction.collateralInContract(
          auctioneerSigner.address,
          collateralToken.address
        ),
        "Collateral stored in contract"
      ).to.be.equal(0);

      // The collateralInAuction should be the collateralValue (note the mapping looks up the auctionId)
      expect(
        await porterAuction.collateralInAuction(
          auctionId,
          collateralToken.address
        ),
        "Collateral stored in auction"
      ).to.be.equal(collateralData.collateralValue);

      /* --------------------------------------------------
      |                                                    |
      |                 place orders                       |
      |                                                    |
      ---------------------------------------------------- */

      // Give tokens from porterSigner to bidders and approve for transfer to gnosis auction
      await createTokensAndMintAndApprove(
        gnosisAuction,
        biddingToken,
        porterSigner,
        bidders
      );

      // create sell orders for all bidders addresses
      const nrTests = bidders.length;
      for (let i = 0; i < nrTests; i++) {
        const sellOrder = [
          {
            sellAmount: ethers.utils
              .parseEther("10")
              .div(BigNumber.from(nrTests - 2)),
            buyAmount: ethers.utils.parseEther("1"),
            userId: BigNumber.from(i + 2),
          },
        ];
        await placeOrders(gnosisAuction, sellOrder, auctionId);
      }

      /* ----------------------------------------------------
      |                                                     |
      |                     close auction                   |
      |                                                     |
      ---------------------------------------------------- */
      // This increases the time to the end of the auction
      await closeAuction(gnosisAuction, auctionId);

      /* ----------------------------------------------------
      |                                                     |
      |              partially settle orders                |
      |                     (for fun)                       |
      |                                                     |
      ---------------------------------------------------- */
      // This settles some of the orders and moves the queue element
      // there is an order left over (bidders.length - 1) because there needs to be
      // at least one order left over to be able to settle the auction
      await gnosisAuction.precalculateSellAmountSum(
        auctionId,
        bidders.length - 1
      );

      /* ----------------------------------------------------
      |                                                     |
      |                 settle auction                      |
      |                                                     |
      ---------------------------------------------------- */
      const settleTx = await gnosisAuction.settleAuction(auctionId);
      expect(settleTx).to.emit(gnosisAuction, "AuctionCleared");

      /* --------------------------------------------------
      |                                                    |
      |                 check results                      |
      |                                                    |
      ---------------------------------------------------- */
      // TODO: not sure what to expect here, probably something with getting the settlement amount
      // and checking that each bidder has the correct amount of tokens for now
      // confirm that there is a change in bondTokens

      // before claiming from all orders, the bidding token should be 0
      expect(
        await bondToken.attach(bondTokenAddress).balanceOf(bidders[0].address)
      ).to.be.eq(0);

      for (let i = 0; i < nrTests; i++) {
        const sellOrder = {
          sellAmount: ethers.utils
            .parseEther("10")
            .div(BigNumber.from(nrTests - 2)),
          buyAmount: ethers.utils.parseEther("1"),
          userId: BigNumber.from(i + 2),
        };
        const claimTx = await gnosisAuction.claimFromParticipantOrder(
          auctionId,
          [encodeOrder(sellOrder)]
        );
        expect(claimTx).to.emit(gnosisAuction, "ClaimedFromOrder");
      }

      // after, the bond token should be assigned to the account
      expect(
        await bondToken.attach(bondTokenAddress).balanceOf(bidders[0].address)
      ).to.be.gt(0);
    });
  });
});
