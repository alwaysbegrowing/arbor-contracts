import { BigNumber, utils } from "ethers";
import { BondConfigType, BondDeploymentConfiguration } from "./interfaces";

export const GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 days * 24 hours * 60 minutes * 60 seconds

export const TEN_MINUTES_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setMinutes(new Date().getMinutes() + 10)).getTime() / 1000
);
export const ONE_DAY_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setHours(new Date().getHours() + 24)).getTime() / 1000
);
export const ONE_MONTH_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setMonth(new Date().getMonth() + 1)).getTime() / 1000
);
export const ONE_YEAR_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 1)).getTime() /
    1000
);
export const TWO_YEARS_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 2)).getTime() /
    1000
);
export const THREE_YEARS_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);
export const ELEVEN_YEARS_FROM_NOW_IN_SECONDS = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 11)).getTime() /
    1000
);

export const ONE = utils.parseUnits("1", 18);
export const WAD = utils.parseUnits("1", 18);
export const SQRT_MAX_UINT256 = BigNumber.from(
  "340282366920938463463374607431768211456"
);
export const ZERO = BigNumber.from(0);
export const FIFTY_MILLION = 50000000;
export const TWENTY_FIVE_MILLION = (25000000).toString();
export const TWO_AND_A_HALF_MILLION = (2500000).toString();
export const TEN_MILLION = (10000000).toString();
// The config objects are used as anchors to test against

export const NonConvertibleBondConfig = (decimals: number): BondConfigType => ({
  collateralTokenAmount: utils.parseUnits((10_000_000).toString(), decimals),
  convertibleTokenAmount: ZERO,
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits((50_000_000).toString(), decimals),
});

export const ConvertibleBondConfig = (decimals: number): BondConfigType => ({
  collateralTokenAmount: utils.parseUnits((50_000_000).toString(), decimals),
  convertibleTokenAmount: utils.parseUnits((25_000_000).toString(), decimals),
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits((50_000_000).toString(), decimals),
});

export const UncollateralizedBondConfig = (
  decimals: number
): BondConfigType => ({
  collateralTokenAmount: ZERO,
  convertibleTokenAmount: ZERO,
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits((50_000_000).toString(), decimals),
});

export const MaliciousBondConfig = (decimals: number): BondConfigType => ({
  collateralTokenAmount: utils.parseUnits((50_000_000).toString(), decimals),
  convertibleTokenAmount: utils.parseUnits((20_000_000).toString(), decimals),
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits((50_000_000).toString(), decimals),
});

const SHORT_MATURITY_NON_CONVERTIBLE: BondDeploymentConfiguration = {
  // This bond has a short maturity and a full FIFTY_MILLION
  // Since we pay TWENTY_FIVE_MILLION, this bond will "Default"
  bondConfig: {
    ...NonConvertibleBondConfig(6),
    maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
    maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
  },
  auctionConfig: {
    minFundingThreshold: utils.parseUnits(TWENTY_FIVE_MILLION, 6),
  },
  biddingConfig: {},
};

const SHORT_MATURITY_CONVERTIBLE: BondDeploymentConfiguration = {
  // This will be an "Active" convertible bond
  bondConfig: {
    ...ConvertibleBondConfig(6),
    maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
    maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
  },
  auctionConfig: {},
  biddingConfig: {},
};

const SHORT_MATURITY_UNCOLLATERALIZED_SHORT_ORDER_CANCELLATION: BondDeploymentConfiguration =
  {
    // This will be an "Active" Un-Collateralized bond
    bondConfig: {
      ...UncollateralizedBondConfig(6),
      maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
    },
    auctionConfig: {
      // Whose auction will not be cancellable
      orderCancellationEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
    },
    biddingConfig: {
      sellAmount: (9_000).toString(),
      minBuyAmount: (10_000).toString(),
    },
  };

const LONG_MATURITY_NON_CONVERTIBLE_SHORT_AUCTION_END: BondDeploymentConfiguration =
  {
    // This will be an "Active" Non-Convertible bond
    bondConfig: {
      ...NonConvertibleBondConfig(6),
      maturity: ONE_YEAR_FROM_NOW_IN_SECONDS,
      maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
    },
    auctionConfig: {
      // Whose auction will be ended
      auctionEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      orderCancellationEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      minFundingThreshold: ZERO,
    },
    biddingConfig: {
      sellAmount: (18_000).toString(),
      minBuyAmount: (20_000).toString(),
    },
  };

const LONG_MATURITY_NON_CONVERTIBLE_SHORT_AUCTION_END_TWO_YEARS: BondDeploymentConfiguration =
  {
    // This will be an "Active" Non-Convertible bond
    bondConfig: {
      ...NonConvertibleBondConfig(6),
      maturity: TWO_YEARS_FROM_NOW_IN_SECONDS,
      maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
    },
    auctionConfig: {
      // Whose auction will be ended
      auctionEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      orderCancellationEndDate: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      minFundingThreshold: ZERO,
    },
    biddingConfig: {
      sellAmount: (18_000).toString(),
      minBuyAmount: (20_000).toString(),
    },
  };

const LONG_MATURITY_CONVERTIBLE: BondDeploymentConfiguration = {
  // This will be a "Paid" convertible bond
  bondConfig: {
    ...ConvertibleBondConfig(6),
    // Make bond mature
    maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
    // Make bond paid off (we are paying TWENTY_FIVE_MILLION in deploy)
    maxSupply: utils.parseUnits(TWENTY_FIVE_MILLION.toString(), 6),
  },
  auctionConfig: {},
  biddingConfig: {
    sellAmount: (90_000).toString(),
    minBuyAmount: (100_000).toString(),
  },
};

const LONG_MATURITY_CONVERTIBLE_LONG_AUCTION_CANCELLATION = {
  // This will be a "PaidEarly" Convertible bond
  bondConfig: {
    ...ConvertibleBondConfig(18),
    maturity: ONE_YEAR_FROM_NOW_IN_SECONDS,
    // Make bond paid off (we are paying TWENTY_FIVE_MILLION in deploy)
  },
  auctionConfig: {
    // Whose auction will be ongoing
    auctionEndDate: ONE_MONTH_FROM_NOW_IN_SECONDS,
    orderCancellationEndDate: ONE_MONTH_FROM_NOW_IN_SECONDS,
  },
  biddingConfig: {
    sellAmount: (900_000).toString(),
    minBuyAmount: (1_000_000).toString(),
  },
};

const LONG_MATURITY_CONVERTIBLE_PAID_EARLY_LONG_AUCTION_CANCELLATION = {
  // This will be a "PaidEarly" Convertible bond
  bondConfig: {
    ...ConvertibleBondConfig(6),
    maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
    // Make bond paid off (we are paying TWENTY_FIVE_MILLION in deploy)
    maxSupply: utils.parseUnits(TWENTY_FIVE_MILLION.toString(), 6),
  },
  auctionConfig: {
    // Whose auction will be ongoing
    auctionEndDate: ONE_MONTH_FROM_NOW_IN_SECONDS,
    orderCancellationEndDate: ONE_MONTH_FROM_NOW_IN_SECONDS,
  },
  biddingConfig: {
    sellAmount: (900_000).toString(),
    minBuyAmount: (1_000_000).toString(),
  },
};

export const deploymentBonds: BondDeploymentConfiguration[] = [
  LONG_MATURITY_NON_CONVERTIBLE_SHORT_AUCTION_END,
  LONG_MATURITY_NON_CONVERTIBLE_SHORT_AUCTION_END_TWO_YEARS,
];

const easyAuction = require("../contracts/external/EasyAuction");
export const easyAuctionAbi = easyAuction.abi as any[];
export const rinkebyGnosis = "0xC5992c0e0A3267C7F75493D0F717201E26BE35f7";
export const mumbaiGnosis = "0xbfd4F9cBC5D043E65f4C1f976E3c1d37AD92dc72";
