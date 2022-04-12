# IBondFactory







## Events


### AllowListEnabled


Emitted when the allow list is toggled on or off.







<table>

  <tr>
    <td>bool </td>
    <td>isAllowListEnabled</td>
    
    <td>
    The new state of the allow list.
    </td>
    
  </tr>

</table>



### BondCreated


Emitted when a new bond is created.







<table>

  <tr>
    <td>address </td>
    <td>newBond</td>
    
    <td>
    The address of the newley deployed bond.
    </td>
    
  </tr>

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
    <td>address <code>indexed</code></td>
    <td>owner</td>
    
    <td>
    Ownership of the created Bond is transferred to this address by way of DEFAULT_ADMIN_ROLE. The ability to withdraw is  given by WITHDRAW_ROLE, and tokens are minted to this address. See `initialize` in `Bond`.
    </td>
    
  </tr>

  <tr>
    <td>uint256 </td>
    <td>maturityDate</td>
    
    <td>
    The timestamp at which the Bond will mature.
    </td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
    <td>paymentToken</td>
    
    <td>
    The ERC20 token address the Bond is redeemable for.
    </td>
    
  </tr>

  <tr>
    <td>address <code>indexed</code></td>
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
    <td>maturityDate</td>
    
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



### isAllowListEnabled


```solidity
function isAllowListEnabled() external view returns (bool)

```

If enabled, issuance is restricted to those with ISSUER_ROLE.





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
      bool
    </td>
    
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
    If the allow list should be enabled or not.
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





