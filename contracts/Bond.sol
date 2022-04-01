// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {ERC20CappedUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";

import {ERC20BurnableUpgradeable, ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FixedPointMathLib} from "./utils/FixedPointMathLib.sol";

/**
    @title Bond
    @author Porter Finance
    @notice A custom ERC20 token that can be used to issue bonds.
    @notice The contract handles issuance, payment, conversion, and redemption of bonds.
    @dev External calls to tokens used for collateral and payment are used throughout to transfer and check balances
        there is risk that these tokens are malicious and each one should be carefully inspected before being trusted. 
    @dev does not inherit from ERC20Upgradeable or Initializable since ERC20BurnableUpgradeable and
        ERC20CappedUpgradeable inherit from them
*/
contract Bond is
    AccessControlUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20CappedUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20Metadata;
    using FixedPointMathLib for uint256;

    /**
        @notice A date in the future set at bond creation at which the bond will mature.
            Before this date, a bond token can be converted if convertible, but cannot be redeemed.
            Before this date, a bond token can be redeemed if the bond has been fully paid
            After this date, a bond token can be redeemed for the payment token, but cannot be converted.
    */
    uint256 public maturityDate;

    /**
        @notice The address of the ERC20 token this bond will be redeemable for at maturity
            which is paid by the borrower to unlock their collateral
    */
    address public paymentToken;

    /// @notice the address of the ERC20 token used as collateral backing the bond
    address public collateralToken;

    /**
        @notice the ratio of collateral tokens per bond with
        @dev this amount is expressed as a deviation from 1-to-1 (equal to 1e18)
            number of collateral tokens backing one bond
    */
    uint256 public collateralRatio;

    /**
        @notice the ratio of ERC20 tokens the bonds will convert into
        @dev this amount is expressed as a deviation from 1-to-1 (equal to 1e18)
             if this ratio is 0, the bond is not convertible.
             after maturity, the bond is not convertible
        @dev number of tokens one bond converts into
    */
    uint256 public convertibleRatio;

    /**
        @notice this role permits the withdraw of collateral from the contract
        @dev this is assigned to owner in `initialize`
            the owner can assign other addresses with this role to enable their withdraw
    */
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    /**
        @notice this role permits the minting of bonds
        @dev this is assigned to owner in `initialize`
            the owner can assign other addresses with this role to enable their minting
    */
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

    uint256 internal constant ONE = 1e18;

    /**
        @notice emitted when a collateral is deposited for a bond
        @param from the address depositing collateral
        @param token the address of the collateral token
        @param amount the number of the tokens deposited
    */
    event CollateralDeposit(
        address indexed from,
        address indexed token,
        uint256 amount
    );

    /**
        @notice emitted when bonds are minted
        @param from the address minting
        @param amount the amount of bonds minted
    */
    event Mint(address indexed from, uint256 amount);

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
        @param amount the amount of payment deposited
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

    /// @notice operation restricted because the bond has matured
    error BondPastMaturity();

    /// @notice operation restricted because the bond is not yet matured or paid
    error BondNotYetMaturedOrPaid();

    /// @notice maturity date is not valid
    error InvalidMaturityDate();

    /// @notice collateralRatio must be greater than convertibleRatio
    error CollateralRatioLessThanConvertibleRatio();

    /// @notice attempted to pay after payment was met
    error PaymentMet();

    /// @notice this bond has been paid so more bonds can not be minted
    error BondsCanNoLongerBeMinted();

    /// @notice attempted to sweep a token used in the contract
    error SweepDisallowedForToken();

    /// @notice attempted to perform an action that would do nothing
    error ZeroAmount();

    /// @notice unexpected amount returned on external token transfer
    error UnexpectedTokenOperation();

    /// @dev used to confirm the bond has not yet matured
    modifier beforeMaturity() {
        if (isMature()) {
            revert BondPastMaturity();
        }
        _;
    }

    /// @dev used to confirm that the maturity date has passed or the bond has been repaid
    modifier afterMaturityOrPaid() {
        if (!isMature() && !isFullyPaid()) {
            revert BondNotYetMaturedOrPaid();
        }
        _;
    }

    /// @dev used to confirm that the bond has not been fully paid
    modifier notFullyPaid() {
        if (isFullyPaid()) {
            revert BondsCanNoLongerBeMinted();
        }
        _;
    }

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
    ) external initializer {
        if (_collateralRatio < _convertibleRatio) {
            revert CollateralRatioLessThanConvertibleRatio();
        }
        if (
            _maturityDate <= block.timestamp ||
            _maturityDate > block.timestamp + 3650 days
        ) {
            revert InvalidMaturityDate();
        }

        __ERC20_init(bondName, bondSymbol);
        __ERC20Capped_init(maxSupply);

        maturityDate = _maturityDate;
        paymentToken = _paymentToken;
        collateralToken = _collateralToken;
        collateralRatio = _collateralRatio;
        convertibleRatio = _convertibleRatio;
        _computeScalingFactor(paymentToken);

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(WITHDRAW_ROLE, owner);
        _grantRole(MINT_ROLE, owner);
    }

    /**
        @notice mints the amount of specified bonds by transferring in collateral
        @dev Bonds to mint is capped by the ERC20CappedUpgradeable inherited contract
            Mint event is always emitted.
            CollateralDeposit is emitted unless the bond is uncollateralized and
            therefore requires no collateral to mint bonds.
        @param bonds the amount of bonds to mint
    */
    function mint(uint256 bonds)
        external
        onlyRole(MINT_ROLE)
        beforeMaturity
        notFullyPaid
        nonReentrant
    {
        uint256 collateralToDeposit = previewMintBeforeMaturity(bonds);

        _mint(_msgSender(), bonds);

        emit Mint(_msgSender(), bonds);

        if (collateralToDeposit > 0) {
            uint256 collateralDeposited = _safeTransferIn(
                IERC20Metadata(collateralToken),
                _msgSender(),
                collateralToDeposit
            );

            emit CollateralDeposit(
                _msgSender(),
                collateralToken,
                collateralDeposited
            );
        }
    }

    /**
        @notice Bond holder can convert their bond to underlying collateral at the convertible ratio
            The bond must be convertible and not past maturity
        @param bonds the number of bonds which will be burnt and converted into the collateral at the convertibleRatio
    */
    function convert(uint256 bonds) external nonReentrant beforeMaturity {
        uint256 collateralToSend = previewConvertBeforeMaturity(bonds);
        if (collateralToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        //  Reentrancy possibility: the bonds are already burnt - if there weren't enough bonds to burn, an error is thrown
        IERC20Metadata(collateralToken).safeTransfer(
            _msgSender(),
            collateralToSend
        );

        emit Convert(_msgSender(), collateralToken, bonds, collateralToSend);
    }

    /**
        @notice Withdraw collateral from bond contract
            the amount of collateral available to be withdrawn depends on the collateralRatio and the convertibleRatio
    */
    function withdrawCollateral()
        external
        nonReentrant
        onlyRole(WITHDRAW_ROLE)
    {
        uint256 collateralToSend = previewWithdraw();

        IERC20Metadata(collateralToken).safeTransfer(
            _msgSender(),
            collateralToSend
        );

        emit CollateralWithdraw(
            _msgSender(),
            collateralToken,
            collateralToSend
        );
    }

    /**
        @notice allows the issuer to pay the bond by transferring payment token
        @dev emits Payment event
        @param amount the number of payment tokens to pay
    */
    function pay(uint256 amount) external nonReentrant beforeMaturity {
        if (isFullyPaid()) {
            revert PaymentMet();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        // @audit-info
        // I'm not sure how we can fix this here. We could check that _upscale(totalPaid() + amount) >= totalSupply() but
        // that would break in the case of a token taking a fee.
        // maybe we don't care about reentrency for this method? I was trying to think through potential exploits here, and
        // if reentrency is exploited here what can they do? Just pay over the maximum amount?
        uint256 amountPaid = _safeTransferIn(
            IERC20Metadata(paymentToken),
            _msgSender(),
            amount
        );
        emit Payment(_msgSender(), amountPaid);
    }

    /**
        @notice this function burns bonds in return for the token borrowed against the bond
        @param bonds the amount of bonds to redeem and burn
    */
    function redeem(uint256 bonds) external nonReentrant afterMaturityOrPaid {
        // calculate amount before burning as the preview function uses totalSupply.
        (
            uint256 paymentTokensToSend,
            uint256 collateralTokensToSend
        ) = previewRedeemAtMaturity(bonds);

        if (paymentTokensToSend == 0 && collateralTokensToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        // reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
        if (paymentTokensToSend > 0) {
            IERC20Metadata(paymentToken).safeTransfer(
                _msgSender(),
                paymentTokensToSend
            );
        }
        if (collateralTokensToSend > 0) {
            // reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
            IERC20Metadata(collateralToken).safeTransfer(
                _msgSender(),
                collateralTokensToSend
            );
        }
        emit Redeem(
            _msgSender(),
            paymentToken,
            collateralToken,
            bonds,
            paymentTokensToSend,
            collateralTokensToSend
        );
    }

    /**
        @notice sends tokens to the issuer that were sent to this contract
        @dev collateral, payment, and the bond itself cannot be swept
        @param token send the entire token balance of this address to the owner
    */
    function sweep(IERC20Metadata token)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (
            address(token) == paymentToken ||
            address(token) == collateralToken
        ) {
            revert SweepDisallowedForToken();
        }
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    /**
        @notice preview the amount of collateral tokens required to mint the given bond tokens
        @dev this function rounds up the amount of required collateral for the number of bonds to mint
        @param bonds the amount of desired bonds to mint
        @return amount of collateral required
    */
    function previewMintBeforeMaturity(uint256 bonds)
        public
        view
        returns (uint256)
    {
        return bonds.mulDivUp(collateralRatio, ONE);
    }

    /**
      @notice the amount of collateral the given bonds would convert into if able
      @dev this function rounds down the number of returned collateral
      @param bonds the amount of bonds that would be burnt to convert into collateral
      @return amount of collateral received
    */
    function previewConvertBeforeMaturity(uint256 bonds)
        public
        view
        returns (uint256)
    {
        return bonds.mulDivDown(convertibleRatio, ONE);
    }

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

            bond IS paid AND mature
                to cover collateralRatio = 0
                to cover convertibleRatio = 0
            bond IS paid AND NOT mature
                to cover collateralRatio = 0 (bonds need not be backed by collateral)
                to cover convertibleRatio = total supply * convertibleRatio ratio

            bond is NOT paid AND NOT mature:
                to cover collateralRatio = total uncovered supply * collateralRatio
                to cover convertibleRatio = total supply * convertibleRatio
            bond is NOT paid AND mature
                to cover collateralRatio = total uncovered supply * collateralRatio
                to cover convertibleRatio = 0 (bonds cannot be converted)
            All outstanding bonds must be covered by the convertibleRatio
        @return the amount of collateral received
     */
    function previewWithdraw() public view returns (uint256) {
        uint256 tokensCoveredByPayment = _upscale(totalPaid());
        uint256 collateralTokensRequired;
        if (tokensCoveredByPayment >= totalSupply()) {
            collateralTokensRequired = 0;
        } else {
            collateralTokensRequired = (totalSupply() - tokensCoveredByPayment)
                .mulDivUp(collateralRatio, ONE);
        }

        uint256 convertibleTokensRequired = totalSupply().mulDivUp(
            convertibleRatio,
            ONE
        );

        uint256 totalRequiredCollateral;

        if (isFullyPaid()) {
            totalRequiredCollateral = isMature()
                ? 0
                : convertibleTokensRequired;
        } else {
            totalRequiredCollateral = convertibleTokensRequired >
                collateralTokensRequired
                ? convertibleTokensRequired
                : collateralTokensRequired;
        }

        if (totalRequiredCollateral >= totalCollateral()) {
            return 0;
        }

        return totalCollateral() - totalRequiredCollateral;
    }

    /**
        @notice the amount of collateral and payment tokens
            the bonds would redeem for at maturity
        @param bonds the amount of bonds to burn and redeem for tokens
        @return the amount of payment tokens to receive
        @return the amount of collateral tokens to receive
    */
    function previewRedeemAtMaturity(uint256 bonds)
        public
        view
        returns (uint256, uint256)
    {
        uint256 paidAmount = _upscale(totalPaid());
        if (isFullyPaid()) {
            paidAmount = totalSupply();
        }
        uint256 paymentTokensToSend = bonds.mulDivDown(
            totalPaid(),
            totalSupply()
        );

        uint256 nonPaidAmount = totalSupply() - paidAmount;
        uint256 collateralTokensToSend = collateralRatio.mulDivDown(
            bonds.mulDivDown(nonPaidAmount, totalSupply()),
            ONE
        );

        return (paymentTokensToSend, collateralTokensToSend);
    }

    /**
        @notice gets the external balance of the ERC20 payment token
        @return the amount of paymentTokens in the contract
    */
    function totalPaid() public view returns (uint256) {
        return IERC20Metadata(paymentToken).balanceOf(address(this));
    }

    /**
        @notice gets the external balance of the ERC20 collateral token
        @return the amount of collateralTokens in the contract
    */
    function totalCollateral() public view returns (uint256) {
        return IERC20Metadata(collateralToken).balanceOf(address(this));
    }

    /**
        @notice checks if the balance of payment token covers the bond supply
        @dev upscaling the token amount as there could be differing decimals
        @return whether or not the bond is fully paid
    */
    function isFullyPaid() public view returns (bool) {
        if (totalSupply() == 0) {
            return false;
        }
        return _upscale(totalPaid()) >= totalSupply();
    }

    /**
        @notice checks if the maturity date has passed (including current block timestamp)
        @return whether or not the bond has reached the maturity date
    */
    function isMature() public view returns (bool) {
        return block.timestamp >= maturityDate;
    }

    /**
        @notice the amount of payment tokens required to fully pay the contract
    */
    function amountOwed() public view returns (uint256) {
        uint256 amountUnpaid = totalSupply() - _upscale(totalPaid());
        return amountUnpaid.mulDivUp(ONE, _computeScalingFactor(paymentToken));
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20CappedUpgradeable, ERC20Upgradeable)
    {
        ERC20CappedUpgradeable._mint(to, amount);
    }

    /**
        @dev returns the balance of this contract before and after a transfer into it
            safeTransferFrom is used to revert on any non-success return from the transfer
            the actual delta of tokens is returned to keep accurate balance in the case where the token has a fee
        @param token the ERC20 token being transferred from
        @param from the sender
        @param value the total number of tokens being transferred
    */
    function _safeTransferIn(
        IERC20Metadata token,
        address from,
        uint256 value
    ) internal returns (uint256) {
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), value);

        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter <= balanceBefore) {
            revert UnexpectedTokenOperation();
        }
        return balanceAfter - balanceBefore;
    }

    /**
        @dev uses the decimals on the token to return a scale factor for the passed in token
            tokens that don't implement the `decimals` method are not supported.
            tokens with more than 18 decimals are not supported
        @param token the ERC20 token to compute
        @return scaler above a 1e18 base (1e<decimals> * 1e18)
    */
    function _computeScalingFactor(address token)
        internal
        view
        returns (uint256)
    {
        uint256 tokenDecimals = IERC20Metadata(token).decimals();

        if (tokenDecimals > 18) {
            revert UnexpectedTokenOperation();
        }
        uint256 decimalsDifference = 18 - tokenDecimals;
        return ONE * 10**decimalsDifference;
    }

    /**
        @dev this function takes the amount of paymentTokens and scales to bond
        tokens. Since the paymentToken may have different decimals than the 
        bond tokens, scaling to the same base allows calculations between them.
    */
    function _upscale(uint256 amount) internal view returns (uint256) {
        return amount.mulDivUp(_computeScalingFactor(paymentToken), ONE);
    }
}
