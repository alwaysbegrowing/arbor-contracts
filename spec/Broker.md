
# Collateral
Borrower would have to allow our contract to withdraw the collateral by calling `approve` on the ERC20 contract that they want to use. (We give this capability through our UI)
`deposit` Method is called to deposit collateral for a specific bond. Only a single token type is supported per bond. 
Parameters
```
address bond
address collateral
uint256 amount
```

For non-convertible bonds, a borrower should:
* Be able to withdraw their collateral if the principle + interest amount has been repaid. (Make sure flash loans are possible).
* Not be able to withdraw collateral if the principle + interest has not been repaid.

For convertible bonds, at minimum, the amount of collateral required is the total amount of bonds multiplied by the convertibility ratio. See [Convertibility](#Convertibility). A borrower may include collateral in addition to this amount. A borrower should
* Be able to withdraw the portion, if one exists, of the collateral that is not being used to cover the convertibility of the bond if the principle + interest has been repaid and the current date < maturityDate.
* Be able to withdraw the full amount of collateral if the principle + interest has been repaid and the current date > maturityDate
* Not be able to withdraw collateral if the principle + interest has not been repaid.
  
In the case of a default - there needs to be a way for bondholders to get a pro rata share of this collateral. This will probably be done via a `redeem` method - the same one bondholders would use on a non-defaulted bond to get their share of the `repayment` amount. 

# Repayment
To repay -  the borrower have to call `approve` on the token they are repaying in
`repay` method - (onlyBondOwner?) This allows the borrower to repay part of their debt, or the full amount. This method will update the `paidAmount` state variable, and unlock their collateral if the above collateral conditions are met. 
```
address bond
uint256 amount
```

# Convertibility 
When the bond is created - a convertablity ratio from bonds:collateral token is set. If convertability is enabled - bondholders will have the option of converting their bonds at that predefined ratio at any time before bond maturity.
The bondholder has to approve our contract to withdraw and convert the bonds? (Maybe not if we use ERC777 or a newer ERC20 standard?) 
`convert` - this withdraws the given amount of bondtokens, burns them, updates the current amount of collateral, looks at the convertibility ratio, and sends the collateral token to the caller. 
```
address bond
uint256 amount
```

# Redemption
Depending on the current conditions - bondtokens can either be redeemed for a pro-rata share of the repayment amount, or for the underlying collateral. 
`redeem` - this looks at how many bondtokens they have, the current state of the bond, then decides what to do. If the bond was repaid - the users pro rate share of their (bond tokens sent / total bond tokens) * repayment amount is calculated. Then the users bonds are burned and they are sent their share of the repayment amount. 

If the bond was defaulted - this calculates their pro rata share then sends them their share of the collateral + any repaid instead. Their bonds are also not burned in this case and can be used as proof of the debt owed to bondholders in a follow up lawsuit etc. 
```
address bond
uint256 amount
``` 

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
