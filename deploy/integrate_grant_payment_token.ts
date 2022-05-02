import { HardhatRuntimeEnvironment } from "hardhat/types";
import { waitUntilMined } from "../test/utilities";
import { BondFactory, TestERC20 } from "../typechain";

module.exports = async function ({
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { address: bondFactoryAddress } = await deployments.get("BondFactory");
  const { address: paymentTokenAddress } = await deployments.get(
    "PaymentToken"
  );
  const factory = (await ethers.getContractAt(
    "BondFactory",
    bondFactoryAddress
  )) as BondFactory;
  (await ethers.getContractAt("TestERC20", paymentTokenAddress)) as TestERC20;
  const tokenRole = await factory.ALLOWED_TOKEN();
  if (await factory.hasRole(tokenRole, paymentTokenAddress)) {
    console.log(
      `Payment token (${paymentTokenAddress}) already approved for ${tokenRole}. Skipping.`
    );
  } else {
    await waitUntilMined(
      await factory.grantRole(tokenRole, paymentTokenAddress)
    );
    console.log(`Token Role (${tokenRole}) granted to ${paymentTokenAddress}.`);
  }
};

module.exports.tags = ["permissions"];
module.exports.dependencies = ["factory", "token"];
