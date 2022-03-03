import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
const GNOSIS_AUCTION_ADDRESS = {
  mainnet: "0x0b7ffc1f4ad541a4ed16b40d8c37f0929158d101",
  rinkeby: "0xc5992c0e0a3267c7f75493d0f717201e26be35f7",
};
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, tenderly } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const factory = await deploy("BondFactoryClone", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  const auctionAddress = GNOSIS_AUCTION_ADDRESS.mainnet;
  const factoryAddress = factory.address;
  const broker = await deploy("Broker", {
    from: deployer,
    args: [auctionAddress, factoryAddress],
    log: true,
    autoMine: true,
  });

  // "push" to the porter project or "verify" to a public etherscan-like interface
  await tenderly.push([
    {
      name: "BondFactoryClone",
      address: factory.address,
    },
    { name: "Broker", address: broker.address },
  ]);
};

export default func;
