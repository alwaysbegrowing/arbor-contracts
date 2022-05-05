import { BigNumber, BigNumberish, BytesLike, Contract } from "ethers";
import { Bond, TestERC20 } from "../typechain";

export type BondConfigType = {
  convertibleTokenAmount: BigNumber;
  collateralTokenAmount: BigNumber;
  maturity: BigNumberish;
  maxSupply: BigNumber;
};

export type BondWithTokens = {
  decimals: number;
  nonConvertible: {
    bond: Bond;
    config: BondConfigType;
  };
  convertible: {
    bond: Bond;
    config: BondConfigType;
  };
  uncollateralized: {
    bond: Bond;
    config: BondConfigType;
  };
  malicious: {
    bond: Bond;
    config: BondConfigType;
  };
  attackingToken: TestERC20;
  paymentToken: TestERC20;
  collateralToken: TestERC20;
};

export type TokenDeploymentArguments = {
  name: string;
  symbol: string;
  mintAmount: BigNumber;
  decimals: number;
};

export interface InitiateAuctionParameters {
  auctioningToken?: Contract;
  biddingToken?: Contract;
  orderCancellationEndDate?: BigNumberish;
  auctionEndDate?: BigNumberish;
  auctionedSellAmount?: BigNumberish;
  minBuyAmount?: BigNumberish;
  minimumBiddingAmountPerOrder?: BigNumberish;
  minFundingThreshold?: BigNumberish;
  isAtomicClosureAllowed?: boolean;
  allowListManager?: BytesLike;
  allowListData?: BytesLike;
}

export interface AuctionBid {
  sellAmount?: string;
  minBuyAmount?: string;
  nrOfOrders?: number;
}

export interface BondDeploymentConfiguration {
  bondConfig: BondConfigType;
  auctionConfig: InitiateAuctionParameters;
  biddingConfig: AuctionBid;
}
