import { task } from "hardhat/config";
import { expect } from "chai";
import { BondFactory, Bond } from "../typechain";
import {
  deployNativeAndPayment,
  createBond,
  initiateAuction,
} from "./shared/setup";

const easyAuction = require("../contracts/external/EasyAuction");

const rinkebyGnosis = "0xC5992c0e0A3267C7F75493D0F717201E26BE35f7";
const rinkebyFactory = "0xD393916d00D7871434558624f87c2eC9a63fd48A";

task(
  "integration",
  "creates tokens, a bond, starts an auction, and verifies the contracts"
).setAction(async (_, { ethers, network, run, artifacts }) => {
  // executed on a live network (on rinkeby)
  const { RINKEBY_DEPLOYER_ADDRESS, ETHERSCAN_API_KEY } = process.env;

  if (!RINKEBY_DEPLOYER_ADDRESS)
    throw new Error("RINKEBY_DEPLOYER_ADDRESS env variable is required");

  await run("compile");

  if (network.name === "hardhat") {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
            blockNumber: 10453255,
            automine: true,
          },
        },
      ],
    });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [RINKEBY_DEPLOYER_ADDRESS],
    });
  }

  const signer = await ethers.getSigner(RINKEBY_DEPLOYER_ADDRESS);
  const mockErc20Contract = await ethers.getContractFactory("TestERC20");

  const [native, payment] = await deployNativeAndPayment(
    signer,
    mockErc20Contract
  );
  console.log("deployed tokens", {
    native: native.address,
    payment: payment.address,
  });

  const factory = (await ethers.getContractAt(
    "BondFactory",
    rinkebyFactory
  )) as BondFactory;
  const bond = (await createBond(
    signer,
    ethers.getContractAt,
    native,
    payment,
    factory
  )) as Bond;

  console.log("deployed bond", { bond: bond.address });

  expect(await bond.balanceOf(signer.address)).to.not.equal(0);
  const auction = await ethers.getContractAt(easyAuction.abi, rinkebyGnosis);

  await expect(initiateAuction(auction, signer, bond, payment)).to.emit(
    auction,
    "NewAuction"
  );

  if (network.live && ETHERSCAN_API_KEY) {
    const verifyContract = async (address: string) => {
      try {
        await run("verify:verify", { address });
      } catch (error: unknown) {
        console.log("error verifying contract, most likely already verified");
        console.log(error);
      }
    };
    await verifyContract(factory.address);

    const tokenImplementation = await factory.tokenImplementation();
    await verifyContract(tokenImplementation);
  }

  if (network.name === "hardhat") {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  }
});
