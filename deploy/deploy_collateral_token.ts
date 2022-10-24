import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenDeploymentArguments } from "../test/interfaces";
import { waitUntilMined } from "../test/utilities";
import { TestERC20 } from "../typechain";

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
    waitConfirmations: 1,
    args: [
      tokenDeploymentArguments.name,
      tokenDeploymentArguments.symbol,
      tokenDeploymentArguments.mintAmount,
      tokenDeploymentArguments.decimals,
    ],
  });

  const collateralToken = (await ethers.getContractAt(
    "TestERC20",
    address
  )) as TestERC20;

  if (process.env.DEPLOYMENT_BENEFICIARIES) {
    const beneficiaries = process.env.DEPLOYMENT_BENEFICIARIES.split(",");
    for (const beneficiary of beneficiaries) {
      if ((await collateralToken.balanceOf(beneficiary)).gt(0)) {
        continue;
      }
      console.log(`Transferring collateral tokens to ${beneficiary}.`);
      await waitUntilMined(
        await collateralToken.transfer(
          beneficiary,
          ethers.utils.parseUnits((500_000).toString(), DECIMALS)
        )
      );
    }
  }
  try {
    await run("verify:verify", { address, constructorArguments: args });
  } catch (error) {
    console.log("TestERC20 already verified?");
  }
};

module.exports.tags = ["test-deployment", "token"];
