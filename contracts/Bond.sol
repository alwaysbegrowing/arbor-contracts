// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IBond} from "./interfaces/IBond.sol";

import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {FixedPointMathLib} from "./utils/FixedPointMathLib.sol";

/**
    @title Bond
    @author Porter Finance
    @notice A custom ERC20 token that can be used to issue bonds.
    @notice The contract handles issuance, payment, conversion, and redemption.
    @dev External calls to tokens used for collateral and payment are used
        throughout to transfer and check balances. There is risk that these
        are non-standard and should be carefully inspected before being trusted. 
    @dev Does not inherit from ERC20Upgradeable or Initializable since
        ERC20BurnableUpgradeable inherits from them.
*/
contract Bond is
    IBond,
    OwnableUpgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20Metadata;

    using FixedPointMathLib for uint256;

    /// @inheritdoc IBond
    uint256 public maturity;

    /// @inheritdoc IBond
    address public paymentToken;

    /// @inheritdoc IBond
    address public collateralToken;

    /// @inheritdoc IBond
    uint256 public collateralRatio;

    /// @inheritdoc IBond
    uint256 public convertibleRatio;

    /// @dev Used to confirm the bond has not yet matured.
    modifier beforeMaturity() {
        if (isMature()) {
            revert BondPastMaturity();
        }
        _;
    }

    /// @dev Used to confirm that the bon is either mature or has been paid.
    modifier afterMaturityOrPaid() {
        if (!isMature() && !isFullyPaid()) {
            revert BondNotYetMaturedOrPaid();
        }
        _;
    }

    /// @inheritdoc IBond
    function initialize(
        string memory bondName,
        string memory bondSymbol,
        address bondOwner,
        uint256 _maturity,
        address _paymentToken,
        address _collateralToken,
        uint256 _collateralRatio,
        uint256 _convertibleRatio,
        uint256 maxSupply
    ) external initializer {
        __ERC20_init(bondName, bondSymbol);
        _transferOwnership(bondOwner);

        maturity = _maturity;
        paymentToken = _paymentToken;
        collateralToken = _collateralToken;
        collateralRatio = _collateralRatio;
        convertibleRatio = _convertibleRatio;
        _mint(bondOwner, maxSupply);
    }

    /// @inheritdoc IBond
    function convert(uint256 bonds) external nonReentrant beforeMaturity {
        if (bonds == 0) {
            revert ZeroAmount();
        }
        uint256 convertibleTokensToSend = previewConvertBeforeMaturity(bonds);
        if (convertibleTokensToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        // Saves an extra SLOAD
        address collateral = collateralToken;

        IERC20Metadata(collateral).safeTransfer(
            _msgSender(),
            convertibleTokensToSend
        );

        emit Convert(_msgSender(), collateral, bonds, convertibleTokensToSend);
    }

    /// @inheritdoc IBond
    function withdrawExcessCollateral(uint256 amount, address receiver)
        external
        onlyOwner
    {
        if (amount > previewWithdraw()) {
            revert NotEnoughCollateral();
        }

        // Saves an extra SLOAD
        address collateral = collateralToken;

        IERC20Metadata(collateral).safeTransfer(receiver, amount);

        emit CollateralWithdraw(_msgSender(), receiver, collateral, amount);
    }

    /// @inheritdoc IBond
    function pay(uint256 amount) external nonReentrant {
        if (isFullyPaid()) {
            revert PaymentAlreadyMet();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        IERC20Metadata(paymentToken).safeTransferFrom(
            _msgSender(),
            address(this),
            amount
        );
        emit Payment(_msgSender(), amount);
    }

    /// @inheritdoc IBond
    function redeem(uint256 bonds) external nonReentrant afterMaturityOrPaid {
        if (bonds == 0) {
            revert ZeroAmount();
        }

        (
            uint256 paymentTokensToSend,
            uint256 collateralTokensToSend
        ) = previewRedeemAtMaturity(bonds);

        if (paymentTokensToSend == 0 && collateralTokensToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        // Saves an extra SLOAD
        address payment = paymentToken;
        address collateral = collateralToken;

        if (paymentTokensToSend != 0) {
            IERC20Metadata(payment).safeTransfer(
                _msgSender(),
                paymentTokensToSend
            );
        }
        if (collateralTokensToSend != 0) {
            IERC20Metadata(collateral).safeTransfer(
                _msgSender(),
                collateralTokensToSend
            );
        }
        emit Redeem(
            _msgSender(),
            payment,
            collateral,
            bonds,
            paymentTokensToSend,
            collateralTokensToSend
        );
    }

    /// @inheritdoc IBond
    function sweep(IERC20Metadata sweepingToken, address receiver)
        external
        onlyOwner
    {
        // Check the balances before and compare to after to protect
        // against tokens that may proxy transfers through different addresses.
        uint256 paymentTokenBalanceBefore = IERC20Metadata(paymentToken)
            .balanceOf(address(this));
        uint256 collateralTokenBalanceBefore = IERC20Metadata(collateralToken)
            .balanceOf(address(this));

        uint256 sweepingTokenBalance = sweepingToken.balanceOf(address(this));

        sweepingToken.safeTransfer(receiver, sweepingTokenBalance);

        uint256 paymentTokenBalanceAfter = IERC20Metadata(paymentToken)
            .balanceOf(address(this));
        uint256 collateralTokenBalanceAfter = IERC20Metadata(collateralToken)
            .balanceOf(address(this));

        if (
            paymentTokenBalanceBefore != paymentTokenBalanceAfter ||
            collateralTokenBalanceBefore != collateralTokenBalanceAfter
        ) {
            revert SweepDisallowedForToken();
        }

        emit TokenSweep(
            _msgSender(),
            receiver,
            sweepingToken,
            sweepingTokenBalance
        );
    }

    /// @inheritdoc IBond
    function previewConvertBeforeMaturity(uint256 bonds)
        public
        view
        returns (uint256 collateralTokens)
    {
        collateralTokens = bonds.mulWadDown(convertibleRatio);
    }

    /// @inheritdoc IBond
    function previewWithdraw() public view returns (uint256 collateralTokens) {
        collateralTokens = previewWithdrawAfterPayment(0);
    }

    /// @inheritdoc IBond
    function previewWithdrawAfterPayment(uint256 payment)
        public
        view
        returns (uint256 collateralTokens)
    {
        uint256 tokensCoveredByPayment = paymentBalance() + payment;
        uint256 collateralTokensRequired = 0;
        uint256 supply = totalSupply();
        if (tokensCoveredByPayment < supply) {
            collateralTokensRequired = (supply - tokensCoveredByPayment)
                .mulWadUp(collateralRatio);
        }

        uint256 convertibleTokensRequired = supply.mulWadUp(convertibleRatio);

        uint256 totalRequiredCollateral;

        if (isFullyPaid()) {
            totalRequiredCollateral = isMature()
                ? 0 // Paid
                : convertibleTokensRequired; // PaidEarly
        } else {
            totalRequiredCollateral = isMature()
                ? collateralTokensRequired // Defaulted
                : _max(convertibleTokensRequired, collateralTokensRequired); // Active
        }
        uint256 collBalance = collateralBalance();
        if (totalRequiredCollateral >= collBalance) {
            return 0;
        }

        collateralTokens = collBalance - totalRequiredCollateral;
    }

    /// @inheritdoc IBond
    function previewRedeemAtMaturity(uint256 bonds)
        public
        view
        returns (uint256 paymentTokensToSend, uint256 collateralTokensToSend)
    {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return (0, 0);
        }
        uint256 paidAmount = isFullyPaid() ? supply : paymentBalance();
        paymentTokensToSend = bonds.mulDivDown(paidAmount, supply);

        uint256 nonPaidAmount = supply - paidAmount;
        collateralTokensToSend = collateralRatio.mulWadDown(
            bonds.mulDivDown(nonPaidAmount, supply)
        );
    }

    /// @inheritdoc IBond
    function paymentBalance() public view returns (uint256 paymentTokens) {
        paymentTokens = IERC20Metadata(paymentToken).balanceOf(address(this));
    }

    /// @inheritdoc IBond
    function withdrawExcessPayment(address receiver) external onlyOwner {
        uint256 overpayment = amountOverPaid();
        if (overpayment <= 0) {
            revert NoPaymentToWithdraw();
        }
        // Saves an extra SLOAD
        address payment = paymentToken;

        IERC20Metadata(payment).safeTransfer(receiver, overpayment);
        emit ExcessPaymentWithdraw(
            _msgSender(),
            receiver,
            payment,
            overpayment
        );
    }

    /// @inheritdoc IBond
    function collateralBalance()
        public
        view
        returns (uint256 collateralTokens)
    {
        collateralTokens = IERC20Metadata(collateralToken).balanceOf(
            address(this)
        );
    }

    /// @inheritdoc IBond
    function isFullyPaid() public view returns (bool isPaid) {
        isPaid = paymentBalance() >= totalSupply();
    }

    /// @inheritdoc IBond
    function isMature() public view returns (bool isBondMature) {
        isBondMature = block.timestamp >= maturity;
    }

    /// @inheritdoc IBond
    function amountOwed() external view returns (uint256 amountUnpaid) {
        uint256 supply = totalSupply();
        uint256 balance = paymentBalance();
        if (supply <= balance) {
            return 0;
        }
        amountUnpaid = supply - balance;
    }

    /// @inheritdoc IBond
    function amountOverPaid() public view returns (uint256 overpayment) {
        uint256 supply = totalSupply();
        uint256 balance = paymentBalance();
        if (supply >= balance) {
            return 0;
        }
        overpayment = balance - supply;
    }

    function decimals() public view override returns (uint8) {
        return IERC20Metadata(paymentToken).decimals();
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
}
