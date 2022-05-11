# IBond




## Events

### CollateralWithdraw

Emitted when collateral is withdrawn.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    The address withdrawing the collateralTokens.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
        <td>
    The address receiving the collateralTokens.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
        <td>
    The address of the collateralToken.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The number of collateralTokens withdrawn.    </td>
      </tr>
</table>

### Convert

Emitted when bond shares are converted by a Bond holder.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    The address converting their tokens.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
        <td>
    The address of the collateralToken.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfBondsConverted</td>
        <td>
    The number of burnt bond shares.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
        <td>
    The number of collateralTokens received.    </td>
      </tr>
</table>

### ExcessPaymentWithdraw

Emitted when payment over the required amount is withdrawn.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    The caller withdrawing the excess payment amount.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
        <td>
    The address receiving the paymentTokens.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
        <td>
    The address of the paymentToken being withdrawn.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The amount of paymentToken withdrawn.    </td>
      </tr>
</table>

### Payment

Emitted when a portion of the Bond&#39;s principal is paid.

*The amount could be incorrect if the token takes a fee on transfer. *


<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    The address depositing payment.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    Amount paid.    </td>
      </tr>
</table>

### Redeem

Emitted when a bond share is redeemed.




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    The Bond holder whose bond shares are burnt.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>paymentToken</td>
        <td>
    The address of the paymentToken.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>collateralToken</td>
        <td>
    The address of the collateralToken.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfBondsRedeemed</td>
        <td>
    The number of bond shares burned for redemption.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfPaymentTokensReceived</td>
        <td>
    The number of paymentTokens.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amountOfCollateralTokens</td>
        <td>
    The number of collateralTokens.    </td>
      </tr>
</table>

### TokenSweep

Emitted when a token is swept by the contract owner.




<table>
  <tr>
    <td>address </td>
    <td>from</td>
        <td>
    The owner&#39;s address.    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>receiver</td>
        <td>
    The address receiving the swept tokens.    </td>
      </tr>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>token</td>
        <td>
    The address of the token that was swept.    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The number of tokens swept.    </td>
      </tr>
</table>



## Errors


### BondBeforeGracePeriodAndNotPaid

* Bond redemption is impossible because the grace period has not yet passed and the bond has not been fully paid.




### BondPastMaturity
* Operation restricted because the Bond has matured.



### NoPaymentToWithdraw
* Attempted to withdraw with no excess payment in the contract.



### NotEnoughCollateral
* Attempted to withdraw more collateral than available.



### PaymentAlreadyMet
* Attempted to pay after payment was met.



### SweepDisallowedForToken
* Attempted to sweep a token used in the contract.



### ZeroAmount
* Attempted to perform an action that would do nothing.






## Methods


### amountUnpaid

```solidity
function amountUnpaid() external view returns (uint256 paymentTokens)
```

The amount of paymentTokens required to fully pay the contract.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of paymentTokens unpaid.    </td>
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
    The number of collateralTokens in the contract.    </td>
      </tr>
</table>

### collateralRatio

```solidity
function collateralRatio() external view returns (uint256)
```

The number of collateralTokens per Bond.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens per Bond.    </td>
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
    The collateralToken&#39;s address.    </td>
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

The number of convertibleTokens the bonds will convert into.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of convertibleTokens per Bond.    </td>
      </tr>
</table>

### gracePeriodEnd

```solidity
function gracePeriodEnd() external view returns (uint256 gracePeriodEndTimestamp)
```

One week after the maturity date. Bond collateral can be  redeemed after this date.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The grace period end date as  a timestamp. This is always one week after the maturity date    </td>
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
        <td>
    Ownership of the created Bond is transferred to this address by way of _transferOwnership and also the address that tokens are minted to. See `initialize` in `Bond`.    </td>
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


### isMature

```solidity
function isMature() external view returns (bool isBondMature)
```

Checks if the maturity timestamp has passed.


#### Returns


<table>
  <tr>
    <td>
      bool    </td>
        <td>
    Whether or not the Bond has reached maturity.    </td>
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
    The maturity date as a timestamp.    </td>
      </tr>
</table>

### pay

```solidity
function pay(uint256 amount) external nonpayable
```

Allows the owner to pay the bond by depositing paymentTokens.

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

Gets the external balance of the ERC20 paymentToken.


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
    The number of bond shares burnt and converted into collateralTokens.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens the Bonds would be converted into.    </td>
      </tr>
</table>

### previewRedeemAtMaturity

```solidity
function previewRedeemAtMaturity(uint256 bonds) external view returns (uint256 paymentTokensToSend, uint256 collateralTokensToSend)
```

At maturity, if the given bond shares are redeemed, this would be the number of collateralTokens and paymentTokens received by the bond holder. The number of paymentTokens to receive is rounded down.

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
    The number of paymentTokens that the bond shares would be redeemed for.    </td>
      </tr>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens that would be redeemed for.    </td>
      </tr>
</table>

### previewWithdrawExcessCollateral

```solidity
function previewWithdrawExcessCollateral() external view returns (uint256 collateralTokens)
```

The number of collateralTokens that the owner would be able to  withdraw from the contract. This does not take into account an amount of payment like `previewWithdrawExcessCollateralAfterPayment` does. See that function for more information.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens that would be withdrawn.    </td>
      </tr>
</table>

### previewWithdrawExcessCollateralAfterPayment

```solidity
function previewWithdrawExcessCollateralAfterPayment(uint256 payment) external view returns (uint256 collateralTokens)
```

The number of collateralTokens that the owner would be able to  withdraw from the contract. This function rounds up the number  of collateralTokens required in the contract and therefore may round down the amount received.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>payment</td>
        <td>
    The number of paymentTokens to add when previewing a withdraw.    </td>
      </tr>
</table>

#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of collateralTokens that would be withdrawn.    </td>
      </tr>
</table>

### previewWithdrawExcessPayment

```solidity
function previewWithdrawExcessPayment() external view returns (uint256 paymentTokens)
```

The number of excess paymentTokens that the owner would be able to withdraw from the contract.


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    The number of paymentTokens that would be withdrawn.    </td>
      </tr>
</table>

### redeem

```solidity
function redeem(uint256 bonds) external nonpayable
```

The Bond holder can burn bond shares in return for their portion of paymentTokens and collateralTokens backing the Bonds. These portions of tokens depends on the number of paymentTokens deposited. When the Bond is fully paid, redemption will result in all  paymentTokens. If the Bond has reached maturity without being fully paid, a portion of the collateralTokens will be available.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>bonds</td>
        <td>
    The number of bond shares to redeem and burn.    </td>
      </tr>
</table>


### sweep

```solidity
function sweep(contract IERC20Metadata sweepingToken, address receiver) external nonpayable
```

Sends ERC20 tokens to the owner that are in this contract.

#### Parameters

<table>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>sweepingToken</td>
        <td>
    The ERC20 token to sweep and send to the receiver.    </td>
      </tr>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address that is transferred the swept token.    </td>
      </tr>
</table>


### withdrawExcessCollateral

```solidity
function withdrawExcessCollateral(uint256 amount, address receiver) external nonpayable
```

The Owner may withdraw excess collateral from the Bond contract. The number of collateralTokens remaining in the contract must be enough to cover the total supply of Bonds in accordance to both the collateralRatio and convertibleRatio.

#### Parameters

<table>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    The number of collateralTokens to withdraw. Reverts if the amount is greater than available in the contract.     </td>
      </tr>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address transferred the excess collateralTokens.    </td>
      </tr>
</table>


### withdrawExcessPayment

```solidity
function withdrawExcessPayment(address receiver) external nonpayable
```

The owner can withdraw any excess paymentToken in the contract.

#### Parameters

<table>
  <tr>
    <td>address </td>
    <td>receiver</td>
        <td>
    The address that is transferred the excess paymentToken.    </td>
      </tr>
</table>



