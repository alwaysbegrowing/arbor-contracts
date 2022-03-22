import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BondFactory, Bond } from "../../typechain";
import {
  deployNativeAndPayment,
  createBond,
  mint,
  initiateAuction,
} from "../setup";
const easyAuction = require("../../contracts/external/EasyAuction");

const { RINKEBY_DEPLOYER_ADDRESS } = process.env;
const rinkebyFactory = "0xa148c9A96AE2c987AF86eC170e75719cf4CEa937";
const rinkebyGnosis = "0xC5992c0e0A3267C7F75493D0F717201E26BE35f7";
describe("Integration", () => {
  if (!RINKEBY_DEPLOYER_ADDRESS)
    throw new Error("{RINKEBY_DEPLOYER_ADDRESS} env variable is required");
  it("should create erc20 tokens and bonds", async () => {
    if (network.name === "hardhat") {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [RINKEBY_DEPLOYER_ADDRESS],
      });
    }
    const signer = await ethers.getSigner(RINKEBY_DEPLOYER_ADDRESS);
    const [native, payment] = await deployNativeAndPayment(signer);
    console.log({ native: native.address, payment: payment.address });

    const factory = (await ethers.getContractAt(
      "BondFactory",
      rinkebyFactory
    )) as BondFactory;

    const bond = (await createBond(signer, native, payment, factory)) as Bond;

    console.log({ bond: bond.address });

    await mint(signer, native, bond);
    console.log("minted");

    const auction = await ethers.getContractAt(easyAuction.abi, rinkebyGnosis);

    await expect(await initiateAuction(auction, signer, bond, payment)).to.emit(
      auction,
      "NewAuction"
    );
  });
});
