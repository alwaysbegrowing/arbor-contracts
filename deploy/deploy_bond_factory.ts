import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BondFactory } from "../typechain";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const { address } = await deploy("BondFactory", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  const factory = (await ethers.getContractAt(
    "BondFactory",
    address
  )) as BondFactory;
};

module.exports.tags = ["main-deployment", "factory", "test-deployment"];
