# Bond

A custom ERC20 token that can be used to issue bonds.The contract handles issuance, payment, conversion, and redemption.


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

### CollateralWithdraw

Emitted when collateral is withdrawn.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

### Convert

Emitted when bond shares are converted by a lender.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfBondsConverted</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
      </tr>
</table>

### ExcessPaymentWithdraw

Emitted when payment over the required amount is withdrawn.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

### OwnershipTransferred






<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>previousOwner</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>newOwner</td>
      </tr>
</table>

### Payment

Emitted when a portion of the Bond&#39;s principal is paid.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
      </tr>
</table>

### Redeem

Emitted when a Bond is redeemed.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
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
    <td>amountOfBondsRedeemed</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfPaymentTokensReceived</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
      </tr>
</table>

### TokenSweep

Emitted when a token is swept by the contract owner.




<table>
  <tr>
    <td>address </td>
    <td>from</td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
      </tr>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>token</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
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
* Operation restricted because the bond has not matured or paid.



### BondPastMaturity
* Operation restricted because the bond has matured.



### NoPaymentToWithdraw
* Attempted to withdraw with no excess payment in the contract.



### NotEnoughCollateral
* Attempted to withdraw more collateral than avaliable



### PaymentAlreadyMet
* Attempted to pay after payment was met.



### SweepDisallowedForToken
* Attempted to sweep a token used in the contract.



### ZeroAmount
* Attempted to perform an action that would do nothing.






## Methods


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

### amountOverPaid

```solidity
function amountOverPaid() external view returns (uint256 overpayment)
```

The amount that was overpaid and can be withdrawn.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    Amount that was overpaid.    </td>
      </tr>
</table>

### amountOwed

```solidity
function amountOwed() external view returns (uint256 amountUnpaid)
```

The amount of paymentTokens required to fully pay the contract.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The amount of paymentTokens.    </td>
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
function collateralBalance() external view returns (uint256 collateralTokens)
```

The external balance of the ERC20 collateral token.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The amount of collateralTokens in the contract.    </td>
      </tr>
</table>

### collateralRatio

```solidity
function collateralRatio() external view returns (uint256)
```

The ratio of collateralTokens per Bond.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of tokens backing a Bond.    </td>
      </tr>
</table>

### collateralToken

```solidity
function collateralToken() external view returns (address)
```

The ERC20 token used as collateral backing the bond.


#### Returns


<table>
  <tr>
    <td>
      address    </td>
        <td>
    The ERC20 token&#39;s address.    </td>
      </tr>
</table>

### convert

```solidity
function convert(uint256 bonds) external nonpayable
```

For convertible Bonds (ones with a convertibilityRatio &gt; 0), the Bond holder may convert their bond to underlying collateral at the convertibleRatio. The bond must also have not past maturity for this to be possible.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The number of bonds which will be burnt and converted into the collateral at the convertibleRatio.    </td>
      </tr>
</table>


### convertibleRatio

```solidity
function convertibleRatio() external view returns (uint256)
```

The ratio of convertibleTokens the bonds will convert into.


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
function initialize(string bondName, string bondSymbol, address bondOwner, uint256 _maturity, address _paymentToken, address _collateralToken, uint256 _collateralRatio, uint256 _convertibleRatio, uint256 maxSupply) external nonpayable
```

This one-time setup initiated by the BondFactory initializes the Bond with the given configuration.

#### Parameters

<table>
  <tr>
    <td>string </td>
    <td>bondName</td>
        <td>
    Passed into the ERC20 token to define the name.    </td>
      </tr>
  <tr>
    <td>string </td>
    <td>bondSymbol</td>
        <td>
    Passed into the ERC20 token to define the symbol.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>bondOwner</td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_maturity</td>
        <td>
    The timestamp at which the Bond will mature.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>_paymentToken</td>
        <td>
    The ERC20 token address the Bond is redeemable for.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>_collateralToken</td>
        <td>
    The ERC20 token address the Bond is backed by.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_collateralRatio</td>
        <td>
    The amount of collateral tokens per bond.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>_convertibleRatio</td>
        <td>
    The amount of convertible tokens per bond.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>maxSupply</td>
        <td>
    The amount of Bonds given to the owner during the one- time mint during this initialization.    </td>
      </tr>
</table>


### isFullyPaid

```solidity
function isFullyPaid() external view returns (bool isPaid)
```

Checks if the balance of payment token covers the Bond supply.


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
        <td>
    Whether or not the Bond is fully paid.    </td>
      </tr>
</table>

### isMature

```solidity
function isMature() external view returns (bool isBondMature)
```

Checks if the maturity date has passed.


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
        <td>
    Whether or not the Bond has reached the maturity date.    </td>
      </tr>
</table>

### maturity

```solidity
function maturity() external view returns (uint256)
```

A date set at Bond creation when the Bond will mature.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The maturity date timestamp.    </td>
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

### owner

```solidity
function owner() external view returns (address)
```




#### Returns


<table>
  <tr>
    <td>
      address    </td>
      </tr>
</table>

### pay

```solidity
function pay(uint256 amount) external nonpayable
```

Allows the issuer to pay the bond by depositing payment token.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The number of paymentTokens to deposit.    </td>
      </tr>
</table>


### paymentBalance

```solidity
function paymentBalance() external view returns (uint256 paymentTokens)
```

Gets the external balance of the ERC20 payment token.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of paymentTokens in the contract.    </td>
      </tr>
</table>

### paymentToken

```solidity
function paymentToken() external view returns (address)
```

This is the token the borrower deposits into the contract and what the Bond holders will receive when redeemed.


#### Returns


<table>
  <tr>
    <td>
      address    </td>
        <td>
    The address of the token.    </td>
      </tr>
</table>

### previewConvertBeforeMaturity

```solidity
function previewConvertBeforeMaturity(uint256 bonds) external view returns (uint256 collateralTokens)
```

Before maturity, if the given bonds are converted, this would be the number of collateralTokens received. This function rounds down the number of returned collateral.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The number of Bonds burnt and converted into collateral.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens the Bonds will be converted into.    </td>
      </tr>
</table>

### previewRedeemAtMaturity

```solidity
function previewRedeemAtMaturity(uint256 bonds) external view returns (uint256 paymentTokensToSend, uint256 collateralTokensToSend)
```

At maturity, if the given bonds are redeemed, this would be the amount of collateralTokens and paymentTokens received. The number of paymentTokens to receive is rounded down.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The number of Bonds to burn and redeem for tokens.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of paymentTokens to receive.    </td>
      </tr>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens to receive.    </td>
      </tr>
</table>

### previewWithdraw

```solidity
function previewWithdraw() external view returns (uint256 collateralTokens)
```




#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
      </tr>
</table>

### previewWithdrawAfterPayment

```solidity
function previewWithdrawAfterPayment(uint256 payment) external view returns (uint256 collateralTokens)
```

The amount of collateral that the issuer would be able to  withdraw from the contract. This function rounds up the number  of collateralTokens required in the contract and therefore may round down the amount received.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>payment</td>
        <td>
    The amount of paymentToken to add when previewing a withdraw.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens received.    </td>
      </tr>
</table>

### redeem

```solidity
function redeem(uint256 bonds) external nonpayable
```

The Bond holder can burn Bonds in return for their portion of paymentTokens and collateralTokens backing the Bonds. These portions of tokens depends on the number of paymentTokens deposited. When the Bond is fully paid, redemption will result in all paymentTokens. If the Bond has reached maturity without being fully paid, a portion of the collateralTokens will be availalbe.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The number of bonds to redeem and burn.    </td>
      </tr>
</table>


### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```





### sweep

```solidity
function sweep(contract IERC20Metadata sweepingToken, address receiver) external nonpayable
```

Sends tokens to the owner that are in this contract.

#### Parameters

<table>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>sweepingToken</td>
      </tr>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address that is transferred the swept token.    </td>
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

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>newOwner</td>
      </tr>
</table>


### withdrawExcessCollateral

```solidity
function withdrawExcessCollateral(uint256 amount, address receiver) external nonpayable
```

The Owner may withdraw excess collateral from bond contract. The number of collateralTokens remaining in the contract must be enough to cover the total supply of Bonds in accordance to both the collateralRatio and convertibleRatio.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The amount of collateral to withdraw. Reverts if this number is greater than avaliable.     </td>
      </tr>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address that is transferred the excess collateral.    </td>
      </tr>
</table>


### withdrawExcessPayment

```solidity
function withdrawExcessPayment(address receiver) external nonpayable
```

The Owner can withdraw any overpaid payment token in the contract.

#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address that is transferred the excess payment.    </td>
      </tr>
</table>



