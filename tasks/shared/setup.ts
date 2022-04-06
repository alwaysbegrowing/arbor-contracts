import {
  Contract,
  utils,
  constants,
  ContractFactory,
  ContractTransaction,
  Event,
} from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestERC20, BondFactory, Bond } from "../../typechain";
import { ConvertibleBondConfig } from "../../test/constants";

export const deployNativeAndPayment = async (
  owner: SignerWithAddress,
  MockErc20Contract: ContractFactory
) => {
  const native = (await MockErc20Contract.connect(owner).deploy(
    "Native Token",
    "NATIVE",
    utils.parseUnits("50000000", 20),
    18
  )) as TestERC20;

  const pay = (await MockErc20Contract.connect(owner).deploy(
    "Payment Token",
    "PAY",
    utils.parseUnits("500"),
    18
  )) as TestERC20;

  return await Promise.all([native.deployed(), pay.deployed()]);
};

/*
  This function is copied from the one in utils because
  we need to pass in the getContractAt due to hardhat limitations
  importing their injected ethers variables during tasks execution
*/
export const createBond = async (
  owner: SignerWithAddress,
  getContractAt: Function,
  nativeToken: TestERC20,
  paymentToken: TestERC20,
  factory: BondFactory
) => {
  // these could be converted to parameters
  const bondName = "Always be growing";
  const bondSymbol = "LEARN";

  const issuerRole = await factory.ISSUER_ROLE();
  const grantRoleTx = await factory
    .connect(owner)
    .grantRole(issuerRole, owner.address);
  await grantRoleTx.wait();

  const approveTokens = await nativeToken
    .connect(owner)
    .approve(factory.address, constants.MaxInt256);
  await approveTokens.wait();

  const bond = await getBondContract(
    getContractAt,
    owner,
    factory
      .connect(owner)
      .createBond(
        bondName,
        bondSymbol,
        ConvertibleBondConfig.maturityDate,
        paymentToken.address,
        nativeToken.address,
        ConvertibleBondConfig.collateralTokenAmount,
        ConvertibleBondConfig.convertibleTokenAmount,
        ConvertibleBondConfig.maxSupply
      )
  );
  return await bond;
};

export const initiateAuction = async (
  auction: Contract,
  owner: SignerWithAddress,
  bond: Bond,
  borrowToken: TestERC20
) => {
  const auctioningToken = bond.address;
  const biddingToken = borrowToken.address;
  const orderCancellationEndDate = 0;
  // one day from today
  const auctionEndDate = Math.round(
    new Date(new Date().setDate(new Date().getDate() + 1)).getTime() / 1000
  );
  const tokenBalance = await bond.balanceOf(owner.address);
  const _auctionedSellAmount = tokenBalance.div(10);
  const _minBuyAmount = 1000000000000000;
  const minimumBiddingAmountPerOrder = 1000000000000000;
  const minFundingThreshold = 0;
  const isAtomicClosureAllowed = false;
  const accessManagerContract = constants.AddressZero;
  const accessManagerContractData = constants.HashZero;
  const approveTx = await bond
    .connect(owner)
    .approve(auction.address, constants.MaxUint256);
  await approveTx.wait();

  const initiateAuctionTx = await auction
    .connect(owner)
    .initiateAuction(
      auctioningToken,
      biddingToken,
      orderCancellationEndDate,
      auctionEndDate,
      _auctionedSellAmount,
      _minBuyAmount,
      minimumBiddingAmountPerOrder,
      minFundingThreshold,
      isAtomicClosureAllowed,
      accessManagerContract,
      accessManagerContractData
    );
  return initiateAuctionTx;
};

const getBondContract = async (
  getContractAt: Function,
  signer: SignerWithAddress,
  tx: Promise<any>
): Promise<Bond> => {
  const [newBondAddress] = await getEventArgumentsFromTransaction(
    await tx,
    "BondCreated"
  );

  return (await getContractAt("Bond", newBondAddress, signer)) as Bond;
};

async function getEventArgumentsFromTransaction(
  tx: ContractTransaction,
  eventName: string
): Promise<any> {
  const receipt = await tx.wait();
  const args = receipt?.events?.find((e: Event) => e.event === eventName)?.args;
  if (args) return args;
  console.error(`No event with name ${eventName} found in transaction`);
  return {};
}
