import { BigNumber, BigNumberish } from "ethers";

export type BondConfigType = {
  targetBondSupply: BigNumber;
  collateralRatio: BigNumber;
  convertibleRatio: BigNumber;
  maturityDate: BigNumberish;
  maxSupply: BigNumber;
};
