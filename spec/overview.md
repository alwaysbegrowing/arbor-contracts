# Contracts Overview

## Main contracts
### [Broker](./bondAuction.md)
The main entry point into the Porter Protocol. Most interactions with Porter will happen via the Broker, including:
* Depositing collateral
* Creating `BondTokens`
* Handling converabiltiy
* Handling repayment
* Allowing bond redemption
* Initiating bond auction

### [BondTokens](./bondToken.md)

`BondTokens` represent [zero coupon bonds](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders). They implement the standard EIP-20/ERC20 token methods as well as Porter speciic methods including:
* `setBondStanding()`


A new `BondToken` is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers)



# Outstanding Design Decisions 
## Broker pattern vs token pattern
We have the option of having the broker contract act as a middleman and handle the main functionality of the protocol (broker pattern) or we can implement this functionality on each of the different tokens themselves (token pattern)

Do we have one broker contract that holds all the collateral, handles convertability, handles repayment, handles bond redemption for each of the bonds? Or should we implement that logic on the bond itself and limit the functionality of the broker to just deploying the bond tokens?


* [AAVE](https://github.com/aave/protocol-v2/blob/master/contracts/protocol/tokenization/AToken.sol) uses the broker pattern while [Compound](
https://github.com/compound-finance/compound-protocol/blob/master/contracts/CToken.sol) uses the token pattern

* We will be deploying a new bond contract for every single auction. For gas savings - we may want to keep the bond functionality minimal (Broker pattern). This may not be an issue if we follow the `clone` pattern for new bonds.  This will be explored further in https://github.com/porter-finance/v1-core/issues/15

## Allow multiple ways of selling bonds
* Bonds should be decoupled from gnosis auction. Gnosis auction is just a mechanism for selling the bonds. They should be designed in a way where they could be sold directly to lenders - or through other means. 

## No Orcales
We are designing the protocol in a way that we can avoid price oracles