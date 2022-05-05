import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deploymentBonds, TWENTY_FIVE_MILLION } from "../test/constants";
import { Bond, TestERC20 } from "../typechain";
import { BondConfigType } from "../test/interfaces";
import { BigNumber, ContractTransaction } from "ethers";
import { getBondInfo, waitUntilMined } from "../test/utilities";

module.exports = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { get } = deployments;
  const { deployer } = await getNamedAccounts();
  const { address: paymentTokenAddress } = await get("PaymentToken");
  const { address: collateralTokenAddress } = await get("CollateralToken");
  const paymentToken = (await ethers.getContractAt(
    "TestERC20",
    paymentTokenAddress
  )) as TestERC20;
  const collateralToken = (await ethers.getContractAt(
    "TestERC20",
    collateralTokenAddress
  )) as TestERC20;

  for (let i = 0; i < deploymentBonds.length; i++) {
    const { bondConfig } = deploymentBonds[i];
    const { bondSymbol } = await getBondInfo(
      paymentToken,
      collateralToken,
      bondConfig
    );
    const { address } = await deployments.get(bondSymbol);
    const bond = (await ethers.getContractAt("Bond", address)) as Bond;
    console.log(`
---------------------
Executing bond actions.
  bondSymbol: ${bondSymbol}
  address: ${address}
`);
    const actions = [
      {
        actionName: "approve payment",
        action: () =>
          paymentToken.approve(bond.address, ethers.constants.MaxUint256),
        conditions: [
          async () => (await paymentToken.balanceOf(bond.address)).eq(0),
        ],
      },
      {
        actionName: "pay",
        action: () =>
          // some bonds will be fully paid with TWENTY_FIVE_MILLION
          bond.pay(ethers.utils.parseUnits(TWENTY_FIVE_MILLION.toString(), 6)),
        conditions: [async () => (await bond.amountUnpaid()).gt(0)],
      },
      {
        actionName: "convert",
        action: () => bond.convert(bondConfig.maxSupply.div(4)),
        conditions: [
          async () => (await bond.previewConvertBeforeMaturity(1)).gt(0),
        ],
      },
      {
        actionName: "redeem",
        action: () => bond.redeem(1),
        conditions: [async () => await bond.isMature()],
      },
      {
        actionName: "withdraw excess collateral",
        action: () =>
          bond.withdrawExcessCollateral(BigNumber.from(0), deployer),
        conditions: [
          async () => (await bond.previewWithdrawExcessCollateral()).gt(0),
        ],
      },
      {
        actionName: "withdraw excess payment",
        action: () => bond.withdrawExcessPayment(deployer),
        conditions: [
          async () => (await bond.previewWithdrawExcessPayment()).gt(0),
        ],
      },
    ];

    for (let j = 0; j < actions.length; j++) {
      const {
        actionName,
        action,
        conditions,
      }: {
        actionName: string;
        action: () => Promise<ContractTransaction>;
        conditions: (() => Promise<boolean>)[];
      } = actions[j];
      try {
        let executeAction = true;
        for (let k = 0; k < conditions.length; k++) {
          if (!(await conditions[k]())) {
            executeAction = false;
          }
        }
        if (executeAction) {
          await waitUntilMined(await action());
          console.log(`✅${actionName}: executed on ${bond.address}.`);
        } else {
          console.log(`🚷${actionName}: skipped - conditions not met.`);
        }
      } catch (error) {
        console.log(error);
        console.log(`${actionName} failure!`);
      }
    }
    console.log(`
Bond actions complete
amount unpaid: ${await bond.amountUnpaid()}
deployer bond shares: ${await bond.balanceOf(deployer)}
deployer collateral token: ${await collateralToken.balanceOf(deployer)}
deployer payment token: ${await paymentToken.balanceOf(deployer)}
---------------------
`);
  }
};

module.exports.tags = ["actions"];
module.exports.dependencies = ["bonds"];
