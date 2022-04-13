# Trust Model

There are a few different entities with different permissions in the porter protocol

## Porter admins can

- Control allow-list settings
- Grant and revoke issuer role to accounts

## Borrowers can

- Create bonds if added to allow-list
- Control permissions on the bond that they created
- Withdraw collateral
- Mint bonds
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
`BondFactory.isAllowListEnabled(bool)`

The Porter Admin can grant or revoke the `ISSUER_ROLE`, in addition to enabled or disabling the allow-list for creating new bonds. This toggling of the allow-list like adding or removing new issuers is not time-locked. However, this role has the ability to be revoked. Disabling the allow list then revoking this role would leave `BondFactory` in a fully permissionless state.

### Issuer - ISSUER_ROLE

There are initially 0 issuers. Issuers are granted this role by the Porter Admin.

Methods only callable by this role:
`BondFactory.createBond()`

If the allow-list is enabled - only addresses with this role can call the `createBond` method.

## BondToken

### Bond Admin

The bond admin is passed into the `BondFactory.createBond` method.

Methods only callable by this role:
`BondFactory.grantRole()`
`BondFactory.revokeRole()`

The bond admin is passed in as a parameter to the `createBond` method on `bondFactory`
The bond admin is able to grant or revoke the `WITHDRAW_ROLE` as well as the `MINT_ROLE`.

### WITHDRAW_ROLE

The bond admin is automatically granted this role upon the creation of the bond. Additional withdrawers can be added by the bond admin.

Methods only callable by this role:
`Bond.withdrawExcessCollateral()`
Only addresses with this role are able to withdraw bond collateral. This role will be used in the future to allow refinancing of loans.

### MINT_ROLE

The bond admin is automatically granted this role upon the creation of the bond. Additional minters can be added by the bond admin.

Methods only callable by this role:
`Bond.mint()`
Only addresses with this role are able to deposit collateral to mint bonds. This role will be used in the future to allow refinancing of loans.
