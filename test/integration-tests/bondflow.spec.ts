import { ethers } from "hardhat";
import { deployNATIVEandBORROW, createBond } from "../setup";
import { BondFactoryClone } from "../../typechain";

describe("Integration", () => {
  it("creates erc20 tokens and bonds", async () => {
    const { native, borrow } = await deployNATIVEandBORROW();

    // const hardcodedFactory = "0xFfB5F7195B89Df83f9aCDE20103436d83E6ad348"
    // const factory = await ethers.getContractAt("BondFactoryClone", hardcodedFactory) as BondFactoryClone

    const BondFactoryClone = await ethers.getContractFactory(
      "BondFactoryClone"
    );
    const factory = await BondFactoryClone.deploy();

    await createBond(factory as BondFactoryClone, native, borrow);
  });
});
