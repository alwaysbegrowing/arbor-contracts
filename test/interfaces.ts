import { BigNumber, BigNumberish } from "ethers";

export type BondConfigType = {
  targetBondSupply: BigNumber;
  collateralRatio: BigNumber;
  convertibilityRatio: BigNumber;
  maturityDate: BigNumberish;
  maxSupply: BigNumber;
};
