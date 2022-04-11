// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Bond} from "../Bond.sol";

interface IBond {
    /// @notice operation restricted because the bond has matured
    error BondPastMaturity();

    /// @notice operation restricted because the bond is not yet matured or paid
    error BondNotYetMaturedOrPaid();

    /// @notice attempted to pay after payment was met
    error PaymentMet();

    /// @notice attempted to sweep a token used in the contract
    error SweepDisallowedForToken();

    /// @notice attempted to perform an action that would do nothing
    error ZeroAmount();

    /// @notice There is no excess payment in the contract that is avaliable to withdraw
    error NoPaymentToWithdraw();

    /**
        @notice emitted when bond tokens are converted by a borrower
        @param from the address converting their tokens
        @param collateralToken the address of the collateral received
        @param amountOfBondsConverted the number of burnt bonds
        @param amountOfCollateralTokens the number of collateral tokens received
    */
    event Convert(
        address indexed from,
        address indexed collateralToken,
        uint256 amountOfBondsConverted,
        uint256 amountOfCollateralTokens
    );

    /**
        @notice emitted when collateral is withdrawn
        @param from the address withdrawing collateral
        @param token the address of the collateral token
        @param amount the number of the tokens withdrawn
    */
    event CollateralWithdraw(
        address indexed from,
        address indexed token,
        uint256 amount
    );

    /**
        @notice emitted when a portion of the bond's principal is paid
        @param from the address depositing payment
        @param amount Amount paid. The amount could be incorrect if the payment token takes a fee on transfer. 
    */
    event Payment(address indexed from, uint256 amount);

    /**
        @notice emitted when a bond is redeemed
        @param from the bond holder whose bonds are burnt
        @param paymentToken the address of the payment token
        @param collateralToken the address of the collateral token
        @param amountOfBondsRedeemed the amount of bonds burned for redemption
        @param amountOfPaymentTokensReceived the amount of payment tokens
        @param amountOfCollateralTokens the amount of collateral tokens
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
        @notice emitted when payment over the required payment amount is withdrawn
        @param from the caller withdrawing the excessPaymentAmount
        @param token the paymentToken being withdrawn
        @param amount the amount of paymentToken withdrawn
    */
    event ExcessPaymentWithdraw(
        address indexed from,
        address indexed token,
        uint256 amount
    );

    /**
        @notice emitted when payment over the required payment amount is withdrawn
        @param from the caller who the tokens were sent to 
        @param token the token that was swept 
        @param amount the amount that was swept 
    */
    event TokenSweep(address from, IERC20Metadata token, uint256 amount);

    /**
        @notice gets the amount that was overpaid and can be withdrawn 
        @return overpayment amount that was overpaid 
    */
    function amountOverPaid() external view returns (uint256 overpayment);

    /**
        @notice the amount of payment tokens required to fully pay the contract
        @return the amount of payment tokens
    */
    function amountOwed() external view returns (uint256);

    /**
        @notice gets the external balance of the ERC20 collateral token
        @return the amount of collateralTokens in the contract
    */
    function collateralBalance() external view returns (uint256);

    /**
        @notice the ratio of collateral tokens per bond with
        @dev this amount is expressed as a deviation from 1-to-1 (equal to 1e18)
            number of collateral tokens backing one bond
    */
    function collateralRatio() external view returns (uint256);

    /// @notice the address of the ERC20 token used as collateral backing the bond
    function collateralToken() external view returns (address);

    /**
        @notice Bond holder can convert their bond to underlying collateral at the convertible ratio
            The bond must be convertible and not past maturity
        @param bonds the number of bonds which will be burnt and converted into the collateral at the convertibleRatio
    */
    function convert(uint256 bonds) external;

    /**
        @notice the ratio of ERC20 tokens the bonds will convert into
        @dev this amount is expressed as a deviation from 1-to-1 (equal to 1e18)
             if this ratio is 0, the bond is not convertible.
             after maturity, the bond is not convertible
        @dev number of tokens one bond converts into
    */
    function convertibleRatio() external view returns (uint256);

    /**
        @notice this function is called one time during initial bond creation and sets up the configuration for the bond
        @dev New bond contract deployed via clone
        @dev Not calling __AccessControl_init or __ERC20Burnable_init here because they currently generate an empty function 
        @param bondName passed into the ERC20 token
        @param bondSymbol passed into the ERC20 token
        @param owner ownership of this contract transferred to this address
        @param _maturityDate the timestamp at which the bond will mature
        @param _paymentToken the ERC20 token address the bond will be redeemable for at maturity
        @param _collateralToken the ERC20 token address for the bond
        @param _collateralRatio the amount of tokens per bond needed as collateral
        @param _convertibleRatio the amount of tokens per bond a convertible bond can be converted for
        @param maxSupply the amount of bonds to mint initially
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
        @notice checks if the balance of payment token covers the bond supply
        @dev upscaling the token amount as there could be differing decimals
        @return whether or not the bond is fully paid
    */
    function isFullyPaid() external view returns (bool);

    /**
        @notice checks if the maturity date has passed (including current block timestamp)
        @return whether or not the bond has reached the maturity date
    */
    function isMature() external view returns (bool);

    /**
        @notice A date in the future set at bond creation at which the bond will mature.
            Before this date, a bond token can be converted if convertible, but cannot be redeemed.
            Before this date, a bond token can be redeemed if the bond has been fully paid
            After this date, a bond token can be redeemed for the payment token, but cannot be converted.
    */
    function maturityDate() external view returns (uint256);

    /**
        @notice allows the issuer to pay the bond by transferring payment token
        @dev emits Payment event
        @param amount the number of payment tokens to pay
    */
    function pay(uint256 amount) external;

    /**
        @notice gets the external balance of the ERC20 payment token
        @return the amount of paymentTokens in the contract
    */
    function paymentBalance() external view returns (uint256);

    /**
        @notice The address of the ERC20 token this bond will be redeemable for at maturity
            which is paid by the borrower to unlock their collateral
    */
    function paymentToken() external view returns (address);

    /**
      @notice the amount of collateral the given bonds would convert into if able
      @dev this function rounds down the number of returned collateral
      @param bonds the amount of bonds that would be burnt to convert into collateral
      @return amount of collateral received
    */
    function previewConvertBeforeMaturity(uint256 bonds)
        external
        view
        returns (uint256);

    /**
        @notice the amount of collateral and payment tokens
            the bonds would redeem for at maturity
        @param bonds the amount of bonds to burn and redeem for tokens
        @return the amount of payment tokens to receive
        @return the amount of collateral tokens to receive
    */
    function previewRedeemAtMaturity(uint256 bonds)
        external
        view
        returns (uint256, uint256);

    /** 
        @notice the amount of collateral that the issuer would be able to 
            withdraw from the contract
        @dev this function calculates the amount of collateral tokens that are able to be withdrawn by the issuer.
            The amount of tokens can increase by bonds being burnt and converted as well as payment made.
            Each bond is covered by a certain amount of collateral to fulfill collateralRatio and convertibleRatio.
            For convertible bonds, the totalSupply of bonds must be covered by the convertibleRatio.
            That means even if all of the bonds were covered by payment, there must still be enough collateral
            in the contract to cover the outstanding bonds convertible until the maturity date -
            at which point all collateral will be able to be withdrawn.

        There are the following scenarios:
        "total uncovered supply" is the tokens that are not covered by the amount repaid.

            bond IS paid AND mature (Paid)
                to cover collateralRatio = 0
                to cover convertibleRatio = 0
            bond IS paid AND NOT mature (PaidEarly)
                to cover collateralRatio = 0 (bonds need not be backed by collateral)
                to cover convertibleRatio = total supply * convertibleRatio

            bond is NOT paid AND NOT mature (Active)
                to cover collateralRatio = total uncovered supply * collateralRatio
                to cover convertibleRatio = total supply * convertibleRatio
            bond is NOT paid AND mature (Defaulted)
                to cover collateralRatio = total uncovered supply * collateralRatio
                to cover convertibleRatio = 0 (bonds cannot be converted)
            All outstanding bonds must be covered by the convertibleRatio
        @return the amount of collateral received
     */
    function previewWithdraw() external view returns (uint256);

    /**
        @notice this function burns bonds in return for the token borrowed against the bond
        @param bonds the amount of bonds to redeem and burn
    */
    function redeem(uint256 bonds) external;

    /**
        @notice sends tokens to the issuer that were sent to this contract
        @dev collateral, payment, and the bond itself cannot be swept
        @param token send the entire token balance of this address to the owner
    */
    function sweep(IERC20Metadata token) external;

    /**
        @notice Withdraw collateral from bond contract
            the amount of collateral available to be withdrawn depends on the collateralRatio and the convertibleRatio
    */
    function withdrawCollateral() external;

    /**
        @notice withdraws any overpaid payment token 
    */
    function withdrawExcessPayment() external;
}
