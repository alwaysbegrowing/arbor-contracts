# Bond

A custom ERC20 token that can be used to issue bonds.The contract handles issuance, payment, conversion, and redemption of bonds.


## Events

### Approval






<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>owner</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>spender</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>value</td>
      </tr>
</table>

### CollateralDeposit

emitted when a collateral is deposited for a bond




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the address depositing collateral    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
        <td>
    the address of the collateral token    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    the number of the tokens deposited    </td>
      </tr>
</table>

### CollateralWithdraw

emitted when collateral is withdrawn




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the address withdrawing collateral    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
        <td>
    the address of the collateral token    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    the number of the tokens withdrawn    </td>
      </tr>
</table>

### Convert

emitted when bond tokens are converted by a borrower




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the address converting their tokens    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
        <td>
    the address of the collateral received    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfBondsConverted</td>
        <td>
    the number of burnt bonds    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
        <td>
    the number of collateral tokens received    </td>
      </tr>
</table>

### Payment

emitted when a portion of the bond&#39;s principal is paid




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the address depositing payment    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    Amount paid. The amount could be incorrect if the payment token takes a fee on transfer.     </td>
      </tr>
</table>

### Redeem

emitted when a bond is redeemed




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the bond holder whose bonds are burnt    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>paymentToken</td>
        <td>
    the address of the payment token    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
        <td>
    the address of the collateral token    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfBondsRedeemed</td>
        <td>
    the amount of bonds burned for redemption    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfPaymentTokensReceived</td>
        <td>
    the amount of payment tokens    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
        <td>
    the amount of collateral tokens    </td>
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

### Transfer






<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>to</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>value</td>
      </tr>
</table>



## Errors

### BondNotYetMaturedOrPaid
* operation restricted because the bond is not yet matured or paid



### BondPastMaturity
* operation restricted because the bond has matured



### CollateralRatioLessThanConvertibleRatio
* collateralRatio must be greater than convertibleRatio



### DecimalsOver18
* Decimals with more than 18 digits are not supported



### InvalidMaturityDate
* maturity date is not valid



### PaymentMet
* attempted to pay after payment was met



### SweepDisallowedForToken
* attempted to sweep a token used in the contract



### ZeroAmount
* attempted to perform an action that would do nothing






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

### WITHDRAW_ROLE

```solidity
function WITHDRAW_ROLE() external view returns (bytes32)
```

this role permits the withdraw of collateral from the contract


#### Returns


<table>
  <tr>
    <td>
      bytes32    </td>
      </tr>
</table>

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>owner</td>
      </tr>
  <tr>
    <td>address </td>
    <td>spender</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### amountOwed

```solidity
function amountOwed() external view returns (uint256)
```

the amount of payment tokens required to fully pay the contract


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>spender</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      bool    </td>
      </tr>
</table>

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>account</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### burn

```solidity
function burn(uint256 amount) external nonpayable
```



#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>


### burnFrom

```solidity
function burnFrom(address account, uint256 amount) external nonpayable
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>account</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>


### collateralBalance

```solidity
function collateralBalance() external view returns (uint256)
```

gets the external balance of the ERC20 collateral token


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    the amount of collateralTokens in the contract    </td>
      </tr>
</table>

### collateralRatio

```solidity
function collateralRatio() external view returns (uint256)
```

the ratio of collateral tokens per bond with


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### collateralToken

```solidity
function collateralToken() external view returns (address)
```

the address of the ERC20 token used as collateral backing the bond


#### Returns


<table>
  <tr>
    <td>
      address    </td>
      </tr>
</table>

### convert

```solidity
function convert(uint256 bonds) external nonpayable
```

Bond holder can convert their bond to underlying collateral at the convertible ratio The bond must be convertible and not past maturity

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    the number of bonds which will be burnt and converted into the collateral at the convertibleRatio    </td>
      </tr>
</table>


### convertibleRatio

```solidity
function convertibleRatio() external view returns (uint256)
```

the ratio of ERC20 tokens the bonds will convert into


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### decimals

```solidity
function decimals() external view returns (uint8)
```




#### Returns


<table>
  <tr>
    <td>
      uint8    </td>
      </tr>
</table>

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external nonpayable returns (bool)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>spender</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>subtractedValue</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      bool    </td>
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

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external nonpayable returns (bool)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>spender</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>addedValue</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      bool    </td>
      </tr>
</table>

### initialize

```solidity
function initialize(string bondName, string bondSymbol, address owner, uint256 _maturityDate, address _paymentToken, address _collateralToken, uint256 _collateralRatio, uint256 _convertibleRatio, uint256 maxSupply) external nonpayable
```

this function is called one time during initial bond creation and sets up the configuration for the bond

#### Parameters

<table>
  <tr>
    <td>string </td>
    <td>bondName</td>
        <td>
    passed into the ERC20 token    </td>
      </tr>
  <tr>
    <td>string </td>
    <td>bondSymbol</td>
        <td>
    passed into the ERC20 token    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>owner</td>
        <td>
    ownership of this contract transferred to this address    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_maturityDate</td>
        <td>
    the timestamp at which the bond will mature    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>_paymentToken</td>
        <td>
    the ERC20 token address the bond will be redeemable for at maturity    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>_collateralToken</td>
        <td>
    the ERC20 token address for the bond    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_collateralRatio</td>
        <td>
    the amount of tokens per bond needed as collateral    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_convertibleRatio</td>
        <td>
    the amount of tokens per bond a convertible bond can be converted for    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>maxSupply</td>
      </tr>
</table>


### isFullyPaid

```solidity
function isFullyPaid() external view returns (bool)
```

checks if the balance of payment token covers the bond supply


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
        <td>
    whether or not the bond is fully paid    </td>
      </tr>
</table>

### isMature

```solidity
function isMature() external view returns (bool)
```

checks if the maturity date has passed (including current block timestamp)


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
        <td>
    whether or not the bond has reached the maturity date    </td>
      </tr>
</table>

### maturityDate

```solidity
function maturityDate() external view returns (uint256)
```

A date in the future set at bond creation at which the bond will mature. Before this date, a bond token can be converted if convertible, but cannot be redeemed. Before this date, a bond token can be redeemed if the bond has been fully paid After this date, a bond token can be redeemed for the payment token, but cannot be converted.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### name

```solidity
function name() external view returns (string)
```




#### Returns


<table>
  <tr>
    <td>
      string    </td>
      </tr>
</table>

### pay

```solidity
function pay(uint256 amount) external nonpayable
```

allows the issuer to pay the bond by transferring payment token

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    the number of payment tokens to pay    </td>
      </tr>
</table>


### paymentBalance

```solidity
function paymentBalance() external view returns (uint256)
```

gets the external balance of the ERC20 payment token


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    the amount of paymentTokens in the contract    </td>
      </tr>
</table>

### paymentToken

```solidity
function paymentToken() external view returns (address)
```

The address of the ERC20 token this bond will be redeemable for at maturity which is paid by the borrower to unlock their collateral


#### Returns


<table>
  <tr>
    <td>
      address    </td>
      </tr>
</table>

### previewConvertBeforeMaturity

```solidity
function previewConvertBeforeMaturity(uint256 bonds) external view returns (uint256)
```

the amount of collateral the given bonds would convert into if able

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    the amount of bonds that would be burnt to convert into collateral    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    amount of collateral received    </td>
      </tr>
</table>

### previewRedeemAtMaturity

```solidity
function previewRedeemAtMaturity(uint256 bonds) external view returns (uint256, uint256)
```

the amount of collateral and payment tokens the bonds would redeem for at maturity

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    the amount of bonds to burn and redeem for tokens    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    the amount of payment tokens to receive    </td>
      </tr>
  <tr>
    <td>
      uint256    </td>
        <td>
    the amount of collateral tokens to receive    </td>
      </tr>
</table>

### previewWithdraw

```solidity
function previewWithdraw() external view returns (uint256)
```

the amount of collateral that the issuer would be able to  withdraw from the contract


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    the amount of collateral received    </td>
      </tr>
</table>

### redeem

```solidity
function redeem(uint256 bonds) external nonpayable
```

this function burns bonds in return for the token borrowed against the bond

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    the amount of bonds to redeem and burn    </td>
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

### sweep

```solidity
function sweep(contract IERC20Metadata token) external nonpayable
```

sends tokens to the issuer that were sent to this contract

#### Parameters

<table>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>token</td>
        <td>
    send the entire token balance of this address to the owner    </td>
      </tr>
</table>


### symbol

```solidity
function symbol() external view returns (string)
```




#### Returns


<table>
  <tr>
    <td>
      string    </td>
      </tr>
</table>

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```




#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### transfer

```solidity
function transfer(address to, uint256 amount) external nonpayable returns (bool)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>to</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      bool    </td>
      </tr>
</table>

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) external nonpayable returns (bool)
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>from</td>
      </tr>
  <tr>
    <td>address </td>
    <td>to</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      bool    </td>
      </tr>
</table>

### withdrawCollateral

```solidity
function withdrawCollateral() external nonpayable
```

Withdraw collateral from bond contract the amount of collateral available to be withdrawn depends on the collateralRatio and the convertibleRatio




