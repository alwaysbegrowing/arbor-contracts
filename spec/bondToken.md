# BondToken

A `bondToken` factory will create a new ERC20 `bondToken` for each auction that is initiated on our platform. We are currently exploring if we should use a regular factory, or a cloneFactory: https://github.com/porter-finance/v1-core/issues/15

### Methods

`redeemBond()` checks maturity date & bond standing - if it's past maturity date and the loan as been repayed then burn the bonds and send the repayment tokens to the address calling redeem() - maybe we follow the rocketpool method and calculate the % of total bond tokens a user holds, then allow them to claim that % amount of the total repayment tokens. once all bond tokens are redeemed (total remaining supply is zero), the bond standing will be updated to `REDEEMED`

`setBondStanding()` - emits an event of `BondStandingChange`. to be called by owner only after an auction ends and in various other situations

### State Variables

`currentBondStanding` - to be one of:

```js
  enum BondStanding {
    GOOD,
    DEFAULTED,
    PAID,
    REDEEMED
  }
```

`maturityDate` - due date for the DAO to repay its debt

### Events

```js
  event BondStandingChange(BondStanding oldStanding, BondStanding newStanding);
  event Redeem(address receiver, uint256 amount);
```

# BondToken Alternatives considered

Deploying the bondToken upon the completion of an auction.
