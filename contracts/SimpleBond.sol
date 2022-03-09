// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SimpleBond
/// @notice A custom ERC20 token that can be used to issue bonds.
/// @notice The contract handles issuance, conversion, and redemption of bonds.
contract SimpleBond is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
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
        // after DAO pays
        PAID,
        // when something goes wrong and this contract becomes nullified
        NULL
    }

    /// @notice emitted when a collateral is deposited for a bond
    /// @param collateralDepositor the address of the caller of the deposit
    /// @param collateralAddress the address of the collateral
    /// @param amount the number of the tokens being deposited
    event CollateralDeposited(
        address indexed collateralDepositor,
        address indexed collateralAddress,
        uint256 amount
    );

    /// @notice emitted when a bond's issuer withdraws collateral
    /// @param amount the number of the tokens withdrawn
    event CollateralWithdrawn(
        address indexed collateralWithdrawer,
        address indexed collateralAddress,
        uint256 amount
    );

    /// @notice emitted when a portion of the bond's principal is paid back
    event RepaymentDeposited(
        address indexed repaymentDepositor,
        uint256 amount
    );

    /// @notice emitted when all of the bond's principal is paid back
    event RepaymentInFull(address indexed repaymentDepositor, uint256 amount);

    /// @notice emitted when bond tokens are converted by a borrower
    event Converted(
        address indexed convertorAddress,
        address indexed collateralAddress,
        uint256 amountOfBondsConverted,
        uint256 amountOfCollateralReceived
    );

    /// @notice emitted when a bond is redeemed
    event Redeem(
        address indexed receiver,
        address indexed borrowingAddress,
        uint256 amountOfBondsRedeemed,
        uint256 amountOfTokensReceived
    );

    /// @notice emitted when a bond is redeemed by a borrower
    event RedeemDefaulted(
        address indexed receiver,
        address indexed collateralAddress,
        uint256 amountOfBondsRedeemed,
        uint256 amountOfCollateralReceived
    );

    /// @notice emitted when a bond is refinanced by a lender
    event Refinance(address refinancer, uint256 totalShares);

    /// @notice emitted when a bond changes state
    event BondStandingChange(
        BondStanding oldStanding,
        BondStanding newStanding
    );

    // modifiers
    error BondPastMaturity();
    error BondNotYetMatured();
    error BondNotYetRepaid();
    error BondNotYetRedeemed();
    error BondNotDefaulted();

    // Initialization
    error InvalidMaturityDate();
    error AddressCannotBeTheZeroAddress();

    // Minting
    error InusfficientCollateralToCoverTokenSupply();
    error BondSupplyExceeded();
    error NoMintAfterIssuance();
    error ZeroMintAmount();

    // Collateralization
    error ZeroCollateralizationAmount();

    // Uncollateralization
    error CollateralInContractInsufficientToCoverWithdraw();

    // Conversion
    error NotConvertible();

    // Repayment
    error RepaymentMet();

    // Redemption
    error ZeroRedemptionAmount();

    // Sweep
    error SweepDisallowedForToken();

    // Helper
    error TokenOverflow();

    modifier pastMaturity() {
        if (block.timestamp < maturityDate) {
            revert BondNotYetMatured();
        }
        _;
    }

    modifier notPastMaturity() {
        if (block.timestamp >= maturityDate) {
            revert BondPastMaturity();
        }
        _;
    }

    modifier repaid() {
        if (!_isRepaid) {
            revert BondNotYetRepaid();
        }
        _;
    }

    modifier redeemed() {
        if (totalSupply() > 0) {
            revert BondNotYetRedeemed();
        }
        _;
    }

    modifier defaulted() {
        if (block.timestamp < maturityDate) {
            revert BondNotDefaulted();
        }
        _;
    }

    modifier isConvertible() {
        bool _isConvertible = false;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            if (convertibilityRatios[i] > 0) {
                _isConvertible = true;
            }
        }
        if (!_isConvertible) {
            revert NotConvertible();
        }
        _;
    }

    /// @notice A date in the future set at bond creation at which the bond will mature.
    /// @notice Before this date, a bond token can be converted if convertible, but cannot be redeemed.
    /// @notice After this date, a bond token can be redeemed for the borrowing asset.
    uint256 public maturityDate;
    address public borrowingAddress;
    address[] public collateralAddresses;
    uint256[] public backingRatios;
    uint256[] public convertibilityRatios;

    bool internal _isRepaid;
    bool internal _isIssued;

    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    mapping(address => uint256) public totalCollateral;

    function state() public view returns (BondStanding newStanding) {
        if (
            block.timestamp >= maturityDate && !_isRepaid && totalSupply() > 0
        ) {
            newStanding = BondStanding.GOOD;
        } else if (block.timestamp >= maturityDate && !_isRepaid) {
            newStanding = BondStanding.DEFAULTED;
        } else if (_isRepaid) {
            newStanding = BondStanding.PAID;
        } else {
            newStanding = BondStanding.NULL;
        }
    }

    /// @dev New bond contract deployed via clone
    function initialize(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256 _maturityDate,
        address _borrowingAddress,
        address[] memory _collateralAddresses,
        uint256[] memory _backingRatios,
        uint256[] memory _convertibilityRatios
    ) external initializer {
        if (_maturityDate <= block.timestamp) {
            revert InvalidMaturityDate();
        }
        if (_borrowingAddress == address(0)) {
            revert AddressCannotBeTheZeroAddress();
        }

        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init();
        __Ownable_init();

        maturityDate = _maturityDate;
        borrowingAddress = _borrowingAddress;
        collateralAddresses = _collateralAddresses;
        backingRatios = _backingRatios;
        convertibilityRatios = _convertibilityRatios;

        _transferOwnership(_owner);
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(WITHDRAW_ROLE, _owner);
    }

    /// @notice Deposit collateral into bond contract
    /// @param amounts the amount of collateral to deposit
    function depositCollateral(
        address[] memory _collateralAddresses,
        uint256[] memory amounts
    ) external nonReentrant notPastMaturity {
        for (uint256 j = 0; j < _collateralAddresses.length; j++) {
            for (uint256 k = 0; k < collateralAddresses.length; k++) {
                if (_collateralAddresses[j] == collateralAddresses[k]) {
                    IERC20 collateralToken = IERC20(collateralAddresses[j]);
                    uint256 amount = amounts[j];

                    if (amount == 0) {
                        revert ZeroCollateralizationAmount();
                    }
                    // reentrancy possibility: the totalCollateral is updated after the transfer
                    uint256 collateralDeposited = safeTransferIn(
                        collateralToken,
                        _msgSender(),
                        amounts[j]
                    );
                    if (collateralDeposited == 0) {
                        revert ZeroCollateralizationAmount();
                    }

                    totalCollateral[
                        address(collateralToken)
                    ] += collateralDeposited;
                    emit CollateralDeposited(
                        _msgSender(),
                        address(collateralToken),
                        collateralDeposited
                    );
                }
            }
        }
    }

    /// @notice Withdraw collateral from bond contract
    /// @notice The amount of collateral available to be withdrawn depends on the collateralization ratio(s)
    function withdrawCollateral(
        address[] memory _collateralAddresses,
        uint256[] memory _amounts
    ) public nonReentrant onlyRole(WITHDRAW_ROLE) {
        for (uint256 j = 0; j < _collateralAddresses.length; j++) {
            for (uint256 k = 0; k < collateralAddresses.length; k++) {
                if (_collateralAddresses[j] == collateralAddresses[k]) {
                    address collateralAddress = collateralAddresses[k];
                    uint256 backingRatio = backingRatios[k];
                    uint256 convertibilityRatio = convertibilityRatios[k];
                    uint256 tokensNeededToCoverbackingRatio = totalSupply() *
                        backingRatio;
                    uint256 tokensNeededToCoverConvertibilityRatio = totalSupply() *
                            convertibilityRatio;
                    uint256 totalRequiredCollateral = tokensNeededToCoverbackingRatio +
                            tokensNeededToCoverConvertibilityRatio;
                    if (
                        _isRepaid && tokensNeededToCoverConvertibilityRatio > 0
                    ) {
                        totalRequiredCollateral = tokensNeededToCoverConvertibilityRatio;
                    } else if (_isRepaid) {
                        totalRequiredCollateral = 0;
                    }
                    uint256 balanceBefore = IERC20(collateralAddress).balanceOf(
                        address(this)
                    );
                    if (totalRequiredCollateral >= balanceBefore) {
                        revert CollateralInContractInsufficientToCoverWithdraw();
                    }
                    uint256 withdrawableCollateral = balanceBefore -
                        totalRequiredCollateral;
                    if (_amounts[j] > withdrawableCollateral) {
                        revert CollateralInContractInsufficientToCoverWithdraw();
                    }
                    // reentrancy possibility: the issuer could try to transfer more collateral than is available - at the point of execution
                    // the amount of transferred funds is _amounts[j] which is taken directly from the function arguments.
                    // After re-entering into this function when at the time below is called, the balanceBefore
                    IERC20(collateralAddress).safeTransfer(
                        _msgSender(),
                        _amounts[j]
                    );
                    totalCollateral[collateralAddress] -= _amounts[j];
                    emit CollateralWithdrawn(
                        _msgSender(),
                        collateralAddress,
                        _amounts[j]
                    );
                }
            }
        }
    }

    /// @notice mints the maximum amount of tokens restricted by the collateral(s)
    /// @dev nonReentrant needed as double minting would be possible otherwise
    function mint() external onlyOwner nonReentrant notPastMaturity {
        if (_isIssued) {
            revert NoMintAfterIssuance();
        }

        _isIssued = true;

        uint256 tokensToMint = 0;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            IERC20 collateralToken = IERC20(collateralAddresses[i]);
            // external call reentrancy possibility: collateralDeposited is checked + used later
            uint256 collateralDeposited = collateralToken.balanceOf(
                address(this)
            );
            uint256 backingRatio = backingRatios[i];
            uint256 convertibilityRatio = convertibilityRatios[i];
            // Each collateral type restricts the amount of mintable tokens by the ratio required to satisfy "collateralized"
            // 100 deposited collateral with a 1:5 ratio would allow for 100/5 tokens minted for THIS collateral type
            uint256 tokensCanMint = 0;
            if (
                convertibilityRatio == 0 || convertibilityRatio < backingRatio
            ) {
                // totalBondSupply = collateralDeposited * backingRatio / 1e18
                // collateralDeposited * 1e18 / backingRatio = targetBondSupply * backingRatio / 1e18
                tokensCanMint = (collateralDeposited * 1 ether) / backingRatio;
            } else {
                tokensCanMint =
                    (collateralDeposited * 1 ether) /
                    convertibilityRatio;
            }

            // First collateral sets the minimum mint amount after each loop,
            // tokensToMint can decrease if there is not enough collateral of another type
            if (tokensToMint == 0 || tokensToMint > tokensCanMint) {
                tokensToMint = tokensCanMint;
            }
        }
        // At this point, tokensToMint is the maximum possible to mint
        if (tokensToMint == 0) {
            revert ZeroMintAmount();
        }

        _mint(_msgSender(), tokensToMint);
    }

    /// @notice Bond holder can convert their bond to underlying collateral(s)
    /// @notice The bond must be convertible and not past maturity
    function convert(uint256 amountOfBondsToConvert)
        external
        notPastMaturity
        nonReentrant
        isConvertible
    {
        burn(amountOfBondsToConvert);
        // iterate over all collateral tokens and withdraw a proportional amount
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            IERC20 collateralToken = IERC20(collateralAddresses[i]);
            uint256 convertibilityRatio = convertibilityRatios[i];
            if (convertibilityRatio > 0) {
                uint256 collateralToSend = (amountOfBondsToConvert *
                    convertibilityRatio) / 1 ether;
                // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
                collateralToken.safeTransfer(_msgSender(), collateralToSend);
                totalCollateral[address(collateralToken)] -= collateralToSend;
                emit Converted(
                    _msgSender(),
                    address(collateralToken),
                    amountOfBondsToConvert,
                    collateralToSend
                );
            }
        }
    }

    /// @notice allows the issuer to repay the bond by depositing borrowing token
    /// @dev emits RepaymentInFull if the full balance has been repaid, RepaymentDeposited otherwise
    function repay(uint256 amount) public nonReentrant notPastMaturity {
        if (_isRepaid) {
            revert RepaymentMet();
        }
        // external call reentrancy possibility: this is a transfer into the contract - _isRepaid is updated after transfer
        uint256 outstandingAmount = totalSupply() -
            IERC20(borrowingAddress).balanceOf(address(this));

        uint256 amountRepaid = safeTransferIn(
            IERC20(borrowingAddress),
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
    function redeem(uint256 bondShares)
        external
        nonReentrant
        pastMaturity
        repaid
    {
        if (bondShares == 0) {
            revert ZeroRedemptionAmount();
        }

        burn(bondShares);

        // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
        IERC20(borrowingAddress).safeTransfer(_msgSender(), bondShares);
        emit Redeem(_msgSender(), borrowingAddress, bondShares, bondShares);
    }

    /// @notice this function returns an amount of collateral proportional to the bonds burnt
    /// @param bondShares the amount of bonds to burn into collateral
    function redeemDefaulted(uint256 bondShares)
        external
        nonReentrant
        pastMaturity
        defaulted
    {
        if (bondShares == 0) {
            revert ZeroRedemptionAmount();
        }
        burn(bondShares);

        // iterate over all collateral tokens and withdraw a proportional amount
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            IERC20 collateralToken = IERC20(collateralAddresses[i]);
            uint256 backingRatio = backingRatios[i];
            if (backingRatio > 0) {
                uint256 collateralToReceive = (bondShares * backingRatio) /
                    1 ether;
                // external call reentrancy possibility: the bonds are burnt here already - if there weren't enough bonds to burn, an error is thrown
                collateralToken.safeTransfer(_msgSender(), collateralToReceive);
                totalCollateral[
                    address(collateralToken)
                ] -= collateralToReceive;
                emit RedeemDefaulted(
                    _msgSender(),
                    address(collateralToken),
                    bondShares,
                    collateralToReceive
                );
            }
        }
    }

    /// @notice sends tokens to the issuer that were sent to this contract
    /// @dev collateral, borrowing, and the bond itself cannot be swept
    /// @param token send the entire token balance of this address to the owner
    function sweep(IERC20 token) external nonReentrant {
        if (
            address(token) == borrowingAddress ||
            address(token) == address(this)
        ) {
            revert SweepDisallowedForToken();
        }
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            if (address(token) == collateralAddresses[i]) {
                revert SweepDisallowedForToken();
            }
        }
        token.transfer(owner(), token.balanceOf(address(this)));
    }

    /// @notice this function returns the balance of this contract before and after a transfer into it
    /// @dev safeTransferFrom is used to revert on any non-success return from the transfer
    /// @dev the actual delta of tokens is returned to keep accurate balance in the case where the token has a fee
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
