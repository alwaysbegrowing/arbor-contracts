//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.0;

import "./EasyAuction.sol";
import "./QaraghandyToken.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Auction {
    EasyAuction public auction;
    constructor(address _easyAuctionAddress) public {
        auction = EasyAuction(_easyAuctionAddress);
    }

    mapping(uint256 => address) public auctionToToken;
    mapping(address => uint256) public tokenToAuction;

    event AuctionCreated(address indexed creator, uint256 indexed auctionId);
    event TokenDeployed(address indexed creator, address indexed tokenAddress);

    function auctionCount() public view returns (uint256) {
        return auction.auctionCounter();
    }

    function deployUniqueToken(uint256 auctionId, uint96 _auctionedSellAmount)
        public
        returns (QaraghandyToken)
    {
        QaraghandyToken token = new QaraghandyToken(
            "QaraghandyToken",
            "QH",
            _auctionedSellAmount
        );
        address tokenAddress = address(token);
        
        auctionToToken[auctionId] = tokenAddress;
        tokenToAuction[tokenAddress] = auctionId;

        emit TokenDeployed(msg.sender, tokenAddress);
        return QaraghandyToken(tokenAddress);
    }

    function increaseAuctionAllowance(
        QaraghandyToken token,
        address _auctionAddress,
        uint256 _amount
    ) internal returns (bool) {
        return token.increaseAllowance(_auctionAddress, _amount);
    }

    function createAuction(
        IERC20 _biddingToken,
        uint256 orderCancellationEndDate,
        uint256 auctionEndDate,
        uint96 _auctionedSellAmount,
        uint96 _minBuyAmount,
        uint256 minimumBiddingAmountPerOrder,
        uint256 minFundingThreshold,
        bool isAtomicClosureAllowed,
        address accessManagerContract,
        bytes memory accessManagerContractData
    ) public returns (uint256 auctionCounter) {
        QaraghandyToken auctioningToken = deployUniqueToken(
            auctionCounter,
            _auctionedSellAmount
        );

        increaseAuctionAllowance(
            auctioningToken,
            address(auction),
            _auctionedSellAmount
        );

        uint256 auctionCounter = auction.initiateAuction(
            auctioningToken,
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
        emit AuctionCreated(msg.sender, auctionCounter);
    }
}
