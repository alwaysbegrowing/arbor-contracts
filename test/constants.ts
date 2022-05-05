import { BigNumber, utils } from "ethers";
import { BondConfigType, BondDeploymentConfiguration } from "./interfaces";

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

export const ZERO = BigNumber.from(0);
export const FIFTY_MILLION = 50000000;
export const TWENTY_FIVE_MILLION = (25000000).toString();
export const TWO_AND_A_HALF_MILLION = (2500000).toString();
export const TEN_MILLION = (10000000).toString();
// The config objects are used as anchors to test against

export const NonConvertibleBondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits(TEN_MILLION, 18),
  convertibleTokenAmount: ZERO,
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

export const ConvertibleBondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits(TEN_MILLION, 18),
  convertibleTokenAmount: utils.parseUnits(TWO_AND_A_HALF_MILLION, 18),
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

export const UncollateralizedBondConfig: BondConfigType = {
  collateralTokenAmount: ZERO,
  convertibleTokenAmount: ZERO,
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

export const MaliciousBondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits(TEN_MILLION, 18),
  convertibleTokenAmount: utils.parseUnits(TWO_AND_A_HALF_MILLION, 18),
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

export const deploymentBonds: BondDeploymentConfiguration[] = [
  {
    // This bond has a short maturity and a full FIFTY_MILLION
    // Since we pay TWENTY_FIVE_MILLION, this bond will "Default"
    bondConfig: {
      ...NonConvertibleBondConfig,
      maturity: TEN_MINUTES_FROM_NOW_IN_SECONDS,
      maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
    },
    auctionConfig: {
      minFundingThreshold: utils.parseUnits(TWENTY_FIVE_MILLION, 6),
    },
    biddingConfig: {},
  },
  {
    // This will be an "Active" convertible bond
    bondConfig: {
      ...ConvertibleBondConfig,
      maturity: ONE_DAY_FROM_NOW_IN_SECONDS,
      maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 6),
    },
    auctionConfig: {},
    biddingConfig: {},
  },
  {
    // This will be an "Active" Un-Collateralized bond
    bondConfig: {
      ...UncollateralizedBondConfig,
      maturity: ONE_MONTH_FROM_NOW_IN_SECONDS,
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
  },
  {
    // This will be an "Active" Non-Convertible bond
    bondConfig: {
      ...NonConvertibleBondConfig,
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
  },
  {
    // This will be a "Paid" convertible bond
    bondConfig: {
      ...ConvertibleBondConfig,
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
  },
  {
    // This will be a "PaidEarly" Non-Convertible bond
    bondConfig: {
      ...ConvertibleBondConfig,
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
  },
];

const easyAuction = require("../contracts/external/EasyAuction");
export const easyAuctionAbi = easyAuction.abi as any[];
export const rinkebyGnosis = "0xC5992c0e0A3267C7F75493D0F717201E26BE35f7";
export const mumbaiGnosis = "0xbfd4F9cBC5D043E65f4C1f976E3c1d37AD92dc72";
