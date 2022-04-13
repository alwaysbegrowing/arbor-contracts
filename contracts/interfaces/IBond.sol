// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IBond {
    /// @notice Operation restricted because the bond has matured.
    error BondPastMaturity();

    /// @notice Operation restricted because the bond has not matured or paid.
    error BondNotYetMaturedOrPaid();

    /// @notice Attempted to pay after payment was met.
    error PaymentMet();

    /// @notice Attempted to sweep a token used in the contract.
    error SweepDisallowedForToken();

    /// @notice Attempted to perform an action that would do nothing.
    error ZeroAmount();

    /// @notice Attempted to withdraw with no excess payment in the contract.
    error NoPaymentToWithdraw();

    /**
        @notice Emitted when Bond tokens are converted by a borrower.
        @param from The address converting their tokens.
        @param collateralToken The address of the collateralToken.
        @param amountOfBondsConverted The number of burnt Bonds.
        @param amountOfCollateralTokens The number of collateralTokens received.
    */
    event Convert(
        address indexed from,
        address indexed collateralToken,
        uint256 amountOfBondsConverted,
        uint256 amountOfCollateralTokens
    );

    /**
        @notice Emitted when collateral is withdrawn.
        @param from The address withdrawing the collateral.
        @param token The address of the collateralToken.
        @param amount The number of collateralTokens withdrawn.
    */
    event CollateralWithdraw(
        address indexed from,
        address indexed token,
        uint256 amount
    );

    /**
        @notice Emitted when a portion of the Bond's principal is paid.
        @param from The address depositing payment.
        @param amount Amount paid.
        @dev The amount could be incorrect if the token takes a fee on transfer. 
    */
    event Payment(address indexed from, uint256 amount);

    /**
        @notice Emitted when a Bond is redeemed.
        @param from The Bond holder whose Bonds are burnt.
        @param paymentToken The address of the paymentToken.
        @param collateralToken The address of the collateralToken.
        @param amountOfBondsRedeemed The amount of Bonds burned for redemption.
        @param amountOfPaymentTokensReceived The amount of paymentTokens.
        @param amountOfCollateralTokens The amount of collateralTokens.
    */
    event Redeem(
        address indexed from,
        address indexed paymentToken,
        address indexed collateralToken,
        uint256 amountOfBondsRedeemed,
        uint256 amountOfPaymentTokensReceived,
        uint256 amountOfCollateralTokens
    );

    /**
        @notice Emitted when payment over the required amount is withdrawn.
        @param from The caller withdrawing the excess payment amount.
        @param token The paymentToken being withdrawn.
        @param amount The amount of paymentToken withdrawn.
    */
    event ExcessPaymentWithdraw(
        address indexed from,
        address indexed token,
        uint256 amount
    );

    /**
        @notice Emitted when a token is swept by the contract owner.
        @param from The owner's address.
        @param token The token that was swept.
        @param amount The amount that was swept.
    */
    event TokenSweep(address from, IERC20Metadata token, uint256 amount);

    /**
        @notice The amount that was overpaid and can be withdrawn.
        @return overpayment Amount that was overpaid.
    */
    function amountOverPaid() external view returns (uint256 overpayment);

    /**
        @notice The amount of paymentTokens required to fully pay the contract.
        @return The amount of paymentTokens.
    */
    function amountOwed() external view returns (uint256);

    /**
        @notice The external balance of the ERC20 collateral token.
        @return The amount of collateralTokens in the contract.
    */
    function collateralBalance() external view returns (uint256);

    /**
        @notice The ratio of collateralTokens per Bond.
        @dev This amount is calculated as a deviation from 1-to-1 multiplied by
            the decimals of the collateralToken. See BondFactory's `CreateBond`.
        @return The number of tokens backing a Bond.
    */
    function collateralRatio() external view returns (uint256);

    /**
        @notice The ERC20 token used as collateral backing the bond.
        @return The ERC20 token's address.
    */
    function collateralToken() external view returns (address);

    /**
        @notice For convertible Bonds (ones with a convertibilityRatio > 0),
        the Bond holder may convert their bond to underlying collateral at the
        convertibleRatio. The bond must also have not past maturity
        for this to be possible.
        @param bonds The number of bonds which will be burnt and converted
            into the collateral at the convertibleRatio.
    */
    function convert(uint256 bonds) external;

    /**
        @notice The ratio of convertibleTokens the bonds will convert into.
        @dev This amount is calculated as a deviation from 1-to-1 multiplied by
            the decimals of the collateralToken. See BondFactory's `CreateBond`.
            The "convertibleTokens" are a subset of the collateralTokens, based
            on this ratio. If this ratio is 0, the bond is not convertible.
        @dev Number of tokens a Bond converts into.
    */
    function convertibleRatio() external view returns (uint256);

    /**
        @notice This one-time setup initiated by the BondFactory initializes the
            Bond with the given configuration.
        @dev New Bond contract deployed via clone. See `BondFactory`.
        @dev Not calling __AccessControl_init or __ERC20Burnable_init here since
            they currently generate an empty function.
        @param bondName Passed into the ERC20 token to define the name.
        @param bondSymbol Passed into the ERC20 token to define the symbol.
        @param owner Ownership of the created Bond is transferred to this
            address by way of DEFAULT_ADMIN_ROLE. The ability to withdraw is 
            given by WITHDRAW_ROLE, and tokens are minted to this address.
        @param _maturityDate The timestamp at which the Bond will mature.
        @param _paymentToken The ERC20 token address the Bond is redeemable for.
        @param _collateralToken The ERC20 token address the Bond is backed by.
        @param _collateralRatio The amount of collateral tokens per bond.
        @param _convertibleRatio The amount of convertible tokens per bond.
        @param maxSupply The amount of Bonds given to the owner during the one-
            time mint during this initialization.
    */
    function initialize(
        string memory bondName,
        string memory bondSymbol,
        address owner,
        uint256 _maturityDate,
        address _paymentToken,
        address _collateralToken,
        uint256 _collateralRatio,
        uint256 _convertibleRatio,
        uint256 maxSupply
    ) external;

    /**
        @notice Checks if the balance of payment token covers the Bond supply.
        @return Whether or not the Bond is fully paid.
    */
    function isFullyPaid() external view returns (bool);

    /**
        @notice Checks if the maturity date has passed.
        @return Whether or not the Bond has reached the maturity date.
    */
    function isMature() external view returns (bool);

    /**
        @notice A date set at Bond creation when the Bond will mature.
        @return The maturity date timestamp.
    */
    function maturityDate() external view returns (uint256);

    /**
        @notice Allows the issuer to pay the bond by depositing payment token.
        @dev Emits Payment event.
        @param amount The number of paymentTokens to deposit.
    */
    function pay(uint256 amount) external;

    /**
        @notice Gets the external balance of the ERC20 payment token.
        @return The number of paymentTokens in the contract.
    */
    function paymentBalance() external view returns (uint256);

    /**
        @notice This is the token the borrower deposits into the contract and
            what the Bond holders will receive when redeemed.
        @return The address of the token.
    */
    function paymentToken() external view returns (address);

    /**
        @notice Before maturity, if the given bonds are converted, this would be
            the number of collateralTokens received. This function rounds down
            the number of returned collateral.
        @param bonds The number of Bonds burnt and converted into collateral.
        @return The number of collateralTokens the Bonds will be converted into.
    */
    function previewConvertBeforeMaturity(uint256 bonds)
        external
        view
        returns (uint256);

    /**
        @notice At maturity, if the given bonds are redeemed, this would be the
            amount of collateralTokens and paymentTokens received. The number
            of paymentTokens to receive is rounded down.
        @param bonds The number of Bonds to burn and redeem for tokens.
        @return The number of paymentTokens to receive.
        @return The number of collateralTokens to receive.
    */
    function previewRedeemAtMaturity(uint256 bonds)
        external
        view
        returns (uint256, uint256);

    /** 
        @notice The amount of collateral that the issuer would be able to 
            withdraw from the contract. This function rounds up the number 
            of collateralTokens required in the contract and therefore may round
            down the amount received.
        @dev This function calculates the amount of collateralTokens that are
            able to be withdrawn by the issuer. The amount of tokens can
            increase when Bonds are burnt and converted as well when payment is
            made. Each Bond is covered by a certain amount of collateral to
            the collateralRatio. In addition to covering the collateralRatio,
            convertible Bonds (ones with a convertibleRatio greater than 0) must
            have enough convertibleTokens in the contract to the totalSupply of
            Bonds as well. That means even if all of the Bonds were covered by
            payment, there must still be enough collateral in the contract to
            cover the portion of collateral that would be required to convert
            the totalSupply of outstanding Bonds. At the maturity date, however,
            all collateral will be able to be withdrawn as the Bond would no
            longer be convertible.

            There are the following scenarios:
            bond IS paid AND mature (Paid)
                to cover collateralRatio: 0
                to cover convertibleRatio: 0

            bond IS paid AND NOT mature (PaidEarly)
                to cover collateralRatio: 0
                to cover convertibleRatio: totalSupply * convertibleRatio

            * totalUncoveredSupply: Bonds not covered by paymentTokens *

            bond is NOT paid AND NOT mature (Active)
                to cover collateralRatio: totalUncoveredSupply * collateralRatio
                to cover convertibleRatio: totalSupply * convertibleRatio

            bond is NOT paid AND mature (Defaulted)
                to cover collateralRatio: totalUncoveredSupply * collateralRatio
                to cover convertibleRatio: 0
        @return The number of collateralTokens received.
     */
    function previewWithdraw() external view returns (uint256);

    /**
        @notice The Bond holder can burn Bonds in return for their portion of
        paymentTokens and collateralTokens backing the Bonds. These portions of
        tokens depends on the number of paymentTokens deposited. When the Bond
        is fully paid, redemption will result in all paymentTokens. If the Bond
        has reached maturity without being fully paid, a portion of the
        collateralTokens will be availalbe.
        @dev Emits Redeem event.
        @param bonds The number of bonds to redeem and burn.
    */
    function redeem(uint256 bonds) external;

    /**
        @notice Sends tokens to the owner that are in this contract.
        @dev The collateralToken and paymentToken, cannot be swept.
        @param token The ERC20 token to sweep and send to the owner.
    */
    function sweep(IERC20Metadata token) external;

    /**
        @notice A caller with the WITHDRAW_ROLE may withdraw excess collateral
            from bond contract. The number of collateralTokens remaining in the
            contract must be enough to cover the total supply of Bonds in
            accordance to both the collateralRatio and convertibleRatio.
    */
    function withdrawExcessCollateral() external;

    /**
        @notice A caller with the WITHDRAW_ROLE can withdraw any overpaid
            payment token in the contract.
    */
    function withdrawExcessPayment() external;
}
