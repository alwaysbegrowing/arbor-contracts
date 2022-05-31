import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const { address } = await deploy("BondFactory", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  if (network.live) {
    // Verify the factory contract
    await run("verify:verify", {
      address,
    });

    // Verify the bond implementation contract
    const factory = await ethers.getContractAt("BondFactory", address);
    const tokenImplementation = await factory.tokenImplementation();
    await run("verify:verify", { address: tokenImplementation });
  }
};

module.exports.tags = ["main-deployment", "factory", "test-deployment"];
