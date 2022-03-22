import { BigNumber, BigNumberish } from "ethers";
import { Bond, TestERC20 } from "../typechain";

export type BondConfigType = {
  targetBondSupply: BigNumber;
  collateralRatio: BigNumber;
  convertibleRatio: BigNumber;
  maturityDate: BigNumberish;
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
  attackingToken: TestERC20;
  paymentToken: TestERC20;
  collateralToken: TestERC20;
};
