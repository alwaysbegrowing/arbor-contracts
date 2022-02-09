# Contracts Overview

## Main contracts
### [Broker](./broker.md)
The main entry point into the Porter Protocol. Most interactions with Porter will happen via the Broker, including:
* Depositing collateral
* Creating `BondTokens`
* Handling convertibility
* Handling repayment
* Allowing bond redemption
* Initiating bond auction

### Collateral 
Borrowers are able to deposit any ERC20 token as collateral. Only a single collateral type is supported per bond. Collateral is associated with a single bond.

### Creating bond tokens
A new ERC20 `BondToken` is deployed per-issuance which represents the debt owed by the borrower.

### Convertibility 
If convertability in enabled for the bond, 
Bondholders will have an option to redeem their bond tokens for the underlying collateral at a predefined ratio. 
For example - when the bond is created the ratio may be 1 bond : .5. This gives the lenders equity upside where they can redeem their bonds for the underlying token if the collateral token goes up in price. Convertibility cannot be changed once set and after repayment, the bond can no longer be redeemed for the underlying collateral.

### Repayment
This gives the ability for a borrower to repay their debt. Repaying unlocks their collateral and sets the bond state to `paid`.

### Bond Redemption
#### if repaid 
Bonds can be redeemed for a pro rata share of the repayment amount. 
#### if defaulted
Bonds can be redeemed for a pro rata share of the collateral + repayment amount. 

Bondholder tokens are not burnt on default - instead they are set to a `defaulted` state and are used to represent the debt still owed to the lenders.

### Auction 
Borrowers have the option to use an auction to sell their bonds. The borrower sets the parameters of the auction then a gnosis auction is created.


### [BondTokens](./bondToken.md)

`BondTokens` represent [zero coupon bonds](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods including:
* `setBondStanding()`


A new `BondToken` is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers)



# Outstanding Design Decisions 
## Broker pattern vs token pattern
We have the option of having the broker contract act as an intermediary that handles the main functionality of our protocol (broker pattern) or we can implement this functionality on each of the different tokens themselves (token pattern)

Do we have one broker contract that holds all the collateral, handles convertability, handles repayment, handles bond redemption for each of the bonds? Or should we implement that logic on the bond itself and limit the functionality of the broker to just deploying the bond tokens?


* [AAVE](https://github.com/aave/protocol-v2/blob/master/contracts/protocol/tokenization/AToken.sol) uses the broker pattern while [Compound](
https://github.com/compound-finance/compound-protocol/blob/master/contracts/CToken.sol) uses the token pattern

* We will be deploying a new bond contract for every single auction. For gas savings - we may want to keep the bond functionality minimal (Broker pattern). This may not be an issue if we follow the `clone` pattern for new bonds.  This will be explored further in https://github.com/porter-finance/v1-core/issues/15

## Allow multiple ways of selling bonds
* Bonds should be decoupled from gnosis auction. Gnosis auction is just a mechanism for selling the bonds. They should be designed in a way where they could be sold directly to lenders - or through other means. 

## No Oracles
We are designing the protocol in a way that we can avoid price oracles

### Alternatives considered 
* Supporting multiple collateral types & allow-listing collateral tokens (https://github.com/porter-finance/v1-core/issues/28)
