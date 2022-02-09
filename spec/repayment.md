# Debt Repayment


## Flash Loans
DAOs can use a flash loan to liquidate part of their collateral to pay back their debt. 

### Examples
Here are two exampls of how that would work. Fees are ignored for simplicity. 

#### Example 1:  
A DAO owes 100m DAI to the porter protocol. They have 10,000 stETH (at $2000/eth, 20m USD) as collateral in the porter protocol. They also have 90m liquid DAI in their treasury. 
1. DAO uses [Aave Flash Loan](https://docs.aave.com/developers/guides/flash-loans) to borrow 10m DAI
2. DAO pays back their full 100m DAI porter debt (which releases their collateral)
3. DAO withdraws their collateral and swaps some amount of it for 10m DAI on a DEX
4. DAO repays Aave 10m DAI flash loan
5. DAO now has their porter debt repaid and has their remaining collateral 

#### Example 2:  
A DAO owes 100m FEI to the porter protocol. They have 30,000 stETH (at $2000/eth, 60m USD) as collateral in the porter protocol, and $70m liquid FEI in their treasury. 
1. There is not enough FEI liquidity in Aave to take out a 30m FEI flash loan so the DAO takes out a 30m USDC flash loan
2. DAO swaps 30m USDC for 30m FEI on a DEX
3. DAO pays back their full 100m porter debt (which releases their collateral)
4. DAO withdraws with their collateral and swaps some amount of it for 30m FEI on a DEX
5. DAO repays Aave 30m FEI flash loan
6. DAO now has their porter debt repaid and has their remaining collateral 


[Aave flash loan example](https://github.com/aave/code-examples-protocol/tree/main/V2/Flash%20Loan%20-%20Batch)

### Flash Loan alternatives considered
Implementing flash loans in our protocol. 

Example 3:  
A DAO owes 100m DAI to the porter protocol. They have 10,000 stETH (at $2000/eth, 20m USD) as collateral in the porter protocol, and $90m liquid DAI in their treasury. 
1. DAO withdraws their collateral
2. DAO swaps some amount of the collateral for 10m DAI with a DEX
3. DAO pays back their porter debt, which allows DAO to keep their collateral
4. If they don't pay back the debt in the same transaction everything is reverted

Pros: Avoid .09% aave fee  
Cons: Would need to add flash loan logic to our protocol vs leveraging an existing one 

# Default & Liquidations 
Our protocol avoids using any pricing oracles to reduce the effect of price manipulation & oracle risk.  

Upon a default - bondholders are able to redeem their bond tokens for a pro-rata share of the collateral & repayment amount.

Bondholders will also receive a defaulted bond token that represents the unpaid debt that the issuer owes the bondholder. 
