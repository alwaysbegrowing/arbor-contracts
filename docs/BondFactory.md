# BondFactory


This factory contract issues new bond contracts.




## Events


### BondCreated


Emitted when a new bond is created.







<table>

  <tr>
    <td>address </td>
    <td>newBond</td>
    
  </tr>

  <tr>
    <td>string </td>
    <td>name</td>
    
  </tr>

  <tr>
    <td>string </td>
    <td>symbol</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>owner</td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>maturity</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>paymentToken</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>collateralTokenAmount</td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>convertibleTokenAmount</td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>bonds</td>
    
  </tr>

</table>



### IssuerAllowListEnabled


Emitted when the restriction of bond creation to allow-listed accounts is toggled on or off.







<table>

  <tr>
    <td>bool </td>
    <td>isIssuerAllowListEnabled</td>
    
  </tr>

</table>



### RoleAdminChanged










<table>

  <tr>
    <td>bytes32 <code>indexed</code></td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>bytes32 <code>indexed</code></td>
    <td>previousAdminRole</td>
    
  </tr>

  <tr>
    <td>bytes32 <code>indexed</code></td>
    <td>newAdminRole</td>
    
  </tr>

</table>



### RoleGranted










<table>

  <tr>
    <td>bytes32 <code>indexed</code></td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>account</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>sender</td>
    
  </tr>

</table>



### RoleRevoked










<table>

  <tr>
    <td>bytes32 <code>indexed</code></td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>account</td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>sender</td>
    
  </tr>

</table>



### TokenAllowListEnabled


Emitted when the restriction of collateralToken and paymentToken to allow-listed tokens is toggled on or off.







<table>

  <tr>
    <td>bool </td>
    <td>isTokenAllowListEnabled</td>
    
  </tr>

</table>







## Errors


### CollateralTokenAmountLessThanConvertibleTokenAmount

* There must be more collateralTokens than convertibleTokens.







### InvalidDeposit

* Fails if the collateralToken takes a fee.







### InvalidMaturity

* Maturity date is not valid.







### TokensMustBeDifferent

* The paymentToken and collateralToken must be different.







### TooManyDecimals

* Decimals with more than 18 digits are not supported.







### ZeroBondsToMint

* Bonds must be minted during initialization.












## Methods



### ALLOWED_TOKEN


```solidity
function ALLOWED_TOKEN() external view returns (bytes32)

```

The role given to allowed tokens.





#### Returns


<table>

  <tr>
    <td>
      bytes32
    </td>
    
  </tr>

</table>



### DEFAULT_ADMIN_ROLE


```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)

```







#### Returns


<table>

  <tr>
    <td>
      bytes32
    </td>
    
  </tr>

</table>



### ISSUER_ROLE


```solidity
function ISSUER_ROLE() external view returns (bytes32)

```

The role required to issue bonds.





#### Returns


<table>

  <tr>
    <td>
      bytes32
    </td>
    
  </tr>

</table>



### createBond


```solidity
function createBond(string name, string symbol, uint256 maturity, address paymentToken, address collateralToken, uint256 collateralTokenAmount, uint256 convertibleTokenAmount, uint256 bonds) external nonpayable returns (address clone)

```

Creates a new Bond. The calculated ratios are rounded down.



#### Parameters

<table>

  <tr>
    <td>string </td>
    <td>name</td>
    
    <td>
    Passed into the ERC20 token to define the name.
    </td>
    
  </tr>

  <tr>
    <td>string </td>
    <td>symbol</td>
    
    <td>
    Passed into the ERC20 token to define the symbol.
    </td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>maturity</td>
    
    <td>
    The timestamp at which the Bond will mature.
    </td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>paymentToken</td>
    
    <td>
    The ERC20 token address the Bond is redeemable for.
    </td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>collateralToken</td>
    
    <td>
    The ERC20 token address the Bond is backed by.
    </td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>collateralTokenAmount</td>
    
    <td>
    The amount of collateral tokens per bond.
    </td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>convertibleTokenAmount</td>
    
    <td>
    The amount of convertible tokens per bond.
    </td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>bonds</td>
    
    <td>
    The amount of Bonds given to the owner during the one-time mint during the `Bond`&#39;s `initialize`.
    </td>
    
  </tr>

</table>



#### Returns


<table>

  <tr>
    <td>
      address
    </td>
    
    <td>
    The address of the newly created Bond.
    </td>
    
  </tr>

</table>



### getRoleAdmin


```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)

```





#### Parameters

<table>

  <tr>
    <td>bytes32 </td>
    <td>role</td>
    
  </tr>

</table>



#### Returns


<table>

  <tr>
    <td>
      bytes32
    </td>
    
  </tr>

</table>



### grantRole


```solidity
function grantRole(bytes32 role, address account) external nonpayable

```





#### Parameters

<table>

  <tr>
    <td>bytes32 </td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>account</td>
    
  </tr>

</table>





### hasRole


```solidity
function hasRole(bytes32 role, address account) external view returns (bool)

```





#### Parameters

<table>

  <tr>
    <td>bytes32 </td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>account</td>
    
  </tr>

</table>



#### Returns


<table>

  <tr>
    <td>
      bool
    </td>
    
  </tr>

</table>



### isBond


```solidity
function isBond(address) external view returns (bool)

```

Returns whether or not the given address key is a bond created by this Bond factory.



#### Parameters

<table>

  <tr>
    <td>address </td>
    <td>_0</td>
    
  </tr>

</table>



#### Returns


<table>

  <tr>
    <td>
      bool
    </td>
    
  </tr>

</table>



### isIssuerAllowListEnabled


```solidity
function isIssuerAllowListEnabled() external view returns (bool)

```

If enabled, issuance is restricted to those with ISSUER_ROLE.





#### Returns


<table>

  <tr>
    <td>
      bool
    </td>
    
    <td>
    isEnabled Whether or not the `ISSUER_ROLE` will be checked when creating new bonds.
    </td>
    
  </tr>

</table>



### isTokenAllowListEnabled


```solidity
function isTokenAllowListEnabled() external view returns (bool)

```

If enabled, tokens used as paymentToken and collateralToken are restricted to those with the ALLOWED_TOKEN role.





#### Returns


<table>

  <tr>
    <td>
      bool
    </td>
    
    <td>
    isEnabled Whether or not the collateralToken and paymentToken are checked for the `ALLOWED_TOKEN` role when creating new bonds.
    </td>
    
  </tr>

</table>



### renounceRole


```solidity
function renounceRole(bytes32 role, address account) external nonpayable

```





#### Parameters

<table>

  <tr>
    <td>bytes32 </td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>account</td>
    
  </tr>

</table>





### revokeRole


```solidity
function revokeRole(bytes32 role, address account) external nonpayable

```





#### Parameters

<table>

  <tr>
    <td>bytes32 </td>
    <td>role</td>
    
  </tr>

  <tr>
    <td>address </td>
    <td>account</td>
    
  </tr>

</table>





### setIsIssuerAllowListEnabled


```solidity
function setIsIssuerAllowListEnabled(bool _isIssuerAllowListEnabled) external nonpayable

```

Sets the state of bond restriction to allow-listed accounts.



#### Parameters

<table>

  <tr>
    <td>bool </td>
    <td>_isIssuerAllowListEnabled</td>
    
    <td>
    If the issuer allow list should be enabled or not.
    </td>
    
  </tr>

</table>





### setIsTokenAllowListEnabled


```solidity
function setIsTokenAllowListEnabled(bool _isTokenAllowListEnabled) external nonpayable

```

Sets the state of token restriction to the list of allowed tokens.



#### Parameters

<table>

  <tr>
    <td>bool </td>
    <td>_isTokenAllowListEnabled</td>
    
    <td>
    If the token allow list should be enabled or not.
    </td>
    
  </tr>

</table>





### supportsInterface


```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)

```





#### Parameters

<table>

  <tr>
    <td>bytes4 </td>
    <td>interfaceId</td>
    
  </tr>

</table>



#### Returns


<table>

  <tr>
    <td>
      bool
    </td>
    
  </tr>

</table>



### tokenImplementation


```solidity
function tokenImplementation() external view returns (address)

```

Address where the bond implementation contract is stored.





#### Returns


<table>

  <tr>
    <td>
      address
    </td>
    
    <td>
    The implementation address.
    </td>
    
  </tr>

</table>





