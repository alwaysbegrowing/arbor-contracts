import { HardhatRuntimeEnvironment } from "hardhat/types";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("BondFactory", {
    from: deployer,
    log: true,
    autoMine: true,
  });
};

module.exports.tags = ["main-deployment", "factory", "test-deployment"];
