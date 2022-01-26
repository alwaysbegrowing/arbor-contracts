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

# Flash Loans
Example:
A DAO owes 100m DAI to the porter protocol. They have 10,000 ETH (at $2000/eth, 20m USD) as collateral in the porter protocol, and $90m liquid DAI. 

The DAO can use a flash loan to liquidate part of their collateral to pay back their debt. 

Example Transaction:  
1. DAO uses [Aave Flash Loan](https://docs.aave.com/developers/guides/flash-loans) to borrow 10m DAI
2. DAO pays back their full 100m porter debt (which releases their collateral)
3. DAO withdraws with their collateral and swaps some amount of it for 10m DAI on uniswap
4. DAO repays aave 10m DAI flashloan

[Aave example](https://github.com/aave/code-examples-protocol/tree/main/V2/Flash%20Loan%20-%20Batch)



How much is possible to borrow with a flash loan? 
With AAVE it depends on their avaliable liquidity. 
Current liquidity numbers (jan 26 2022): 
350m DAI 
670m USDC
18m sUSD
6m FEI 
26m FRAX
350m USDT

If a DAO needed to pay back 50m in FEI what could they do? 
They could:
1. Borrow 50m USDC from aave
2. Swap 50m USDC to 50m FEI on dex
3. Pay 50m to porter to release their collateral
4. Sell their collateral for enough USDC to repay the debt to aave
5. Repay aave 




Flash loan 2 (in progress)
1. Collateral is withdrawn 
2. DAO swaps some amount of the collateral for 10m DAI with uniswap
3. DAO pays back their porter debt, which allows DAO to keep their collateral 
4. If they don't pay back the debt in the same transaction everything is reverted


