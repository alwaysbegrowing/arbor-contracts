# Contracts Overview

# Main contracts

## Gnosis Auction (external)

### Bond Auction

Borrowers have the option to use an auction to sell their bonds. The borrower sets the parameters of the auction then a gnosis auction is created.

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

## [BondTokens]

A new `Bond` contract is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods. Each `BondToken` represents a [zero coupon bond](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders).

`BondTokens` support the following functionality:

- Creation and minting new `BondTokens` via `initialize()` and `mint()`
- Depositing/withdrawing collateral via `depositCollateral()` and `withdrawCollateral()`
- Handling convertibility via a configured ratio and the ability for lenders to convert their `BondTokens` using `convert()`
- Handling repayment for the issuer via `repay()`
- Allowing bond redemption for the bond holders via `redeem()`

### Collateral

Borrowers specify the ERC20 token they would like to use as collateral when creating the bond. Only a single collateral type is supported per bond. The ratio for collateral backing each token is also specified by the borrower at bond creation. This "collateralization ratio" prerequisites the minting of new bonds.

### Convertibility

If convertability in enabled for the bond,
Bondholders will have an option to redeem their bond tokens for the underlying collateral at a predefined "convertibility ratio".
For example - when the bond is created the ratio may be 1 bond token : .5 collateral token. This gives the lenders equity upside because the bond token can be redeemed, at any time before maturity of the bond, for a portion of a collateral token. Convertibility cannot be changed once set and after the bond's maturity, the bond token can no longer be redeemed for the collateral token.

### Repayment

This gives the ability for a borrower to repay their debt. Repaying allows the borrower to withdraw any collateral that is not used to back convertible tokens. After the maturity date is met, all collateral can be withdrawn and the bond will be considered to be `PAID`. At this time, lenders lose the ability to convert their bond tokens into the collateral token. Lenders gain the ability to redeem their bond tokens for the borrowing token.

### Bond Redemption

#### if repaid

Bonds can be redeemed for a pro rata share of the repayment amount.

#### if defaulted

Bonds can be redeemed for a pro rata share of the collateral + repayment amount.

TODO: below needs rethought

Bondholder tokens are not burnt on default - instead they are set to a `defaulted` state and are used to represent the debt still owed to the lenders.

# Walkthrough (Draft, Incomplete)

A DAO named AlwaysBeGrowing (ABG) would like to borrow DAI and use their native token LEARN as collateral. They configure the terms of the bond as such:

- Collateral
  - Address `LEARN token address`
  - Amount `30,000,000 LEARN`
  - Ratio `3:1`, or `300`
- Convertibility `false`
  - Ratio `N/A`
- Total Bond Supply `10,000,000 BOND`
- Maturity Date `1 year`
- Borrowing
  - Address `DAI token address`
  - Amount `10,000,000 DAI`

The `Broker` will call the `BondFactory` to create a `Bond`.

1. The new bond contract is deployed.
2. 30,000,000 LEARN tokens are deposited into the bond contract.
3. 10,000,000 BOND tokens are minted and sent to ABG.

ABG now has a few options.

- `initateBondAuction` Initiate a Gnosis auction
- sell tokens on the market
- add collateral `depositCollateral` and `mint` more bonds up to the collateralization ratio
- `withdrawCollateral` to burn bonds and withdraw collateral up to the collateralization ratio

## Withdrawing collateral

Collateral can be withdrawn at any time as long as the issuer retains all tokens in the supply, and that no other bond token holders exist for the bond.

If they choose to withdraw the collateral - the bonds will be burned and the collateral will be returned (should we self destruct the contract as well?)

## Initiate an auction

If they choose to initate a gnosis auction - the `Broker` will kick off the auction by calling Gnosis auction with the auction paramaters configured by ABG and the `borrowingToken` of DAI and `auctioningToken` of BondToken. If the auction is unsuccessful, no tokens are given out to anyone except returned to the issuer. On the other hand, if the auction is successful, bond tokens will be distributed to the bidders and DAI will be given to the bond issuer.

## Wait

At the time when bonds are issued, ABG can no longer burn all tokens and exit their bond position. They are now required to repay the amount corresponding to how many tokens are outstanding (that is, not owned by them). This is because the tokens now represent a debt to the bond holders which will need to be repaid.

For example, if 2,000,000 of the BOND tokens were sold at auction, ABG can:

- Withdraw collateral up until the amount needed to cover the outstanding bonds
  - (10,000,000 issuance - 2,000,000 distributed = 8,000,000 BOND) burnt for (8,000,000 burnt \* 3 collateralization ratio = 24,000,000 LEARN)
- Repay principal and withdraw collateral
  - (2,000,000 DAI repaid = 2,000,000 bonds now covered \* 3 collateralization ratio = 6,000,000 LEARN withdrawn)

Finally, at maturity date, bond holders can redeem their 2,000,000 BONDs for the deposited 2,000,000 DAI and the position is closed

TODO: Watch @namaskars auction videos before filling out auction results

TODO: Is it possible for the bonds to be sent to ABG instead?

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
