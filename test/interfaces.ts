import { BigNumber, BigNumberish } from "ethers";
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
