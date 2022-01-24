# Porter Protocol Technical Specification 

It may help if we start with the simpliest design - no factories - no convertability - no upgradability -imagine we want to create just a single auction. 


# EasyAuction
@namaskar fill this out:

AuctionFactory
new AuctionContract(...auctionDetails, collateralAddress, collateral amount)
This creats a new contract address 

```solidity
contract AuctionFactory {
    function CreateAuction(assetAddressToBorrow, maxInterestRate, termLengthDays, maxIssuanceSize, minIssuanceSize, collateralAddress, collateralAmount, convertable ) {

    }
}
```

# BondToken
Upon the completion of a successful auction a new bond contract is deployed. Terms of the bond were determined by the auction. Bond tokens need minted and sent to investors who won the auction. 

Bond token is an ERC20 token. 

### Methods
`mint()` `isAuction` // callable by the auction contract to mint bond tokens and send them to investors who won the auction

`redeem()`  checks maturity date & bond standing - if it's past maturity date and the loan as been repayed then burn the bonds and send the repayment tokens to the address calling redeem() - maybe we follow the rocketpool method and calculate the % of total bond tokens a user holds, then allow them to claim that % amount of the total repayment tokens

### State Variables
`standing` // good | defaulted | paid 
`maturityDate` // https://github.com/porter-finance/v1-core/issues/2

