# Contracts Overview

## BondFactory

The `BondFactory` facilitates the creation of new bonds. For our early v1 only authorized addresses will be able to create `Bonds` through the `BondFactory`

## [Bond](./bond.md)

A new `Bond` contract is created for each [borrower](https://docs.porter.finance/portal/protocol/borrowers). They implement the standard EIP-20/ERC20 token methods as well as Porter specific methods. Each `Bond` represents a [zero coupon bond](https://docs.porter.finance/portal/intro-to-bonds/zero-coupon-bonds) that can be purchased by [lenders](https://docs.porter.finance/portal/protocol/lenders).

# User Roles

## Borrowers

Borrowers are on chain entities that want to borrow stablecoins using their native token as collateral with a fixed interest rate and no liquidation risk.

- Creation and minting new `BondTokens` via `initialize()` and `mint()`
- Depositing/withdrawing collateral via `mint()` and `withdrawCollateral()`
- Handling convertibility via a configured ratio and the ability for lenders to convert their `BondTokens` using `convert()`
- Handling payment for the issuer via `pay()`
- Allowing bond redemption for the bond holders via `redeem()`

To borrow money, a borrower has to issue a bond and then sell it.

### Issue Bond

Borrowers decide on multiple paramaters and call the `Factory.createBond` method passing in their address as the owner.

```solidity
    /**
        @notice Creates a bond
        @param name Name of the bond
        @param symbol Ticker symbol for the bond
        @param owner Owner of the bond
        @param maturityDate Timestamp of when the bond matures
        @param collateralToken Address of the collateral to use for the bond
        @param collateralRatio Ratio of bond: collateral token
        @param repaymentToken Address of the token being paid
        @param convertibleRatio Ratio of bond:token that the bond can be converted into
        @param maxSupply Max amount of tokens able to mint
        @dev This uses a clone to save on deployment costs https://github.com/porter-finance/v1-core/issues/15 which adds a slight overhead everytime users interact with the bonds - but saves 10x the gas during deployment
    */
    function createBond(
        string memory name,
        string memory symbol,
        address owner,
        uint256 maturityDate,
        address repaymentToken,
        address collateralToken,
        uint256 collateralRatio,
        uint256 convertibleRatio,
        uint256 maxSupply
    )
```

This method creates a new bond and grants the borrower the `MINT_ROLE` and the `ISSUER_ROLE` on the newly deployed bond.

After a bond is issued, there are a few things the borrower can do.

### Pay

This gives the ability for a borrower to pay their debt. Paying allows the borrower to withdraw any collateral that is not used to back convertible tokens. After the maturity date is met, all collateral can be withdrawn and the bond will be considered to be `PAID`. At this time, lenders lose the ability to convert their bond tokens into the collateral token. Lenders gain the ability to redeem their bond tokens for the borrowing token.

### `Bond.mint()`

To get `Bonds` to sell, the borrower needs the call the `Bond.mint()` method to deposit collateral at their configured `backingRatio` in exchange for `Bonds`

### `Bond.repay()`

The borrower can call this method to pay `repaymentToken` and unlock their collateral. This will typically be done a week before the maturity date of the bond.

### `Bond.withdraw()`

After repaying, the borrower can call this method to withdraw any collateral that has been unlocked. The borrower can also call `Bond.burn()` to burn any bonds they own and unlock collateral to withdraw at (backingRatio \* burnedBonds)

To get `Bonds` to sell, the borrower needs the call the `Bond.mint()` method to deposit collateral at their configured `backingRatio` in exchange for `Bonds`

### Sell Bonds

After calling `Bond.mint()` borrowers can sell thier bonds using [Gnosis Auction](https://github.com/gnosis/ido-contracts)

## Lenders

Lenders are able to purchase bonds through Gnosis Auction.

Once purchased, lenders can interact with their bonds by redeeming or converting them.

### `Bond.redeem()`

After maturity, bonds holders have the option to call the `.redeem()` method to redeem their bonds. If the bond has been repayed, they burn their bonds in exchange for the rapyment token at a value of 1 bond to 1 repayment token.

If the bond has not been repaid and is in a defaulted state, bondholders are able to burn their bonds for a pro rata share of the collateralToken.

### `Bond.convert()`

Bondholders can burn their bonds in exchange for the collateralToken at any time before bond maturity at the predefined `convertRatio`
