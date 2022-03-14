import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, tenderly } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const factory = await deploy("BondFactoryClone", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  // "push" to the porter project or "verify" to a public etherscan-like interface
  // await tenderly.push([
  //   {
  //     name: "BondFactoryClone",
  //     address: factory.address,
  //   },
  // ]);
};

export default func;
