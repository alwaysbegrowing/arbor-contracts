# Trust Model

There are a few different entities with different permissions in the porter protocol

## Porter admins can

- Control allow-list settings
- Grant and revoke issuer role to accounts

## Borrowers can

- Create bonds if added to allow-list
- Transfer bond ownership
- Withdraw collateral
- Withdraw payment
- Sweep erc20 tokens sent to contract

## Anyone can

- Pay owed amount
- Convert bonds into collateral
- Redeem bonds for repayment amount + collateral

# Permissions implementation

## BondFactory

### Porter Admin

Owner of the bondfactory contract.

Method only callable by this role
`BondFactory.grantRole('ISSUER_ROLE')`
`BondFactory.revokeRole('ISSUER_ROLE)`
`BondFactory.isIssuerAllowListEnabled(bool)`

The Porter Admin can grant or revoke the `ISSUER_ROLE`, in addition to enabled or disabling the allow-list for creating new bonds. This toggling of the allow-list like adding or removing new issuers is not time-locked. However, this role has the ability to be revoked. Disabling the allow list then revoking this role would leave `BondFactory` in a fully permissionless state.

### Issuer - ISSUER_ROLE

There are initially 0 issuers. Issuers are granted this role by the Porter Admin.

Methods only callable by this role:
`BondFactory.createBond()`

If the allow-list is enabled - only addresses with this role can call the `createBond` method.

## BondToken

### Bond Owner

The bond admin is passed into the `BondFactory.createBond` method.

Methods only callable by this role:
`Bond.withdrawExcessCollateral()`
`Bond.withdrawExcessPayment()`
`Bond.sweep()`
`Bond.transferOwnership()`
`Bond.renounceOwnership()`
