# Contracts Overview

# Main contracts

## BondFactory

This uses [CloneFactory](https://github.com/porter-finance/v1-core/issues/15) for significant gas savings.

- Creates the bond with the passed in configuration:
  - Collateral
    - Address
    - Amount
    - Ratio
  - Convertibility
    - Ratio
  - Total Bond Supply
  - Maturity Date
  - Borrowing
    - Address
    - Amount

## BondTokens

A new `Bond` contract is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods. Each `BondToken` represents a [zero coupon bond](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders).

`BondTokens` support the following functionality:

- Creation and minting new `BondTokens` via `initialize()` and `mint()`
- Depositing/withdrawing collateral via `depositCollateral()` and `withdrawCollateral()`
- Handling convertibility via a configured ratio and the ability for lenders to convert their `BondTokens` using `convert()`
- Handling repayment for the issuer via `repay()`
- Allowing bond redemption for the bond holders via `redeem()`

### Collateral

Borrowers specify the ERC20 tokens they would like to use as collateral when creating the bond. Multiple distinct ERC20 tokens used as collateral is supported.

### Convert

If convertability in enabled for the bond,
Bondholders will have an option to redeem their bond tokens for the underlying collateral at a predefined "convertibility ratio".
For example - when the bond is created the ratio may be 1 bond token : .5 collateral token. This gives the lenders equity upside because the bond token can be redeemed, at any time before maturity of the bond, for a portion of a collateral token. Convertibility cannot be changed once set and after the bond's maturity, the bond token can no longer be redeemed for the collateral token.

### Repay

This gives the ability for a borrower to repay their debt. Repaying allows the borrower to withdraw any collateral that is not used to back convertible tokens. After the maturity date is met, all collateral can be withdrawn and the bond will be considered to be `PAID`. At this time, lenders lose the ability to convert their bond tokens into the collateral token. Lenders gain the ability to redeem their bond tokens for the borrowing token.

### Redeem

#### if repaid

Bonds can be redeemed for a pro rata share of the repayment amount.

#### if defaulted

Bonds can be redeemed for a pro rata share of the collateral + repayment amount.

# Design Decisions

## No Oracles

- We are designing the protocol in a way that we can avoid price oracles

## Broker pattern vs token pattern

- https://github.com/porter-finance/v1-core/issues/29

## Allow multiple ways of selling bonds

- Bonds should be decoupled from gnosis auction. Gnosis auction is just a mechanism for selling the bonds. They should be designed in a way where they could be sold directly to lenders - or through other means.

## Supporting multiple collateral types

- https://github.com/porter-finance/v1-core/issues/28

## Use clone factory instead of normal factory for creating new BondTokens

- https://github.com/porter-finance/v1-core/issues/15

## Upgradability strategy

- https://github.com/porter-finance/v1-core/issues/40
