//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

// --- Import statements ---
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./BondToken.sol";
import "./CollateralToken.sol";
import "./interfaces/IGnosisAuction.sol";
import "hardhat/console.sol";

// --- Interfaces ---
// --- Libraries ---

/// @title Porter auction wrapping EasyAuction
/// @author Porter
/// @notice This allows for the creation of an auction
/// @dev This deviates from EasyAuction by not having an auctioning token until the auction is settling
contract PorterAuction {
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
    IGnosisAuction public gnosisAuction;
    // mapping of address to uint256
    mapping(uint256 => mapping(address => uint256)) public collateralInAuction;
    mapping(address => mapping(address => uint256)) public collateralInContract;

    // --- Events ---
    /// @notice A GnosisAuction is created with auction parameters
    /// @dev auctionId is returned from the auction contract
    /// @param creator the caller of the auction
    /// @param auctionId the id of the auction
    event AuctionCreated(
        address indexed creator,
        uint256 indexed auctionId,
        address bondTokenAddress
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

    // --- Modifiers ---
    using SafeERC20 for ERC20;

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
    function configureCollateral(CollateralData memory collateralData) public {
        ERC20 collateralToken = CollateralToken(
            collateralData.collateralAddress
        );
        console.log(
            "Auction/configureCollateral\n\taddress: %s\n\tvalue: %s",
            collateralData.collateralAddress,
            collateralData.collateralAmount
        );
        require(
            collateralToken.balanceOf(msg.sender) >=
                collateralData.collateralAmount,
            "configureCollateral/sender-inadequate-collateral"
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

    /// @notice This entry needs a bond config + auction config + collateral config
    /// @dev required to have a 0 fee gnosis auction
    /// @notice collateral must be deposited before the auction is created
    /// @param auctionData the auction data
    /// @param bondData the bond data
    /// @param collateralData the collateral data
    /// @return auctionCounter the id of the auction
    function createAuction(
        AuctionType.AuctionData memory auctionData,
        BondData memory bondData,
        CollateralData memory collateralData
    ) public returns (uint256 auctionCounter) {
        console.log("Auction/createAuction");
        // only create auction if there is no fee (will need to redeploy contract in this case)
        require(
            gnosisAuction.feeNumerator() == 0,
            "createAuction/non-zero-fee"
        );
        require(
            collateralInContract[msg.sender][
                collateralData.collateralAddress
            ] >= collateralData.collateralAmount,
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
        auctionCounter = initiateAuction(auctionData);
        collateralInAuction[auctionCounter][
            collateralData.collateralAddress
        ] += collateralData.collateralAmount;
    }

    /// @notice Use to create an auction after collateral has been deposited
    /// @dev auctionId is returned from the newly created auction contract
    /// @dev New BondTokens are minted from the auctionData._auctionedSellAmount
    /// @param auctionData the auction data
    function initiateAuction(AuctionType.AuctionData memory auctionData)
        public
        returns (uint256 auctionId)
    {
        console.log("Auction/initiateAuction");
        // Create a new instance of BondToken
        ERC20 auctioningToken = new BondToken(
            "BondToken",
            "BOND",
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

        // Create a new GnosisAuction
        auctionId = gnosisAuction.initiateAuction(
            IERC20(auctioningToken),
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

        emit AuctionCreated(msg.sender, auctionId, address(auctioningToken));
    }
}
