# Permissions

There are a few different entities with different permissions in the porter protocol

# BondFactory 
## Porter Admin
Owner of the bondfactory contract.

Method only callable by this role
`BondFactory.grantRole('ISSUER_ROLE')`
`BondFactory.revokeRole('ISSUER_ROLE)`
`BondFactory.isAllowListEnabled(bool)`

The Porter Admin can grant or revoke the `ISSUER_ROLE`, in addition to enabled or disabling the allow-list for creating new bonds. 
This role has the ability to be revoked. Disabling the allow list then revoking this role would leave `BondFactory` in a fully permissionless state.

## Issuer - ISSUER_ROLE
There are initially 0 issuers. Issuers are granted this role by the Porter Admin. 

Methods only callable by this role:
`BondFactory.createBond()` 

If the allow-list is enabled - only addresses with this role can call the `createBond` method. 

# BondToken
## Bond Admin
The bond admin is passed into the `BondFactory.createBond` method. 

Methods only callable by this role:
`BondFactory.grantRole()`
`BondFactory.revokeRole()`

The bond admin is passed in as a parameter to the `createBond` method on `bondFactory`
The bond admin is able to grant or revoke the `WITHDRAW_ROLE`. 

## WITHDRAW_ROLE
The bond admin is automatically granted this role upon the creation of the bond. Additional withdrawers can be added by the bond admin.  

Methods only callable by this role:
`Bond.withdrawCollateral()` 
Only addresses with this role are able to withdraw bond collateral. This role will be used in the future to allow refinancing of loans. 

