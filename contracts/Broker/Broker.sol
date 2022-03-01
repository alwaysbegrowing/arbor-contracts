/*SPDX-License-Identifier: AGPL-3.0-or-later
┌────────────┐ ┌────────────┐ ┌────────────┐  ┌────────────┐ ┌────────────┐ ┌────────────┐ 
│            │ │            │ │            │  │            │ │            │ │            │ 
│            │ │            │ │            │  │            │ │            │ │            │ 
│            │ │            │ │            │  │            │ │            │ │            │ 
│            │ │            │ │            │  │            │ │            │ │            │ 
│            │ │            │ │            │  │            │ │            │ │            │ 
├──────┬─────┘ │            │ ├────┬────┬──┴┐ └───┬────┬───┘ ├────┬───────┘ ├────┬────┬──┴┐
│      │       │            │ │    │    │   │     │    │     │    │         │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    ├───────┐ │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    │       │ │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    ├───────┘ │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    │         │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    ├───────┐ │    │    │   │
│      │       │            │ │    │    │   │     │    │     │    │       │ │    │    │   │
└──────┘       └────────────┘ └────┘    └───┘     └────┘     └────┴───────┘ └────┘    └───┘
 */
pragma solidity 0.8.9;

// --- Import statements ---
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TestERC20.sol";
import "../SimpleBond.sol";
import "./interfaces/IGnosisAuction.sol";
import "./interfaces/IBondFactoryClone.sol";
import "hardhat/console.sol";

/// @title Broker - A contract for bond issuance and management
/// @dev This uses an immutable reference to the deployed Gnosis Auction
contract Broker is Ownable, ReentrancyGuard {
  struct Bond {
    address bondContract;
    uint256 maturityDate;
  }

  address public immutable gnosisAuctionAddress;
  address public immutable bondFactoryAddress;
  address[] public bondIssuers;

  /// @dev mapping of issuer addresses to the bonds they have issued
  mapping(address => address[]) public issuerToBonds;

  // --- Events ---
  /// @notice A GnosisAuction is created with auction parameters
  /// @dev auctionId is returned from the auction contract
  /// @param auctionId the ID of the created auction
  /// @param bondAddress the address of the bond being sold
  event AuctionCreated(uint256 auctionId, address bondAddress);

  event BondCreated(address newBond);

  error InvalidMaturityDate(uint256 maturityDate, uint256 auctionEndDate);

  error NonZeroAuctionFee();

  error UnauthorizedInteractionWithBond();

  using SafeERC20 for IERC20;

  constructor(address gnosisAuctionAddress_, address bondFactoryAddress_) {
    gnosisAuctionAddress = gnosisAuctionAddress_;
    bondFactoryAddress = bondFactoryAddress_;
  }

  function createBond(
    address _issuer,
    uint256 _maturityDate,
    uint256 _maxBondSupply,
    address _collateralAddress,
    uint256 _collateralizationRatio,
    address _borrowingAddress,
    bool _isConvertible,
    uint256 _convertibilityRatio
  ) external {
    address bond = IBondFactoryClone(bondFactoryAddress).createBond(
      address(this),
      _issuer,
      _maturityDate,
      _maxBondSupply,
      _collateralAddress,
      _collateralizationRatio,
      _borrowingAddress,
      _isConvertible,
      _convertibilityRatio
    );

    // TODO: mint an NFT associated with the bond

    issuerToBonds[_issuer].push(bond);
    if (issuerToBonds[_issuer].length == 1) {
      bondIssuers.push(_issuer);
    }
    emit BondCreated(bond);
  }

  /// @notice This entry needs a bond address + auction config
  /// @dev required to have a 0 fee gnosis auction
  /// @dev auctionId is returned from the newly created auction contract
  /// @dev New PorterBonds are minted from the auctionData._auctionedSellAmount
  /// @notice collateral must be deposited before the auction is created
  /// @param auctionData the auction data
  /// @param bondAddress the bond address
  /// @return auctionId the id of the auction
  function createAuction(
    AuctionType.AuctionData memory auctionData,
    address bondAddress
  ) external returns (uint256 auctionId) {
    // only create auction if there is no fee: gnosis says it won't add one https://github.com/gnosis/ido-contracts/issues/143
    if (IGnosisAuction(gnosisAuctionAddress).feeNumerator() > 0) {
      revert NonZeroAuctionFee();
    }
    SimpleBond bond = SimpleBond(bondAddress);

    if (bond.issuer() != msg.sender) {
      revert UnauthorizedInteractionWithBond();
    }

    if (
      bond.maturityDate() < block.timestamp ||
      bond.maturityDate() < auctionData.auctionEndDate
    ) {
      revert InvalidMaturityDate(
        bond.maturityDate(),
        auctionData.auctionEndDate
      );
    }

    // Approve the auction to transfer all the tokens
    bond.approve(gnosisAuctionAddress, auctionData._auctionedSellAmount);

    auctionId = initiateAuction(auctionData, bondAddress);

    emit AuctionCreated(auctionId, bondAddress);
  }

  /// @notice Use to create an auction after collateral has been deposited
  /// @dev auctionId is returned from the newly created auction contract
  /// @dev New PorterBonds are minted from the auctionData._auctionedSellAmount
  /// @param auctionData the auction data
  function initiateAuction(
    AuctionType.AuctionData memory auctionData,
    address bondAddress
  ) internal returns (uint256 auctionId) {
    auctionId = IGnosisAuction(gnosisAuctionAddress).initiateAuction(
      IERC20(bondAddress),
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
}
