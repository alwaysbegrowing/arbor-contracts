import { BigNumber, utils } from "ethers";
import { BondConfigType } from "./interfaces";

// 3 years from now, in seconds
export const THREE_YEARS_FROM_NOW = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);

export const ONE = utils.parseUnits("1", 18);
export const ZERO = BigNumber.from(0);
export const FIFTY_MILLION = "50000000";

// The config objects are used as anchors to test against
export const NonConvertibleBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibleRatio: ZERO,
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};

export const ConvertibleBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: utils.parseUnits("0.5", 18),
  convertibleRatio: utils.parseUnits("0.25", 18),
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};

export const UncollateralizedBondConfig: BondConfigType = {
  targetBondSupply: utils.parseUnits(FIFTY_MILLION, 18),
  collateralRatio: ZERO,
  convertibleRatio: ZERO,
  maturityDate: THREE_YEARS_FROM_NOW,
  maxSupply: utils.parseUnits(FIFTY_MILLION, 18),
};
