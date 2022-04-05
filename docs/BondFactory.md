# BondFactory

This factory contract issues new bond contracts


## Events

### AllowListEnabled

Emitted when the allow list is toggled on or off




<table>
  <tr>
    <td>bool </td>
    <td>isAllowListEnabled</td>
        <td>
    the new state of the allow list    </td>
      </tr>
</table>

### BondCreated

Emitted when a new bond is created




<table>
  <tr>
    <td>address </td>
    <td>newBond</td>
        <td>
    The address of the newley deployed bond Inherit createBond    </td>
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
* There must be more collateral tokens than convertible tokens



### DecimalsOver18
* Decimals with more than 18 digits are not supported



### InvalidDeposit
* fails if the collateral token takes a fee



### InvalidMaturityDate
* maturity date is not valid



### ZeroBondsToMint
* max bonds must be a positive number






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

the role required to issue bonds


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

Creates a bond

#### Parameters

<table>
  <tr>
    <td>string </td>
    <td>name</td>
        <td>
    Name of the bond    </td>
      </tr>
  <tr>
    <td>string </td>
    <td>symbol</td>
        <td>
    Ticker symbol for the bond    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>maturityDate</td>
        <td>
    Timestamp of when the bond matures    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>paymentToken</td>
        <td>
    Address of the token being paid    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>collateralToken</td>
        <td>
    Address of the collateral to use for the bond    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>collateralTokenAmount</td>
        <td>
    Number of all collateral tokens that the bonds will convert into    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>convertibleTokenAmount</td>
        <td>
    Number of the collateral token that all bonds will convert into    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    number of bonds to mint    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      address    </td>
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

when enabled, issuance is restricted to those with the ISSUER_ROLE


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

Check if a specific address is a porter bond created by this factory

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

Turns the allow list on or off

#### Parameters

<table>
  <tr>
    <td>bool </td>
    <td>_isAllowListEnabled</td>
        <td>
    If the allow list should be enabled or not    </td>
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

Address where the bond implementation contract is stored


#### Returns


<table>
  <tr>
    <td>
      address    </td>
      </tr>
</table>


