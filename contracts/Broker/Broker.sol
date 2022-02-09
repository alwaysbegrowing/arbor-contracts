//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

// --- Import statements ---
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./PorterBond.sol";
import "./CollateralToken.sol";
import "./interfaces/IGnosisAuction.sol";
import "hardhat/console.sol";

// --- Interfaces ---
// --- Libraries ---

/// @title Porter auction wrapping Gnosis EasyAuction
/// @author Porter
/// @notice Single instance which maps to one EasyAuction
/// @notice Controlls the auction, collateral, and bond issuace
/// @dev This deviates from EasyAuction by not having an auctioning token until the auction is settling
contract Broker is Ownable, ReentrancyGuard {
  // --- Type Declarations ---
  struct BondData {
    address bondContract;
    uint256 maturityDate;
  }

  struct CollateralData {
    address collateralAddress;
    uint256 collateralAmount;
  }

  // --- State Variables ---
  IGnosisAuction public immutable gnosisAuction;

  /// TODO: need to associate the collateral to the bond. Make a bond contract
  /// @notice A mapping of stored collateral in the contract from depositCollateral
  /// @dev address the bond issuer storing the collateral
  /// @dev uint256 the address of the collateral token
  /// @dev uint256 the amount of that collateral token locked
  mapping(address => mapping(address => uint256)) public collateralInContract;

  /// @notice When an auction begins, the collateral is moved from collateralInContract into this mapping
  /// @dev uint256 auctionId is the id of the auction
  /// @dev address the address of the collateral
  /// @dev uint256 the amount of collateral
  mapping(uint256 => mapping(address => uint256)) public collateralInAuction;

  /// @notice The bond data for a specific auction
  /// @dev uint256 auctionId is the id of the auction
  /// @dev BondData the bond data
  mapping(uint256 => BondData) public auctionToBondData;

  // --- Events ---
  /// @notice A GnosisAuction is created with auction parameters
  /// @dev auctionId is returned from the auction contract
  /// @param creator the caller of the auction
  /// @param auctionId the id of the auction
  event AuctionCreated(
    address indexed creator,
    uint256 indexed auctionId,
    address porterBondAddress
  );

  /// @notice Collateral for an auctioneer is added to the porter auction contract
  /// @param collateralDepositor the address of the caller of the deposit
  /// @param collateralAddress the address of the token being deposited
  /// @param collateralAmount the number of the tokens being deposited
  event CollateralDeposited(
    address indexed collateralDepositor,
    address indexed collateralAddress,
    uint256 collateralAmount
  );

  /// @notice Collateral for an auctioneer is removed from the auction contract
  /// @param collateralRedeemer the address of the caller of the redemption
  /// @param collateralAddress the address of the token being redeemed
  /// @param collateralAmount the number of the tokens redeemed
  event CollateralRedeemed(
    address indexed collateralRedeemer,
    address indexed collateralAddress,
    uint256 collateralAmount
  );

  // --- Modifiers ---
  using SafeERC20 for IERC20;

  // --- Functions ---
  constructor(address gnosisAuctionAddress) public {
    console.log(
      "Auction constructor\n\tauction address: %s",
      gnosisAuctionAddress
    );
    gnosisAuction = IGnosisAuction(gnosisAuctionAddress);
  }

  /// @notice Transfer collateral from the caller to the auction. The collateral is stored in the auction.
  /// @dev The collateral is mapped from the msg.sender & address to the collateral value.
  /// @dev Required msg.sender to have adequate balance, and the transfer to be successful (returns true).
  /// @param collateralData is a struct containing the address of the collateral and the value of the collateral
  function depositCollateral(CollateralData memory collateralData) external {
    IERC20 collateralToken = CollateralToken(collateralData.collateralAddress);
    console.log(
      "Broker/depositCollateral\n\taddress: %s\n\tamount: %s",
      collateralData.collateralAddress,
      collateralData.collateralAmount
    );
    require(
      collateralToken.balanceOf(msg.sender) >= collateralData.collateralAmount,
      "depositCollateral/inadequate"
    );
    collateralToken.safeTransferFrom(
      msg.sender,
      address(this),
      collateralData.collateralAmount
    );
    // After a successul transfer, set the mapping of the sender of the collateral
    collateralInContract[msg.sender][
      collateralData.collateralAddress
    ] += collateralData.collateralAmount;

    emit CollateralDeposited(
      msg.sender,
      address(collateralToken),
      collateralData.collateralAmount
    );
  }

  /// @notice After a bond has matured AND the issuer has returned the auctioningToken, the issuer can redeem the collateral.
  /// @dev Required timestamp to be later than bond maturity timestamp.
  /// @dev Required bond to have been repaid.
  /// @param auctionId the ID of the auction containing the collateral
  /// @param collateralAddress the address of the collateral
  function redeemCollateralFromAuction(
    uint256 auctionId,
    address collateralAddress
  ) external {
    IERC20 collateralToken = CollateralToken(collateralAddress);

    uint256 collateralAmount = collateralInAuction[auctionId][
      collateralAddress
    ];
    console.log(
      "Broker/redeemCollateralFromAuction\n\tauctionId: %s\n\taddress: %s\n\tamount: %s",
      auctionId,
      collateralAddress,
      collateralAmount
    );
    BondData memory bondData = auctionToBondData[auctionId];
    console.log(
      "Broker/redeemCollateralFromAuction\n\tmaturitDate: %s",
      bondData.maturityDate
    );
    require(
      block.timestamp >= bondData.maturityDate,
      "redeemCollateralFromAuction/invalid"
    );
    // Set collateral to zero here to prevent double redemption
    collateralInAuction[auctionId][collateralAddress] = 0;
    require(
      collateralToken.transfer(msg.sender, collateralAmount) == true,
      "redeemCollateralFromAuction/transfer"
    );

    emit CollateralRedeemed(
      msg.sender,
      address(collateralToken),
      collateralAmount
    );
  }

  /// @notice This entry needs a bond config + auction config + collateral config
  /// @dev required to have a 0 fee gnosis auction
  /// @dev auctionId is returned from the newly created auction contract
  /// @dev New PorterBonds are minted from the auctionData._auctionedSellAmount
  /// @notice collateral must be deposited before the auction is created
  /// @param auctionData the auction data
  /// @param bondData the bond data
  /// @param collateralData the collateral data
  /// @return auctionId the id of the auction
  function createAuction(
    AuctionType.AuctionData memory auctionData,
    BondData memory bondData,
    CollateralData memory collateralData
  ) external returns (uint256 auctionId) {
    console.log("Broker/createAuction");
    // only create auction if there is no fee (will need to redeploy contract in this case)
    // NOTE: To be more flexible, a possibly non-zero argument can be passed and checked against the auction fee
    require(gnosisAuction.feeNumerator() == 0, "createAuction/non-zero-fee");
    require(
      collateralInContract[msg.sender][collateralData.collateralAddress] >=
        collateralData.collateralAmount,
      "createAuction/not-enough-collateral"
    );
    require(
      bondData.maturityDate >= block.timestamp &&
        bondData.maturityDate >= auctionData.auctionEndDate,
      "createAuction/invalid-maturity-date"
    );

    // Remove collateral from contract mapping before creating the auction
    collateralInContract[msg.sender][
      collateralData.collateralAddress
    ] -= collateralData.collateralAmount;

    // TODO: use the passed in bondContract to create this?
    // IERC20 auctioningToken = IERC20(bondContract);
    IERC20 auctioningToken = new PorterBond(
      "Porter Bond",
      "PorterBond",
      auctionData._auctionedSellAmount
    );

    // Approve the auction to transfer all the tokens
    require(
      auctioningToken.approve(
        address(gnosisAuction),
        auctionData._auctionedSellAmount
      ) == true,
      "initiateAuction/approve-failed"
    );

    auctionId = initiateAuction(auctionData, auctioningToken);

    // set the bond data
    auctionToBondData[auctionId] = bondData;

    // Add collateral to the auction
    collateralInAuction[auctionId][
      collateralData.collateralAddress
    ] += collateralData.collateralAmount;

    emit AuctionCreated(msg.sender, auctionId, address(auctioningToken));
  }

  /// @notice Use to create an auction after collateral has been deposited
  /// @dev auctionId is returned from the newly created auction contract
  /// @dev New PorterBonds are minted from the auctionData._auctionedSellAmount
  /// @param auctionData the auction data
  function initiateAuction(
    AuctionType.AuctionData memory auctionData,
    IERC20 auctioningToken
  ) internal returns (uint256 auctionId) {
    console.log("Broker/initiateAuction");
    // Create a new GnosisAuction
    auctionId = gnosisAuction.initiateAuction(
      auctioningToken,
      auctionData._biddingToken,
      auctionData.orderCancellationEndDate,
      auctionData.auctionEndDate,
      auctionData._auctionedSellAmount,
      auctionData._minBuyAmount,
      auctionData.minimumBiddingAmountPerOrder,
      auctionData.minFundingThreshold,
      auctionData.isAtomicClosureAllowed,
      auctionData.accessManagerContract,
      auctionData.accessManagerContractData
    );
  }
  // TODO: on auction fail or ending, burn remaining tokens feeAmount.mul(fillVolumeOfAuctioneerOrder).div(
  // TODO: on return of principle, check that principle == total supply of bond token
}
