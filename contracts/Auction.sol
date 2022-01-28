//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;

import "./EasyAuction.sol";
import "./QaraghandyToken.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./CollateralLockerFactory.sol";
import "./EasyAuction.sol";

/// @title Porter auction wrapping EasyAuction
/// @author Porter
/// @notice This allows for the creation of an auction
/// @dev This deviates from EasyAuction by not having an auctioning token until the auction is settling
contract Auction is EasyAuction {
    EasyAuction public auction;
    CollateralLockerFactory _collateralLockerFactory;

    constructor(address collateralLockerFactoryAddress) public {
        _collateralLockerFactory = CollateralLockerFactory(
            collateralLockerFactoryAddress
        );
    }

    /// @notice An EasyAuction is created with auction parameters
    /// @dev auctionId is returned from the auction contract
    /// @param creator the caller of the auction
    /// @param auctionId the id of the auction
    event AuctionCreated(address indexed creator, uint256 indexed auctionId);

    function auctionCount() public view returns (uint256) {
        return auctionCounter;
    }

    /// @notice This entry needs a bond config + auction config + collateral config
    /// @dev Explain to a developer any extra details
    /// @param bondContract this is the address of the bond with config
    /// @return auctionCounter the id of the auction
    function createAuction(
        /* auction config */
        IERC20 _biddingToken,
        uint256 orderCancellationEndDate,
        uint256 auctionEndDate,
        uint96 _auctionedSellAmount,
        uint96 _minBuyAmount,
        uint256 minimumBiddingAmountPerOrder,
        uint256 minFundingThreshold,
        bool isAtomicClosureAllowed,
        address accessManagerContract,
        bytes memory accessManagerContractData,
        /* bond config */
        address bondContract,
        /* collateral config */
        address collateralLockerAddress,
        uint256 collateralizationRatio
    ) public returns (uint256 auctionCounter) {
        console.log(collateralLockerAddress);
        console.log(_collateralLockerFactory.owner(collateralLockerAddress));
        require(
            _collateralLockerFactory.owner(collateralLockerAddress) ==
                address(_collateralLockerFactory),
            "collateral locker owner mismatch"
        );
        uint256 _auctionCounter = initiateAuction(
            _biddingToken,
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

        emit AuctionCreated(msg.sender, _auctionCounter);
    }
}
