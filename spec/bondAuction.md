# Auction
The auction contract adapts the [EasyAuction](https://github.com/gnosis/ido-contracts#easyauction) contract from Gnosis. This contract sets up, accepts bids, and pays out using a [batch auction mechanism](https://github.com/gnosis/ido-contracts#the-batch-auction-mechanism). The auction contract tracks all auctions (current, and past) via an `auctionId` and stores all relevant auction data within a `auctionData` mapping. 

The basic flow is:
  - An interested auctioneer will first interact with the [Bond Token](#BondToken) - Giving a configuration of bond desires. This is the token that will be awarded at the end of a successful auction. Token will then be taken into the auction contract. This token will be minted either
    - At the beginning and passed into the auction itself
    - Deployed and minted at successful auction settlement
  - The auction contract will check that the configuration exists on that bond contract (external call).
  - If that config is validated, the auction config itself will be checked. Length, minimum bid, etc.
  - The auction contract will lastly check and store the collateral within the auction contract.
  - The auction starts accepting bids.
  - After the predetermined time is up, the auction ends, with all bids recorded.
  - The auction is settled, statuses updated to complete, and the winners can claim their order amount.
    - Winners pull from their successful orders
    - Bidding tokens are pushed to the auctioneer

### Structs
```
AuctionConfig {
  IERC20 _auctioningToken
  IERC20 _biddingToken
  uint256 orderCancellationEndDate
  uint256 auctionEndDate
  uint96 _auctionedSellAmount
  uint96 _minBuyAmount
  uint256 minimumBiddingAmountPerOrder
  uint256 minFundingThreshold
  bool isAtomicClosureAllowed
  address accessManagerContract
  bytes memory accessManagerContractData
}
```
```
BondConfig {
  uint256 maturityDate
  bool isConvertible
}
```
```
CollateralConfig {
  IERC20 collateralToken
  uint256 collateralAmount
}
```
### Methods
`initiateAuction()` The entry-point which is called by a borrower to start the auction process. This function accepts an auction config, bond config, and collateral config. This is because in order to have a valid auction, all three of these pieces must be valid and set when the auction begins as the lenders need to have this information.

Parameters
```
AuctionConfig auctionConfig
CollateralConfig collateralConfig
BondConfig bondConfig
```

`placeBid()` This function is called by a borrower to place a bid. The borrower must have enough tokens to cover the bid.

Parameters
```
uint256 auctionId
uint96[] memory _minBuyAmounts
uint96[] memory _sellAmounts
bytes32[] memory _prevSellOrders
bytes calldata allowListCallData
```
`cancelSellOrders()` If the `orderCancellationEndDate` has not passed, this function can be called by a bidder to cancel their sell order(s).

Parameters
```
uint256 auctionId
bytes32[] memory _sellOrders
```

`getAuctionConfig() view returns(AuctionConfig, BondConfig, CollateralConfig)` This function returns the auction config for a given auction.


# End to End auction flow
Example: DAI as borrowing asset
Max interest rate: 10%
Term length: 1 year
Min issuance size: 50m
Max issuance size: 100m

Bonds may be sold in a mechanism other than an auction in the future - so we should keep that in mind when designing how we are storing collateral, repayment, etc