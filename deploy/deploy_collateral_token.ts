import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenDeploymentArguments } from "../test/interfaces";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
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
  await deploy("CollateralToken", {
    contract: "TestERC20",
    from: deployer,
    log: true,
    autoMine: true,
    args: [
      tokenDeploymentArguments.name,
      tokenDeploymentArguments.symbol,
      tokenDeploymentArguments.mintAmount,
      tokenDeploymentArguments.decimals,
    ],
  });
};

module.exports.tags = ["test-deployment", "token"];
