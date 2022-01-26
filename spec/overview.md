# Porter Protocol Technical Specification 

It may help if we start with the simplest design - no factories - no convertibility - no upgradability -imagine we want to create just a single auction. 


# EasyAuction
@namaskar fill this out:

We should probably follow how easyAuction is implemented with a single auction contract that holds all of the auctions. 




# BondToken
Upon the completion of a successful auction a new bond contract is deployed. Terms of the bond were determined by the auction. Bond tokens need minted and sent to investors who won the auction. 

Bond token is an ERC20 token. 

### Methods
`mint()` `isAuction` // callable by the auction contract to mint bond tokens and send them to investors who won the auction

`redeem()`  checks maturity date & bond standing - if it's past maturity date and the loan as been repayed then burn the bonds and send the repayment tokens to the address calling redeem() - maybe we follow the rocketpool method and calculate the % of total bond tokens a user holds, then allow them to claim that % amount of the total repayment tokens

### State Variables
`standing` // good | defaulted | paid 
`maturityDate` // https://github.com/porter-finance/v1-core/issues/2

# Flash loans for repayment 
Imagine a situation where a DAO needs to pay back a 100m  DAI loan. 

Let's say they have 90m DAI and 50m in deposited collateral. 

We want to enable them to repay the debt and release the collateral through a flash loan. 

Here's the sequence of events that would need to take place. This would all need to occur in a single transaction. 
1. DAO uses `aave` flashloan to borrow 10m DAI
2. DAO uses 10m DAI to payback the porter debt - which releases their collateral 
3. DAO withdraws with their collateral and swaps some amount of it for 10m DAI on uniswap
4. DAO repays aave 10m DAI flashloan



How much is possible to borrow with a flash loan? 
With AAVE it depends on their avaliable liquidity. 
Current liquidity numbers (jan 26 2022): 
350m DAI 
670m USDC
18m sUSD
6m FEI 
26m FRAX
350m USDT


Flash loan 2 (in progress)
1. Collateral is withdrawn 
2. DAO swaps some amount of the collateral for 10m DAI with uniswap
3. DAO pays back their porter debt, which allows DAO to keep their collateral 
4. If they don't pay back the debt in the same transaction everything is reverted


