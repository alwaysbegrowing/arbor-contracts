import { BigNumber, utils } from "ethers";

// 3 years from now, in seconds
export const THREE_YEARS_FROM_NOW = Math.round(
  new Date(new Date().setFullYear(new Date().getFullYear() + 3)).getTime() /
    1000
);

export const ONE = utils.parseUnits("1", 18);
export const ZERO = BigNumber.from(0);
export const FIFTY_MILLION = "50000000";
