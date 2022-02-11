import { BigNumber, Contract } from "ethers";

import { ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  addDaysToNow,
  AuctionData,
  closeAuction,
  CollateralData,
  createAuction,
  createTokensAndMintAndApprove,
  encodeOrder,
  getEventArgumentsFromTransaction,
  placeOrders,
} from "./utilities";
import { expect } from "chai";
import type { CollateralToken, Broker, BiddingToken } from "../typechain";

// import type { EasyAuction } from "../contracts/external/EasyAuction";
const EasyAuctionJson = require("../contracts/external/EasyAuction.json");

const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
};
describe("Auction", async () => {
  // default deployer address of contracts
  let owner: SignerWithAddress;
  // address of the example DAO which configures and runs the auction
  let auctioneerSigner: SignerWithAddress;
  // addresses of the bidders
  let bidders: SignerWithAddress[];
  let broker: Broker;
  let gnosisAuction: Contract;
  let biddingToken: BiddingToken;
  let collateralToken: CollateralToken;
  let collateralData: CollateralData;
  let auctionId: number;
  let initialUserId: number;

/*

_minBuyAmounts[i].mul(buyAmountOfInitialAuctionOrder) <
  sellAmountOfInitialAuctionOrder.mul(_sellAmounts[i]),

  */
  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_RPC_URL,
            blockNumber: Number(process.env.FORK_BLOCK_NUMBER),
          },
        },
      ],
    });
    collateralData = {
      collateralAddress: ethers.constants.AddressZero,
      collateralAmount: ethers.utils.parseEther("100"),
    };
    [owner, auctioneerSigner, ...bidders] = await ethers.getSigners();
    bidders = bidders.slice(0, 3);

    const BiddingToken = await ethers.getContractFactory("BiddingToken");
    biddingToken = (await BiddingToken.deploy(
      "Bidding Token",
      "BT",
      ethers.utils.parseEther("10000")
    )) as BiddingToken;

    // Mint 100 ether of tokens of collateral for auctioneerSigner
    const CollateralToken = await ethers.getContractFactory("CollateralToken");
    collateralToken = (await CollateralToken.connect(auctioneerSigner).deploy(
      "Collateral Token",
      "CT",
      collateralData.collateralAmount
    )) as CollateralToken;
    // set collateral address
    collateralData.collateralAddress = collateralToken.address;

    // The tokens minted here do not matter. The Porter Auction will mint the porterBond
    gnosisAuction = await ethers.getContractAt(
      EasyAuctionJson.abi,
      GNOSIS_AUCTION_ADDRESS.mainnet
    );

    const Broker = await ethers.getContractFactory("Broker");
    broker = (await Broker.deploy(gnosisAuction.address)) as Broker;
    // ----------------------------------------------------
    //                                                    |
    // console.log("e2e/debug info"); //                  |
    //                                                    |
    // ----------------------------------------------------

    // console.log({
    //   porter: owner.address,
    //   auctioneer: auctioneerSigner.address,
    //   [`bidders(${bidders.length})`]: bidders.map((b) => b.address),
    //   collateralTokenAddress: collateralToken.address,
    //   biddingTokenAddress: biddingToken.address,
    //   brokerAddress: broker.address,
    //   gnosisAuctionAddress: GNOSIS_AUCTION_ADDRESS.mainnet,
    // });

    // ----------------------------------------------------
    //                                                    |
    // console.log("e2e/set up collateral"); //           |
    //                                                    |
    // ----------------------------------------------------
    // from auctioneerSigner, approve the value of collateral to the broker contract
    await collateralToken
      .connect(auctioneerSigner)
      .increaseAllowance(broker.address, collateralData.collateralAmount);
    expect(await collateralToken.balanceOf(auctioneerSigner.address)).to.be.eq(
      ethers.utils.parseEther("100")
    );
    const depositCollateralTx = await broker
      .connect(auctioneerSigner)
      .depositCollateral(collateralData);

    expect(depositCollateralTx, "Collateral deposited")
      .to.emit(broker, "CollateralDeposited")
      .withArgs(
        auctioneerSigner.address,
        collateralToken.address,
        collateralData.collateralAmount
      );

    const auctionData: AuctionData = {
      _biddingToken: biddingToken.address,
      orderCancellationEndDate: addDaysToNow(1),
      auctionEndDate: addDaysToNow(2),
      _auctionedSellAmount: ethers.utils.parseEther("100"),
      _minBuyAmount: ethers.utils.parseEther("1"),
      minimumBiddingAmountPerOrder: ethers.utils.parseEther(".01"),
      minFundingThreshold: ethers.utils.parseEther("30"),
      isAtomicClosureAllowed: false,
      accessManagerContract: ethers.constants.AddressZero,
      accessManagerContractData: ethers.utils.arrayify("0x00"),
    };
    ({ auctionId } = await createAuction(
      auctionData,
      auctioneerSigner,
      biddingToken,
      collateralData,
      broker
    ));

    // Give tokens from owner to bidders and approve for transfer to gnosis auction
    await createTokensAndMintAndApprove(
      gnosisAuction,
      biddingToken,
      owner,
      bidders
    );
    ({ userId: initialUserId } = await getEventArgumentsFromTransaction(
      await gnosisAuction.getUserId(bidders[0].address),
      "NewUser"
    ));
  });
  xit("places orders case 1", async () => {
    const sellOrders = [
      {
        sellAmount: ethers.utils.parseEther("50"),
        buyAmount: ethers.utils.parseEther("1"),
        userId: BigNumber.from(initialUserId),
      },
    ];
    await placeOrders(
      gnosisAuction,
      sellOrders,
      BigNumber.from(auctionId),
      bidders
    );
    await closeAuction(gnosisAuction, BigNumber.from(auctionId));
    await gnosisAuction.settleAuction(auctionId);
    console.log(await gnosisAuction.auctionData(auctionId));
    const clearingOrder = (await gnosisAuction.auctionData(auctionId))
      .clearingPriceOrder;
    expect(clearingOrder).to.be.eq(encodeOrder(sellOrders[0]));
  });
  it("places orders case 2", async () => {
    const sellOrders = [
      {
        sellAmount: ethers.utils.parseEther("50"),
        buyAmount: ethers.utils.parseEther("1"),
        userId: BigNumber.from(initialUserId),
      },
    ];
    await placeOrders(
      gnosisAuction,
      sellOrders,
      BigNumber.from(auctionId),
      bidders
    );

    await closeAuction(gnosisAuction, BigNumber.from(auctionId));
    await gnosisAuction.settleAuction(auctionId);
    const clearingOrder = (await gnosisAuction.auctionData(auctionId))
      .clearingPriceOrder;
    expect(clearingOrder).to.be.eq(
      encodeOrder({
        userId: BigNumber.from(0),
        buyAmount: ethers.utils.parseEther("100"),
        sellAmount: ethers.utils.parseEther("50"),
      })
    );
  });
});
