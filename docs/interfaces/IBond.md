# IBond




## Events

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

### ExcessPaymentWithdraw

emitted when payment over the required payment amount is withdrawn




<table>
  <tr>
    <td>address <code>indexed</code></td>
    <td>from</td>
        <td>
    the caller withdrawing the excessPaymentAmount    </td>
      </tr>
  <tr>
    <td>address <code>indexed</code></td>
    <td>token</td>
        <td>
    the paymentToken being withdrawn    </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    the amount of paymentToken withdrawn    </td>
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

### TokenSweep

emitted when payment over the required payment amount is withdrawn




<table>
  <tr>
    <td>address </td>
    <td>from</td>
        <td>
    the caller who the tokens were sent to     </td>
      </tr>
  <tr>
    <td>contract IERC20Metadata </td>
    <td>token</td>
        <td>
    the token that was swept     </td>
      </tr>
  <tr>
    <td>uint256 </td>
    <td>amount</td>
        <td>
    the amount that was swept     </td>
      </tr>
</table>



## Errors

### BondNotYetMaturedOrPaid
* operation restricted because the bond is not yet matured or paid



### BondPastMaturity
* operation restricted because the bond has matured



### NoPaymentToWithdraw
* There is no excess payment in the contract that is avaliable to withdraw



### PaymentMet
* attempted to pay after payment was met



### SweepDisallowedForToken
* attempted to sweep a token used in the contract



### ZeroAmount
* attempted to perform an action that would do nothing






## Methods


### amountOverPaid

```solidity
function amountOverPaid() external view returns (uint256 overpayment)
```

gets the amount that was overpaid and can be withdrawn 


#### Returns


<table>
  <tr>
    <td>
      uint256    </td>
        <td>
    amount that was overpaid     </td>
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
        <td>
    the amount of payment tokens    </td>
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
        <td>
    the amount of bonds to mint initially    </td>
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


### withdrawCollateral

```solidity
function withdrawCollateral() external nonpayable
```

Withdraw collateral from bond contract the amount of collateral available to be withdrawn depends on the collateralRatio and the convertibleRatio



### withdrawExcessPayment

```solidity
function withdrawExcessPayment() external nonpayable
```

withdraws any overpaid payment token 




