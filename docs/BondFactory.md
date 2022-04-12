# BondFactory

This factory contract issues new bond contracts.


## Events

### AllowListEnabled

Emitted when the allow list is toggled on or off.




<table>
  <tr>
    <td>bool </td>
    <td>isAllowListEnabled</td>
      </tr>
</table>

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
    <td>maturityDate</td>
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



## Errors

### CollateralTokenAmountLessThanConvertibleTokenAmount
* There must be more collateralTokens than convertibleTokens.



### DecimalsOver18
* Decimals with more than 18 digits are not supported.



### InvalidDeposit
* Fails if the collateralToken takes a fee.



### InvalidMaturityDate
* Maturity date is not valid.



### TokensMustBeDifferent
* The paymentToken and collateralToken must be different.



### ZeroBondsToMint
* Bonds must be minted during initialization.






## Methods


### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```




#### Returns


<table>
  <tr>
    <td>
      bytes32    </td>
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
      bytes32    </td>
      </tr>
</table>

### createBond

```solidity
function createBond(string name, string symbol, uint256 maturityDate, address paymentToken, address collateralToken, uint256 collateralTokenAmount, uint256 convertibleTokenAmount, uint256 bonds) external nonpayable returns (address clone)
```

Creates a new Bond.

#### Parameters

<table>
  <tr>
    <td>string </td>
    <td>name</td>
        <td>
    Passed into the ERC20 token to define the name.    </td>
      </tr>
  <tr>
    <td>string </td>
    <td>symbol</td>
        <td>
    Passed into the ERC20 token to define the symbol.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>maturityDate</td>
        <td>
    The timestamp at which the Bond will mature.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>paymentToken</td>
        <td>
    The ERC20 token address the Bond is redeemable for.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>collateralToken</td>
        <td>
    The ERC20 token address the Bond is backed by.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>collateralTokenAmount</td>
        <td>
    The amount of collateral tokens per bond.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>convertibleTokenAmount</td>
        <td>
    The amount of convertible tokens per bond.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The amount of Bonds given to the owner during the one-time mint during the `Bond`&#39;s `initialize`.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      address    </td>
        <td>
    The address of the newly created Bond.    </td>
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
      bytes32    </td>
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
      bool    </td>
      </tr>
</table>

### isAllowListEnabled

```solidity
function isAllowListEnabled() external view returns (bool)
```

If enabled, issuance is restricted to those with ISSUER_ROLE.


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
      </tr>
</table>

### isBond

```solidity
function isBond(address) external view returns (bool)
```

Check if the address was created by this Bond factory.

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
      bool    </td>
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


### setIsAllowListEnabled

```solidity
function setIsAllowListEnabled(bool _isAllowListEnabled) external nonpayable
```

Turns the allow list on or off.

#### Parameters

<table>
  <tr>
    <td>bool </td>
    <td>_isAllowListEnabled</td>
        <td>
    If the allow list should be enabled or not.    </td>
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
      bool    </td>
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
      address    </td>
        <td>
    The implementation address.    </td>
      </tr>
</table>


