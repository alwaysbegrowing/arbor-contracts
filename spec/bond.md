## Bond

A new `Bond` contract is created for each [borrower](https://docs.porter.finance/portal/participants/borrowers). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods. Each `BondToken` represents a [zero coupon bond](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/participants/lenders).

`Bond`s support the following functionality:

### Borrower

- Depositing collateral and minting bond shares
- Handling payment for the issuer via `pay()`
- withdrawing collateral `withdrawExcessCollateral()`
- withdrawing excess paymentTokens `withdrawExcessPayment()`

### Lenders

- Handling convertibility via a configured ratio and the ability for lenders to convert their bond shares using `convert()`
- Allowing bond share redemption for the bond holders via `redeem()`

### Collateral

Borrowers specify the ERC20 tokens they would like to use as collateral when creating the bond. Only a single collateral type is supported.

### Convert

If convertibility is enabled for the `Bond`, Bondholders will have an option to redeem their bond shares for the underlying collateral at a predefined "convertibility ratio".

For example: when the `Bond` is created, the ratio may be 1 bond share : .5 collateral tokens. This gives the lenders equity upside because the bond share can be redeemed, at any time before maturity of the bond, for a portion of a collateral token. Convertibility cannot be changed once set and after the `Bond`'s maturity, the bond shares can no longer be redeemed for the collateral token.

### Pay

This gives the ability for a borrower to pay their debt. Paying allows the borrower to withdraw any collateral that is not used to back convertible tokens. After the maturity date is met, all collateral can be withdrawn and the `Bond` will be considered to be `PAID`. At this time, lenders lose the ability to convert their bond shares into the collateral token. Lenders gain the ability to redeem their bond shares for the borrowing token.

### Redeem

#### if paid

Bond shares can be redeemed for a pro rata amount of the payment in the Bond contract.

#### if defaulted

Bond shares can be redeemed for a pro rata amount of the collateral + payment in the Bond contract.

# Design Decisions

## Use clone factory instead of normal factory for creating new Bonds

- https://github.com/porter-finance/v1-core/issues/15

## Upgradability strategy

Contracts are not upgradable. In the future it will be possible for borrowers to refinance their loan by transferring Bond ownership to a "Refi Vault".
