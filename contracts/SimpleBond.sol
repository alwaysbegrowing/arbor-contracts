// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SimpleBond
/// @notice A custom ERC20 token that can be used to issue bonds.
/// @notice The contract handles issuance, conversion, and redemption of bonds.
/// @dev External calls to tokens used for collateral and borrowing are used throughout to transfer and check balances
contract SimpleBond is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    /// @notice this would go into default if maturityDate passes and the loan contract has not been paid back
    /// @notice to be set from the auction
    enum BondStanding {
        // the auction completed
        GOOD,
        // when maturity date passes and its unpaid
        DEFAULTED,
        // after bond borrowing token is repaid
        PAID,
        // when something goes wrong and this contract becomes nullified
        NULL
    }

    /// @notice emitted when a collateral is deposited for a bond
    /// @param collateralDepositor the address of the caller of the deposit
    /// @param collateralToken the address of the collateral
    /// @param amount the number of the tokens being deposited
    event CollateralDeposited(
        address indexed collateralDepositor,
        address indexed collateralToken,
        uint256 amount
    );

    /// @notice emitted when a bond's issuer withdraws collateral
    /// @param collateralWithdrawer the address withdrawing collateral
    /// @param collateralToken the address of the ERC20 token
    /// @param amount the number of the tokens withdrawn
    event CollateralWithdrawn(
        address indexed collateralWithdrawer,
        address indexed collateralToken,
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
    /// @param collateralToken the address of the collateral received
    /// @param amountOfBondsConverted the number of burnt bonds
    /// @param amountOfCollateralReceived the number of collateral tokens received
    event Converted(
        address indexed convertorAddress,
        address indexed collateralToken,
        uint256 amountOfBondsConverted,
        uint256 amountOfCollateralReceived
    );

    /// @notice emitted when a bond is redeemed
    event Redeem(
        address indexed receiver,
        address indexed token,
        uint256 amountOfBondsRedeemed,
        uint256 amountOfTokensReceived
    );

    // modifiers
    error BondPastMaturity();
    error BondNotYetMatured();
    error BondNotYetRepaid();
    error BondNotYetRedeemed();
    error BondNotDefaulted();

    // Initialization
    error InvalidMaturityDate();
    error BackingRatioLessThanConvertibilityRatio();

    // Minting
    error InusfficientCollateralToCoverTokenSupply();
    error BondSupplyExceeded();
    error NoMintAfterIssuance();

    // Withdraw
    error CollateralInContractInsufficientToCoverWithdraw();

    // Conversion
    error NotConvertible();

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

    /// @dev used to ensure bond has been repaid in full
    modifier repaid() {
        if (!_isRepaid) {
            revert BondNotYetRepaid();
        }
        _;
    }

    /// @dev used to check if the bond has defaulted
    modifier defaulted() {
        if (block.timestamp < maturityDate && !_isRepaid) {
            revert BondNotDefaulted();
        }
        _;
    }

    /// @dev used to check if a bond is convertible
    modifier isConvertible() {
        if (convertibilityRatio == 0) {
            revert NotConvertible();
        }
        _;
    }

    uint256 internal constant ONE = 1e18;

    /// @notice A date in the future set at bond creation at which the bond will mature.
    /// @notice Before this date, a bond token can be converted if convertible, but cannot be redeemed.
    /// @notice After this date, a bond token can be redeemed for the borrowing asset.
    uint256 public maturityDate;

    /// @notice The address of the ERC20 token this bond will be redeemable for at maturity
    address public borrowingToken;

    /// @notice this flag is set after the issuer has paid back the full amount of borrowing token needed to cover the outstanding bonds
    bool internal _isRepaid;

    /// @notice this flag is set upon mint to disallow subsequent minting
    bool internal _isIssued;

    /// @notice the addresses of the ERC20 token backing the bond which can be converted into before maturity or, in the case of a default, redeemable for at maturity
    address public collateralToken;

    /// @notice the ratio of ERC20 tokens backing the bonds
    uint256 public backingRatio;

    /// @notice the ratio of ERC20 tokens the bonds will convert into before maturity
    /// @dev if this ratio is 0, the bond is not convertible. see isConvertible modifier
    uint256 public convertibilityRatio;

    /// @notice the role ID for withdrawCollateral
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    /// @notice this mapping keeps track of the total collateral per address that is in this contract. this amount is used when determining the portion of collateral to return to the bond holders in event of a default
    uint256 public totalCollateral;

    function state() external view returns (BondStanding newStanding) {
        if (block.timestamp < maturityDate && !_isRepaid && totalSupply() > 0) {
            newStanding = BondStanding.GOOD;
        } else if (block.timestamp >= maturityDate && !_isRepaid) {
            newStanding = BondStanding.DEFAULTED;
        } else if (_isRepaid) {
            newStanding = BondStanding.PAID;
        } else {
            newStanding = BondStanding.NULL;
        }
    }

    /// @notice this function is called one time during initial bond creation and sets up the configuration for the bond
    /// @dev New bond contract deployed via clone
    /// @param _name passed into the ERC20 token
    /// @param _symbol passed into the ERC20 token
    /// @param _owner ownership of this contract transferred to this address
    /// @param _maturityDate the timestamp at which the bond will mature
    /// @param _borrowingToken the ERC20 token address the non-defaulted bond will be redeemable for at maturity
    /// @param _collateralToken the ERC20 token address for the bond
    /// @param _backingRatio the amount of tokens per bond needed
    /// @param _convertibilityRatio the amount of tokens per bond a convertible bond can be converted for
    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256 _maturityDate,
        address _borrowingToken,
        address _collateralToken,
        uint256 _backingRatio,
        uint256 _convertibilityRatio
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

        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();

        maturityDate = _maturityDate;
        borrowingToken = _borrowingToken;
        collateralToken = _collateralToken;
        backingRatio = _backingRatio;
        convertibilityRatio = _convertibilityRatio;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(WITHDRAW_ROLE, _owner);
    }

    /// @notice Deposit collateral into bond contract
    /// @param amount the amount of collateral to deposit
    function depositCollateral(uint256 amount)
        external
        nonReentrant
        notPastMaturity
    {
        // reentrancy possibility: the totalCollateral is updated after the transfer
        uint256 collateralDeposited = safeTransferIn(
            IERC20(collateralToken),
            _msgSender(),
            amount
        );

        totalCollateral += collateralDeposited;
        emit CollateralDeposited(
            _msgSender(),
            collateralToken,
            collateralDeposited
        );
    }

    /// @notice Withdraw collateral from bond contract
    /// @notice The amount of collateral available to be withdrawn depends on the backing ratio
    /// @param bondsToBurn the number of bonds to burn in return for collateral
    function withdrawCollateral(uint256 bondsToBurn)
        external
        nonReentrant
        onlyRole(WITHDRAW_ROLE)
    {
        if (bondsToBurn > 0) {
            burn(bondsToBurn);
        }
        uint256 tokensToCover = totalSupply() -
            IERC20(borrowingToken).balanceOf(address(this));
        uint256 tokensNeededToCoverBackingRatio = _isRepaid
            ? 0
            : tokensToCover * backingRatio;
        uint256 tokensNeededToCoverConvertibilityRatio = _isRepaid &&
            maturityDate >= block.timestamp
            ? 0
            : tokensToCover * convertibilityRatio;

        uint256 totalRequiredCollateral = tokensNeededToCoverBackingRatio +
            tokensNeededToCoverConvertibilityRatio;

        uint256 balanceBefore = IERC20(collateralToken).balanceOf(
            address(this)
        );
        if (totalRequiredCollateral >= balanceBefore) {
            revert CollateralInContractInsufficientToCoverWithdraw();
        }
        uint256 collateralToWithdraw = balanceBefore - totalRequiredCollateral;

        // reentrancy possibility: the issuer could try to transfer more collateral than is available - at the point of execution
        // the amount of transferred funds is amount which is taken directly from the function arguments.
        // After re-entering into this function when at the time below is called, the balanceBefore
        IERC20(collateralToken).safeTransfer(
            _msgSender(),
            collateralToWithdraw
        );
        totalCollateral -= collateralToWithdraw;
        emit CollateralWithdrawn(
            _msgSender(),
            collateralToken,
            collateralToWithdraw
        );
    }

    /// @notice mints the maximum amount of tokens restricted by the collateral
    /// @dev nonReentrant needed as double minting would be possible otherwise
    function mint()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        notPastMaturity
    {
        if (_isIssued) {
            revert NoMintAfterIssuance();
        }

        _isIssued = true;

        // external call reentrancy possibility: collateralDeposited is checked + used later
        uint256 collateralDeposited = IERC20(collateralToken).balanceOf(
            address(this)
        );
        // 100 deposited collateral with a 1:5 ratio would allow for 100/5 tokens minted
        // Backing ratio is used here because it is always greater than the convertibility ratio
        uint256 tokensToMint = (collateralDeposited * ONE) / backingRatio;

        if (tokensToMint == 0) {
            revert ZeroAmount();
        }

        _mint(_msgSender(), tokensToMint);
    }

    /// @notice Bond holder can convert their bond to underlying collateral
    /// @notice The bond must be convertible and not past maturity
    /// @param bondsToConvert the number of bonds which will be burnt and converted into the collateral(s) at the convertibility ratio(s)
    function convert(uint256 bondsToConvert)
        external
        notPastMaturity
        nonReentrant
        isConvertible
    {
        if (bondsToConvert == 0) {
            revert ZeroAmount();
        }

        burn(bondsToConvert);
        uint256 collateralToSend = (bondsToConvert * convertibilityRatio) / ONE;
        // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
        IERC20(collateralToken).safeTransfer(_msgSender(), collateralToSend);
        totalCollateral -= collateralToSend;
        emit Converted(
            _msgSender(),
            collateralToken,
            bondsToConvert,
            collateralToSend
        );
    }

    /// @notice allows the issuer to repay the bond by depositing borrowing token
    /// @dev emits RepaymentInFull if the full balance has been repaid, RepaymentDeposited otherwise
    /// @dev the lower of outstandingAmount and amount is chosen to prevent overpayment
    /// @param amount the number of borrowing tokens to repay
    function repay(uint256 amount) external nonReentrant notPastMaturity {
        if (_isRepaid) {
            revert RepaymentMet();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        // external call reentrancy possibility: this is a transfer into the contract - _isRepaid is updated after transfer
        uint256 outstandingAmount = totalSupply() -
            IERC20(borrowingToken).balanceOf(address(this));

        uint256 amountRepaid = safeTransferIn(
            IERC20(borrowingToken),
            _msgSender(),
            amount >= outstandingAmount ? outstandingAmount : amount
        );
        if (amountRepaid >= outstandingAmount) {
            _isRepaid = true;
            emit RepaymentInFull(_msgSender(), amountRepaid);
        } else {
            emit RepaymentDeposited(_msgSender(), amountRepaid);
        }
    }

    /// @notice this function burns bonds in return for the token borrowed against the bond
    /// @param bondShares the amount of bonds to redeem and burn
    function redeem(uint256 bondShares) external nonReentrant pastMaturity {
        if (bondShares == 0) {
            revert ZeroAmount();
        }

        burn(bondShares);

        // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
        if (_isRepaid) {
            unsafeRedeemRepaid(bondShares);
        } else {
            unsafeRedeemDefaulted(bondShares);
        }
    }

    function unsafeRedeemRepaid(uint256 bondShares) private {
        IERC20(borrowingToken).safeTransfer(_msgSender(), bondShares);
        emit Redeem(_msgSender(), borrowingToken, bondShares, bondShares);
    }

    /// @notice this function returns an amount of collateral proportional to the bonds burnt
    /// @param bondShares the amount of bonds to burn into collateral
    function unsafeRedeemDefaulted(uint256 bondShares) private {
        uint256 borrowingTokenBalance = IERC20(borrowingToken).balanceOf(
            address(this)
        );

        // In the case of partial repayment, return a proportional share of borrowingTokens
        if (borrowingTokenBalance > 0) {
            uint256 borrowingTokensToReceive = (bondShares *
                borrowingTokenBalance) / totalSupply();
            IERC20(borrowingToken).safeTransfer(
                _msgSender(),
                borrowingTokensToReceive
            );
            emit Redeem(
                _msgSender(),
                borrowingToken,
                bondShares,
                borrowingTokensToReceive
            );
        }

        if (backingRatio > 0) {
            uint256 collateralToReceive = (bondShares * backingRatio) / ONE;
            // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
            IERC20(collateralToken).safeTransfer(
                _msgSender(),
                collateralToReceive
            );
            totalCollateral -= collateralToReceive;
            emit Redeem(
                _msgSender(),
                collateralToken,
                bondShares,
                collateralToReceive
            );
        }
    }

    /// @notice sends tokens to the issuer that were sent to this contract
    /// @dev collateral, borrowing, and the bond itself cannot be swept
    /// @param token send the entire token balance of this address to the owner
    function sweep(IERC20 token)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (
            address(token) == borrowingToken ||
            address(token) == address(this) ||
            address(token) == collateralToken
        ) {
            revert SweepDisallowedForToken();
        }
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    /// @notice this function returns the balance of this contract before and after a transfer into it
    /// @dev safeTransferFrom is used to revert on any non-success return from the transfer
    /// @dev the actual delta of tokens is returned to keep accurate balance in the case where the token has a fee
    /// @param token the ERC20 token being transferred from
    /// @param from the sender
    /// @param value the total number of tokens being transferred
    function safeTransferIn(
        IERC20 token,
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
}
