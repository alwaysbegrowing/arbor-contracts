import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenDeploymentArguments } from "../test/interfaces";
import { waitUntilMined } from "../test/utilities";
import { TestERC20 } from "../typechain";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const DECIMALS = 6;
  const tokenDeploymentArguments: TokenDeploymentArguments = {
    name: "USD Coin",
    symbol: "USDC",
    mintAmount: ethers.utils.parseUnits("50000000", DECIMALS + 2),
    decimals: DECIMALS,
  };

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const { address } = await deploy("PaymentToken", {
    contract: "TestERC20",
    from: deployer,
    log: true,
    autoMine: true,
    waitConfirmations: 1,
    args: [
      tokenDeploymentArguments.name,
      tokenDeploymentArguments.symbol,
      tokenDeploymentArguments.mintAmount,
      tokenDeploymentArguments.decimals,
    ],
  });

  const paymentToken = (await ethers.getContractAt(
    "TestERC20",
    address
  )) as TestERC20;

  if (process.env.DEPLOYMENT_BENEFICIARIES) {
    console.log(`Transferring payment tokens to beneficiaries.`);

    const beneficiaries = process.env.DEPLOYMENT_BENEFICIARIES.split(",");
    for (const beneficiary of beneficiaries) {
      if ((await paymentToken.balanceOf(beneficiary)).gt(0)) {
        continue;
      }
      console.log(`Transferring payment tokens to ${beneficiary}.`);
      await waitUntilMined(
        await paymentToken.transfer(
          beneficiary,
          ethers.utils.parseUnits((500_000).toString(), DECIMALS)
        )
      );
    }
  }
};

module.exports.tags = ["test-deployment", "token"];
