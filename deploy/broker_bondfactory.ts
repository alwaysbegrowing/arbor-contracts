import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
  rinkeby: "0xc5992c0e0a3267c7f75493d0f717201e26be35f7",
};
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const factory = await deploy("BondFactoryClone", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  const auctionAddress = GNOSIS_AUCTION_ADDRESS.rinkeby;
  const factoryAddress = factory.address;
  await deploy("Broker", {
    from: deployer,
    args: [auctionAddress, factoryAddress],
    log: true,
    autoMine: true,
  });
};

export default func;
