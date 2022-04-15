import { FallbackProvider } from "@ethersproject/providers";
import { BigNumber, utils } from "ethers";
import { BondConfigType } from "./interfaces";

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
const HALF_FIFTY_MILLION = (FIFTY_MILLION / 2).toString();
const QUARTER_FIFTY_MILLION = (FIFTY_MILLION / 4).toString();
// The config objects are used as anchors to test against
export const NonConvertibleBondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits(HALF_FIFTY_MILLION, 18),
  convertibleTokenAmount: ZERO,
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};

export const ConvertibleBondConfig: BondConfigType = {
  collateralTokenAmount: utils.parseUnits(HALF_FIFTY_MILLION, 18),
  convertibleTokenAmount: utils.parseUnits(QUARTER_FIFTY_MILLION, 18),
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
  collateralTokenAmount: utils.parseUnits(HALF_FIFTY_MILLION, 18),
  convertibleTokenAmount: utils.parseUnits(QUARTER_FIFTY_MILLION, 18),
  maturity: THREE_YEARS_FROM_NOW_IN_SECONDS,
  maxSupply: utils.parseUnits(FIFTY_MILLION.toString(), 18),
};
