import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Bond, BondFactory, TestERC20 } from "../typechain";
import { BondConfigType } from "../test/interfaces";
import { createBond, getBondInfo } from "../test/utilities";
import { deploymentBonds } from "../test/constants";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
  artifacts,
}: HardhatRuntimeEnvironment) {
  const { get } = deployments;

  const { deployer } = await getNamedAccounts();
  const { address } = await get("BondFactory");
  const factory = (await ethers.getContractAt(
    "BondFactory",
    address
  )) as BondFactory;

  const bondArtifact = await artifacts.readArtifact("Bond");

  const paymentTokenAddress = (await get("PaymentToken")).address;
  const paymentTokenContract = (await ethers.getContractAt(
    "TestERC20",
    paymentTokenAddress
  )) as TestERC20;
  const collateralTokenAddress = (await get("CollateralToken")).address;
  const collateralTokenContract = (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;

  for (let i = 0; i < deploymentBonds.length; i++) {
    const {
      config,
    }: {
      config: BondConfigType;
    } = deploymentBonds[i];
    let bondAddress: string;
    const { bondSymbol } = await getBondInfo(
      paymentTokenContract,
      collateralTokenContract,
      config
    );
    try {
      const foundBond = await get(bondSymbol);
      bondAddress = foundBond.address;
      const bond = (await ethers.getContractAt("Bond", bondAddress)) as Bond;
      if ((await bond.owner()) !== deployer) {
        throw new Error("Bond deployed with different owner.");
      }
      console.log(`${bondSymbol} found. Skipping.`);
    } catch (e) {
      console.log(`Could not find a bond ${bondSymbol}. Creating.`);
      const { address } = await createBond(
        config,
        factory,
        paymentTokenContract,
        collateralTokenContract
      );
      console.log(`Deployed a ${bondSymbol} bond @ (${address}).`);

      deployments.save(bondSymbol, {
        abi: bondArtifact.abi,
        address,
      });
    }
  }
};

module.exports.tags = ["bonds"];
module.exports.dependencies = ["permissions"];
