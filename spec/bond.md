## Bond

A new `Bond` contract is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods. Each `BondToken` represents a [zero coupon bond](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders).

`Bonds` support the following functionality:

### Borrower

- Depositing collateral and minting new `Bonds` via `mint()`
- Handling repayment for the issuer via `repay()`
- withdrawing collateral `withdrawCollateral()`

### Lenders

- Handling convertibility via a configured ratio and the ability for lenders to convert their `Bonds` using `convert()`
- Allowing bond redemption for the bond holders via `redeem()`

### Collateral

Borrowers specify the ERC20 tokens they would like to use as collateral when creating the bond. Only a single collateral type is supported.

### Convert

If convertability in enabled for the bond,
Bondholders will have an option to redeem their bond tokens for the underlying collateral at a predefined "convertibility ratio".
For example - when the bond is created the ratio may be 1 bond token : .5 collateral token. This gives the lenders equity upside because the bond token can be redeemed, at any time before maturity of the bond, for a portion of a collateral token. Convertibility cannot be changed once set and after the bond's maturity, the bond token can no longer be redeemed for the collateral token.

### Pay

This gives the ability for a borrower to pay their debt. Paying allows the borrower to withdraw any collateral that is not used to back convertible tokens. After the maturity date is met, all collateral can be withdrawn and the bond will be considered to be `PAID`. At this time, lenders lose the ability to convert their bond tokens into the collateral token. Lenders gain the ability to redeem their bond tokens for the borrowing token.

### Redeem

#### if paid

Bonds can be redeemed for a pro rata share of the payment amount.

#### if defaulted

Bonds can be redeemed for a pro rata share of the collateral + payment amount.

# Design Decisions

## Use clone factory instead of normal factory for creating new Bonds

- https://github.com/porter-finance/v1-core/issues/15

## Upgradability strategy

Contracts are not upgradable. In the future it will be possible for borrowers to refinance their loan by granting the `WITHDRAW_ROLE` and the `MINT_ROLE` to a refinance contract.
