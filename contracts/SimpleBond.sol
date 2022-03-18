// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FixedPointMathLib} from "./utils/FixedPointMathLib.sol";

/// @title SimpleBond
/// @notice A custom ERC20 token that can be used to issue bonds.
/// @notice The contract handles issuance, conversion, and redemption of bonds.
/// @dev External calls to tokens used for backing and repayment are used throughout to transfer and check balances
contract SimpleBond is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20Metadata;
    using FixedPointMathLib for uint256;

    /// @notice this would go into default if maturityDate passes and the loan contract has not been paid back
    /// @notice to be set from the auction
    enum BondStanding {
        // the auction completed
        GOOD,
        // when maturity date passes and its unpaid
        DEFAULTED,
        // after bond repayment token is repaid
        PAID,
        // when something goes wrong and this contract becomes nullified
        NULL
    }

    /// @notice emitted when a collateral is deposited for a bond
    /// @param collateralDepositor the address of the caller of the deposit
    /// @param backingToken the address of the collateral
    /// @param amount the number of the tokens being deposited
    event CollateralDeposited(
        address indexed collateralDepositor,
        address indexed backingToken,
        uint256 amount
    );

    /// @notice emitted when a bond's issuer withdraws collateral
    /// @param collateralWithdrawer the address withdrawing collateral
    /// @param backingToken the address of the ERC20 token
    /// @param amount the number of the tokens withdrawn
    event CollateralWithdrawn(
        address indexed collateralWithdrawer,
        address indexed backingToken,
        uint256 amount
    );

    /// @notice emitted when a portion of the bond's principal is paid back
    /// @param repaymentDepositor the address depositing repayment
    /// @param amount the amount of repayment deposited
    event RepaymentDeposited(
        address indexed repaymentDepositor,
        uint256 amount
    );

    /// @notice emitted when all of the bond's principal is paid back
    /// @param repaymentDepositor the address depositing repayment
    /// @param amount the amount deposited to fully repay the bond
    event RepaymentInFull(address indexed repaymentDepositor, uint256 amount);

    /// @notice emitted when bond tokens are converted by a borrower
    /// @param convertorAddress the address converting their tokens
    /// @param backingToken the address of the collateral received
    /// @param amountOfBondsConverted the number of burnt bonds
    /// @param amountOfCollateralReceived the number of collateral tokens received
    event Converted(
        address indexed convertorAddress,
        address indexed backingToken,
        uint256 amountOfBondsConverted,
        uint256 amountOfCollateralReceived
    );

    /// @notice emitted when a bond is redeemed
    event Redeem(
        address indexed receiver,
        address indexed repaymentToken,
        address indexed backingToken,
        uint256 amountOfBondsRedeemed,
        uint256 amountOfRepaymentTokensReceived,
        uint256 amountOfCollateralReceived
    );

    /// @notice emitted when bonds are minted
    event Mint(address indexed receiver, uint256 amountOfBondsMinted);

    // modifiers
    error BondPastMaturity();
    error BondNotYetMatured();

    // Initialization
    error InvalidMaturityDate();
    error BackingRatioLessThanConvertibilityRatio();

    // Minting
    error BondSupplyExceeded();

    // Repayment
    error RepaymentMet();

    // Sweep
    error SweepDisallowedForToken();

    // Helper
    error ZeroAmount();
    error TokenOverflow();

    /// @dev used to confirm the bond has matured
    modifier pastMaturity() {
        if (block.timestamp < maturityDate) {
            revert BondNotYetMatured();
        }
        _;
    }

    /// @dev used to confirm the bond has not yet matured
    modifier notPastMaturity() {
        if (block.timestamp >= maturityDate) {
            revert BondPastMaturity();
        }
        _;
    }

    uint256 internal constant ONE = 1e18;

    /// @notice A date in the future set at bond creation at which the bond will mature.
    /// @notice Before this date, a bond token can be converted if convertible, but cannot be redeemed.
    /// @notice After this date, a bond token can be redeemed for the repayment token.
    uint256 public maturityDate;

    /// @notice The address of the ERC20 token this bond will be redeemable for at maturity
    address public repaymentToken;

    /// @notice this flag is set after the issuer has paid back the full amount of repayment token needed to cover the outstanding bonds
    bool internal isRepaid;

    /// @notice the addresses of the ERC20 token backing the bond which can be converted into before maturity or, in the case of a default, redeemable for at maturity
    address public backingToken;

    /// @notice the ratio of ERC20 tokens backing the bonds
    uint256 public backingRatio;

    /// @notice the ratio of ERC20 tokens the bonds will convert into before maturity
    /// @dev if this ratio is 0, the bond is not convertible.
    uint256 public convertibilityRatio;

    /// @notice The ratio at which the repayment token's decimals deviate from the 18 decimal bond. 1e18 for a 1:1 ratio
    uint256 public repaymentScalingFactor;

    /// @notice the role ID for withdrawCollateral
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    /// @notice the role ID for mint
    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");

    /// @notice the max amount of bonds able to be minted
    uint256 public maxSupply;

    function state() external view returns (BondStanding newStanding) {
        if (block.timestamp < maturityDate && !isRepaid && totalSupply() > 0) {
            newStanding = BondStanding.GOOD;
        } else if (block.timestamp >= maturityDate && !isRepaid) {
            newStanding = BondStanding.DEFAULTED;
        } else if (isRepaid) {
            newStanding = BondStanding.PAID;
        } else {
            newStanding = BondStanding.NULL;
        }
    }

    /// @notice this function is called one time during initial bond creation and sets up the configuration for the bond
    /// @dev New bond contract deployed via clone
    /// @param bondName passed into the ERC20 token
    /// @param bondSymbol passed into the ERC20 token
    /// @param owner ownership of this contract transferred to this address
    /// @param _maturityDate the timestamp at which the bond will mature
    /// @param _repaymentToken the ERC20 token address the non-defaulted bond will be redeemable for at maturity
    /// @param _backingToken the ERC20 token address for the bond
    /// @param _backingRatio the amount of tokens per bond needed
    /// @param _convertibilityRatio the amount of tokens per bond a convertible bond can be converted for
    function initialize(
        string memory bondName,
        string memory bondSymbol,
        address owner,
        uint256 _maturityDate,
        address _repaymentToken,
        address _backingToken,
        uint256 _backingRatio,
        uint256 _convertibilityRatio,
        uint256 _maxSupply
    ) external initializer {
        if (_backingRatio < _convertibilityRatio) {
            revert BackingRatioLessThanConvertibilityRatio();
        }
        if (
            _maturityDate <= block.timestamp ||
            _maturityDate > block.timestamp + 3650 days
        ) {
            revert InvalidMaturityDate();
        }

        __ERC20_init(bondName, bondSymbol);
        __ERC20Burnable_init();

        maturityDate = _maturityDate;
        repaymentToken = _repaymentToken;
        backingToken = _backingToken;
        backingRatio = _backingRatio;
        convertibilityRatio = _convertibilityRatio;
        repaymentScalingFactor = _computeScalingFactor(repaymentToken);
        maxSupply = _maxSupply;

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(WITHDRAW_ROLE, owner);
        _grantRole(MINT_ROLE, owner);
    }

    /// @notice Withdraw collateral from bond contract
    /// @notice The amount of collateral available to be withdrawn depends on the backing ratio
    function withdrawCollateral()
        external
        nonReentrant
        onlyRole(WITHDRAW_ROLE)
    {
        uint256 collateralToSend = previewWithdraw();

        IERC20Metadata(backingToken).safeTransfer(
            _msgSender(),
            collateralToSend
        );

        emit CollateralWithdrawn(_msgSender(), backingToken, collateralToSend);
    }

    /// @notice mints the amount of specified bonds by transferring in collateral
    /// @dev CollateralDeposited + Mint events are both emitted. bonds to mint is bounded by maxSupply
    /// @param bonds the amount of bonds to mint
    function mint(uint256 bonds)
        external
        onlyRole(MINT_ROLE)
        nonReentrant
        notPastMaturity
    {
        if (bonds > maxSupply - totalSupply()) {
            revert BondSupplyExceeded();
        }

        uint256 collateralToDeposit = previewMint(bonds);

        if (collateralToDeposit == 0) {
            revert ZeroAmount();
        }

        _mint(_msgSender(), bonds);

        emit Mint(_msgSender(), bonds);

        uint256 collateralDeposited = safeTransferIn(
            IERC20Metadata(backingToken),
            _msgSender(),
            collateralToDeposit
        );

        emit CollateralDeposited(
            _msgSender(),
            backingToken,
            collateralDeposited
        );
    }

    /// @notice Bond holder can convert their bond to underlying collateral
    /// @notice The bond must be convertible and not past maturity
    /// @param bonds the number of bonds which will be burnt and converted into the collateral at the convertibility ratio
    function convert(uint256 bonds) external notPastMaturity nonReentrant {
        uint256 collateralToSend = previewConvert(bonds);
        if (collateralToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        // @audit-ok Reentrancy possibility: the bonds are already burnt - if there weren't enough bonds to burn, an error is thrown
        IERC20Metadata(backingToken).safeTransfer(
            _msgSender(),
            collateralToSend
        );

        emit Converted(_msgSender(), backingToken, bonds, collateralToSend);
    }

    /// @notice allows the issuer to repay the bond by depositing repayment token
    /// @dev emits RepaymentInFull if the full balance has been repaid, RepaymentDeposited otherwise
    /// @dev the lower of outstandingAmount and amount is chosen to prevent overpayment
    /// @param amount the number of repayment tokens to repay
    function repay(uint256 amount) external nonReentrant notPastMaturity {
        if (isRepaid) {
            revert RepaymentMet();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        // @audit-ok Re-entrancy possibility: this is a transfer into the contract - isRepaid is updated after transfer
        // I'm not sure how we can fix this here. We could check that_upscale(totalRepaymentSupply() + amount) >= totalSupply() but
        // that would break in the case of a token taking a fee.
        // maybe we don't care about reentrency for this method? I was trying to think through potential exploits here, and
        // if reentrency is exploited here what can they do? Just repay over the maximum amount?
        uint256 amountRepaid = safeTransferIn(
            IERC20Metadata(repaymentToken),
            _msgSender(),
            amount
        );
        if (
            // @audit-ok Re-entrancy possibility: isRepaid is updated after balance check
            _upscale(totalRepaymentSupply()) >= totalSupply()
        ) {
            isRepaid = true;
            emit RepaymentInFull(_msgSender(), amountRepaid);
        } else {
            emit RepaymentDeposited(_msgSender(), amountRepaid);
        }
    }

    /// @notice this function burns bonds in return for the token borrowed against the bond
    /// @param bonds the amount of bonds to redeem and burn
    function redeem(uint256 bonds) external nonReentrant pastMaturity {
        // calculate amount before burning as the preview function uses totalSupply.
        (
            uint256 repaymentTokensToSend,
            uint256 backingTokensToSend
        ) = previewRedeem(bonds);

        if (repaymentTokensToSend == 0 && backingTokensToSend == 0) {
            revert ZeroAmount();
        }

        burn(bonds);

        // @audit-ok reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
        if (repaymentTokensToSend > 0) {
            IERC20Metadata(repaymentToken).safeTransfer(
                _msgSender(),
                repaymentTokensToSend
            );
        }
        if (backingTokensToSend > 0) {
            // @audit-ok reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
            IERC20Metadata(backingToken).safeTransfer(
                _msgSender(),
                backingTokensToSend
            );
        }
        emit Redeem(
            _msgSender(),
            repaymentToken,
            backingToken,
            bonds,
            repaymentTokensToSend,
            backingTokensToSend
        );
    }

    /// @notice sends tokens to the issuer that were sent to this contract
    /// @dev collateral, repayment, and the bond itself cannot be swept
    /// @param token send the entire token balance of this address to the owner
    function sweep(IERC20Metadata token)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (
            address(token) == repaymentToken ||
            address(token) == address(this) ||
            address(token) == backingToken
        ) {
            revert SweepDisallowedForToken();
        }
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }

    /// @notice this function returns the balance of this contract before and after a transfer into it
    /// @dev safeTransferFrom is used to revert on any non-success return from the transfer
    /// @dev the actual delta of tokens is returned to keep accurate balance in the case where the token has a fee
    /// @param token the ERC20 token being transferred from
    /// @param from the sender
    /// @param value the total number of tokens being transferred
    function safeTransferIn(
        IERC20Metadata token,
        address from,
        uint256 value
    ) private returns (uint256) {
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), value);

        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter < balanceBefore) {
            revert TokenOverflow();
        }
        return balanceAfter - balanceBefore;
    }

    function totalRepaymentSupply() public view returns (uint256) {
        return IERC20Metadata(repaymentToken).balanceOf(address(this));
    }

    function totalBackingSupply() public view returns (uint256) {
        return IERC20Metadata(backingToken).balanceOf(address(this));
    }

    /// @dev uses the decimals on the token to return a scale factor for the passed in token
    function _computeScalingFactor(address token)
        internal
        view
        returns (uint256)
    {
        if (address(token) == address(this)) {
            return ONE;
        }

        // Tokens that don't implement the `decimals` method are not supported.
        uint256 tokenDecimals = IERC20Metadata(token).decimals();

        // Tokens with more than 18 decimals are not supported.
        if (tokenDecimals > 18) {
            revert TokenOverflow();
        }
        uint256 decimalsDifference = 18 - tokenDecimals;
        return ONE * 10**decimalsDifference;
    }

    /// @dev this function takes the amount of repaymentTokens and scales to bond tokens rounding up
    function _upscale(uint256 amount) internal view returns (uint256) {
        return amount.mulDivUp(repaymentScalingFactor, ONE);
    }

    /// @notice preview the amount of backing token required to mint the number of bond tokens
    /// @dev this function rounds up the amount of required backing for the number of bonds to mint
    /// @param bonds the amount of desired bonds to mint
    /// @return amount of backing required to mint the amount of bonds
    function previewMint(uint256 bonds) public view returns (uint256) {
        return bonds.mulDivUp(backingRatio, ONE);
    }

    function previewConvert(uint256 bonds) public view returns (uint256) {
        return bonds.mulDivDown(convertibilityRatio, ONE);
    }

    /// @dev this function calculates the amount of backing tokens that are able to be withdrawn by the issuer. The amount of tokens can increase by bonds being burnt and converted as well as repayment made. Each bond is covered by a certain amount of collateral for backing and conversion. For convertible bonds, the totalSupply of bonds must be covered by the convertibilityRatio. That means even if all of the bonds were covered by repayment, there must still be enough collateral in the contract to cover the outstanding bonds convertibility until the maturity date - at which point all collateral will be able to be withdrawn.
    function previewWithdraw() public view returns (uint256) {
        uint256 tokensCoveredByRepayment = _upscale(totalRepaymentSupply());
        uint256 maxCollateralRequiredForBacking;
        if (tokensCoveredByRepayment > totalSupply()) {
            maxCollateralRequiredForBacking = 0;
        } else {
            maxCollateralRequiredForBacking = (totalSupply() -
                tokensCoveredByRepayment).mulDivUp(backingRatio, ONE);
        }
        uint256 maxCollateralRequiredForConvertibility = totalSupply().mulDivUp(
            convertibilityRatio,
            ONE
        );
        /* 
     NOTE: "total uncovered supply" is the tokens that are not covered by the
     paid back repayment token.

     There are the following scenarios:
     bond is NOT paid AND NOT mature:
     to cover backing ratio = total uncovered supply * backing ratio
     to cover convertibility = total supply * convertibility ratio
     bond is NOT paid AND mature
     to cover backing ratio = total uncovered supply * backing ratio
     to cover convertibility = 0 (bonds cannot be converted)
     bond IS paid AND NOT mature
     to cover backing ratio = 0 (bonds need not be backed by collateral)
     to cover convertibility ratio = total supply * collateral ratio
     bond IS paid AND mature
     to cover backing ratio = 0
     to cover convertibility ratio = 0
     All outstanding bonds must be covered by the convertibility ratio
    */

        uint256 totalRequiredCollateral;
        if (!isRepaid) {
            totalRequiredCollateral = maxCollateralRequiredForConvertibility >
                maxCollateralRequiredForBacking
                ? maxCollateralRequiredForConvertibility
                : maxCollateralRequiredForBacking;
        } else if (maturityDate < block.timestamp) {
            totalRequiredCollateral = maxCollateralRequiredForConvertibility;
        } else {
            // @audit-info redundant but explicit
            totalRequiredCollateral = 0;
        }

        if (totalRequiredCollateral >= totalBackingSupply()) {
            return 0;
        }

        return totalBackingSupply() - totalRequiredCollateral;
    }

    function previewRedeem(uint256 bonds)
        public
        view
        returns (uint256, uint256)
    {
        if (block.timestamp < maturityDate) {
            // Immature bond redeems for nothing
            return (0, 0);
        }

        uint256 repaidAmount = _upscale(totalRepaymentSupply());
        if (repaidAmount > totalSupply()) {
            repaidAmount = totalSupply();
        }
        uint256 repaymentTokensToSend = bonds.mulDivUp(
            totalRepaymentSupply(),
            totalSupply()
        );

        uint256 nonRepaidAmount = totalSupply() - repaidAmount;
        uint256 backingTokensToSend = backingRatio.mulDivDown(
            bonds.mulDivDown(nonRepaidAmount, totalSupply()),
            ONE
        );

        return (repaymentTokensToSend, backingTokensToSend);
    }
}
