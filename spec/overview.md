# Porter Protocol Technical Specification 

It may help if we start with the simplest design - no factories - no convertibility - no upgradability -imagine we want to create just a single auction. 


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

# BondToken
Upon the completion of a successful auction a new bond contract is deployed. Terms of the bond were determined by the auction. Bond tokens need minted and sent to investors who won the auction. 

Bond token is an ERC20 token. 

### Methods
`mint()` `isAuction` // callable by the auction contract to mint bond tokens and send them to investors who won the auction

`redeem()`  checks maturity date & bond standing - if it's past maturity date and the loan as been repayed then burn the bonds and send the repayment tokens to the address calling redeem() - maybe we follow the rocketpool method and calculate the % of total bond tokens a user holds, then allow them to claim that % amount of the total repayment tokens

### State Variables
`standing` // good | defaulted | paid 
`maturityDate` // https://github.com/porter-finance/v1-core/issues/2

# Flash Loans
DAOs can use a flash loan to liquidate part of their collateral to pay back their debt. 

## Examples
Here are two exampls of how that would work. Fees are ignored for simplicity. 

### Example 1:  
A DAO owes 100m DAI to the porter protocol. They have 10,000 stETH (at $2000/eth, 20m USD) as collateral in the porter protocol. They also have 90m liquid DAI in their treasury. 
1. DAO uses [Aave Flash Loan](https://docs.aave.com/developers/guides/flash-loans) to borrow 10m DAI
2. DAO pays back their full 100m DAI porter debt (which releases their collateral)
3. DAO withdraws their collateral and swaps some amount of it for 10m DAI on a DEX
4. DAO repays Aave 10m DAI flash loan
5. DAO now has their porter debt repaid and has their remaining collateral 

### Example 2:  
A DAO owes 100m FEI to the porter protocol. They have 30,000 stETH (at $2000/eth, 60m USD) as collateral in the porter protocol, and $70m liquid FEI in their treasury. 
1. There is not enough FEI liquidity in Aave to take out a 30m FEI flash loan so the DAO takes out a 30m USDC flash loan
2. DAO swaps 30m USDC for 30m FEI on a DEX
3. DAO pays back their full 100m porter debt (which releases their collateral)
4. DAO withdraws with their collateral and swaps some amount of it for 30m FEI on a DEX
5. DAO repays Aave 30m FEI flash loan
6. DAO now has their porter debt repaid and has their remaining collateral 


[Aave flash loan example](https://github.com/aave/code-examples-protocol/tree/main/V2/Flash%20Loan%20-%20Batch)

## Flash Loan alternatives considered
Implementing flash loans in our protocol. 

Example 3: \
A DAO owes 100m DAI to the porter protocol. They have 10,000 stETH (at $2000/eth, 20m USD) as collateral in the porter protocol, and $90m liquid DAI in their treasury. 
1. DAO withdraws their collateral
2. DAO swaps some amount of the collateral for 10m DAI with a DEX
3. DAO pays back their porter debt, which allows DAO to keep their collateral
4. If they don't pay back the debt in the same transaction everything is reverted

Pros: Avoid .09% aave fee \
Cons: Would need to add flash loan logic to our protocol vs leveraging an existing one 
