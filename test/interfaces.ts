import { BigNumber, BigNumberish } from "ethers";

export type BondConfigType = {
  targetBondSupply: BigNumber;
  collateralToken: string;
  collateralRatio: BigNumber;
  convertibilityRatio: BigNumber;
  maturityDate: BigNumberish;
};
