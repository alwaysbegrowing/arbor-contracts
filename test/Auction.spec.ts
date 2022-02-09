// import { BigNumber } from "ethers";

// import { ethers } from "hardhat";
// import "@nomiclabs/hardhat-ethers";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import {
//   closeAuction,
//   CollateralData,
//   createAuctionWithDefaults,
//   createTokensAndMintAndApprove,
//   encodeOrder,
//   placeOrders,
// } from "./utilities";
// import { expect } from "chai";
// import {
//   PorterBond as PorterBondType,
//   CollateralToken as CollateralTokenType,
//   Broker as BrokerType,
//   EasyAuction as GnosisAuctionType,
//   BiddingToken as BiddingTokenType,
//   Broker,
// } from "../typechain";
// import { loadFixture } from "ethereum-waffle";

// describe("Auction", async () => {
//   // default deployer address of contracts
//   let porterSigner: SignerWithAddress;
//   // address of the example DAO which configures and runs the auction
//   let auctioneerSigner: SignerWithAddress;
//   // addresses of the bidders
//   let bidders: SignerWithAddress[];
//   let broker: BrokerType;
//   let gnosisAuction: GnosisAuctionType;
//   let biddingToken: BiddingTokenType;
//   let collateralToken: CollateralTokenType;
//   let porterBond: PorterBondType;
//   async function fixture() {
//     [porterSigner, auctioneerSigner, ...bidders] = await ethers.getSigners();

//     const BiddingToken = await ethers.getContractFactory("BiddingToken");
//     biddingToken = (await BiddingToken.deploy(
//       "Bidding Token",
//       "BT",
//       ethers.utils.parseEther("10000")
//     )) as BiddingTokenType;

//     // Mint 100 ether of tokens of collateral for auctioneerSigner
//     const CollateralToken = await ethers.getContractFactory("CollateralToken");
//     collateralToken = (await CollateralToken.connect(auctioneerSigner).deploy(
//       "Collateral Token",
//       "CT",
//       ethers.utils.parseEther("100")
//     )) as CollateralTokenType;

//     // The tokens minted here do not matter. The Porter Auction will mint the porterBond
//     const PorterBond = await ethers.getContractFactory("PorterBond");
//     porterBond = (await PorterBond.connect(porterSigner).deploy(
//       "Bond Token",
//       "BT",
//       ethers.utils.parseEther("100")
//     )) as PorterBondType;

//     const GnosisAuction = await ethers.getContractFactory("EasyAuction");
//     gnosisAuction = (await GnosisAuction.deploy()) as GnosisAuctionType;

//     const Broker = await ethers.getContractFactory("Broker");
//     broker = (await Broker.deploy(
//       "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101"
//     )) as BrokerType;
//     return {
//       porterBond,
//       collateralToken,
//       biddingToken,
//       broker,
//       gnosisAuction,
//       porterSigner,
//       auctioneerSigner,
//       bidders,
//     };
//   }
//   beforeEach(async () => {
//     ({
//       porterBond,
//       collateralToken,
//       biddingToken,
//       broker,
//       gnosisAuction,
//       porterSigner,
//       auctioneerSigner,
//       bidders,
//     } = await loadFixture(fixture));
//   });
//   xdescribe("t", async () => {
//     it("dose a think", async () => {
//       console.log(
//         await gnosisAuction
//           .attach("0x0b7fFc1f4AD541A4Ed16b40D8c37f0929158D101")
//           .auctionCounter()
//       );
//     });
//   });
// });
