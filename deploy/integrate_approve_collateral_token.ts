import { HardhatRuntimeEnvironment } from "hardhat/types";
import { waitUntilMined } from "../test/utilities";
import { TestERC20 } from "../typechain";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();
  const { address: bondFactoryAddress } = await deployments.get("BondFactory");
  const { address: collateralTokenAddress } = await deployments.get(
    "CollateralToken"
  );
  const collateralToken = (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;
  if ((await collateralToken.allowance(deployer, bondFactoryAddress)).gt(0)) {
    console.log(
      `Collateral token for ${deployer} @ factory (${bondFactoryAddress}) already approved. Skipping.`
    );
  } else {
    await waitUntilMined(
      await collateralToken.approve(
        bondFactoryAddress,
        ethers.constants.MaxInt256
      )
    );
    console.log(
      `Approved collateral token for ${deployer} @ facotry (${bondFactoryAddress}) <-> token (${collateralTokenAddress}).`
    );
  }
};

module.exports.tags = ["permissions"];
module.exports.dependencies = ["factory", "token"];
