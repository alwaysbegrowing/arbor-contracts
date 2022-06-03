# Trust Model

There are a few different entities with different permissions in the porter protocol

## Porter admins can

- Control allow-list settings
- Grant and revoke issuer role to accounts
- Add and remove paymentTokens and collateralTokens from allow-list

## Borrowers can

- Create bonds if added to allow-list
- Transfer bond ownership
- Withdraw collateral
- Withdraw payment
- Sweep ERC20 tokens sent to contract

## Bond Holders can

- Convert bonds into collateral
- Redeem bonds

## Anyone can

- Pay owed amount

# Permissions implementation

## BondFactory

### Porter Admin

Owner of the BondFactory contract.

Method only callable by this role:

`BondFactory.grantRole('ISSUER_ROLE')`
`BondFactory.revokeRole('ISSUER_ROLE)`
`BondFactory.setIsIssuerAllowListEnabled(bool)`
`BondFactory.grantRole('ALLOWED_TOKEN')`
`BondFactory.revokeRole('ALLOWED_TOKEN)`
`BondFactory.setIsTokenAllowListEnabled(bool)`

The Porter Admin can grant or revoke the `ISSUER_ROLE` & `ALLOWED_TOKEN` role, in addition to enabling or disabling the allow-list for creating new bonds or any tokens. This toggling of the allow lists is not time-locked. However, the admin role has the ability to be revoked. Disabling the allow lists then revoking this role would leave `BondFactory` in a fully un-reversible permissionless state.

### Issuer - ISSUER_ROLE

There are initially 0 issuers. Issuers are granted this role by the Porter Admin.

Methods only callable by this role:

`BondFactory.createBond()`

If the allow-list is enabled, only addresses with this role can call the `createBond` method.

## BondToken

### Bond Owner

The bond admin is passed into the `BondFactory.createBond()` method.

Methods only callable by this role:

`Bond.withdrawExcessCollateral()`
`Bond.withdrawExcessPayment()`  
`Bond.sweep()`  
`Bond.transferOwnership()`  
`Bond.renounceOwnership()`
