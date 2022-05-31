import { network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenDeploymentArguments } from "../test/interfaces";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
  run,
}: HardhatRuntimeEnvironment) {
  const DECIMALS = 18;
  const tokenDeploymentArguments: TokenDeploymentArguments = {
    name: "Uniswap",
    symbol: "UNI",
    mintAmount: ethers.utils.parseUnits("50000000", DECIMALS + 2),
    decimals: DECIMALS,
  };

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const args = [
    tokenDeploymentArguments.name,
    tokenDeploymentArguments.symbol,
    tokenDeploymentArguments.mintAmount,
    tokenDeploymentArguments.decimals,
  ];
  const { address } = await deploy("CollateralToken", {
    contract: "TestERC20",
    from: deployer,
    log: true,
    autoMine: true,
    args,
  });

  if (network.live) {
    await run("verify:verify", { address, constructorArguments: args });
  }
};

module.exports.tags = ["test-deployment", "token"];
