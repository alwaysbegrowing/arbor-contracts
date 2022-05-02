import { HardhatRuntimeEnvironment } from "hardhat/types";
import { waitUntilMined } from "../test/utilities";
import { BondFactory, TestERC20 } from "../typechain";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { address: bondFactoryAddress } = await deployments.get("BondFactory");
  const { address: collateralTokenAddress } = await deployments.get(
    "CollateralToken"
  );
  const factory = (await ethers.getContractAt(
    "BondFactory",
    bondFactoryAddress
  )) as BondFactory;
  (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;
  const tokenRole = await factory.ALLOWED_TOKEN();
  if (await factory.hasRole(tokenRole, collateralTokenAddress)) {
    console.log(
      `Collateral token (${collateralTokenAddress}) already approved for ${tokenRole}. Skipping.`
    );
  } else {
    await waitUntilMined(
      await factory.grantRole(tokenRole, collateralTokenAddress)
    );
    console.log(
      `Token Role (${tokenRole}) granted to ${collateralTokenAddress}.`
    );
  }
};

module.exports.tags = ["permissions"];
module.exports.dependencies = ["factory", "token"];
