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
    waitConfirmations: 1,
  });

  if (network.live && network.name !== "rinkeby") {
    // Verify the factory contract
    try {
      await run("verify:verify", {
        address,
      });
    } catch (error) {
      console.log("Already verified BondFactory?");
    }

    // Verify the bond implementation contract
    const factory = await ethers.getContractAt("BondFactory", address);
    const tokenImplementation = await factory.tokenImplementation();
    try {
      await run("verify:verify", { address: tokenImplementation });
    } catch (error) {
      console.log("Already verified Bond Implementation?");
    }
  }
};

module.exports.tags = ["main-deployment", "factory", "test-deployment"];
