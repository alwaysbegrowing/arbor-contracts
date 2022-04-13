// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IBondFactory} from "./interfaces/IBondFactory.sol";

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {FixedPointMathLib} from "./utils/FixedPointMathLib.sol";

import "./Bond.sol";

/** 
    @title Bond Factory
    @author Porter Finance
    @notice This factory contract issues new bond contracts.
    @dev This uses a cloneFactory to save on gas costs during deployment.
        See OpenZeppelin's "Clones" proxy.
*/
contract BondFactory is IBondFactory, AccessControl {
    using SafeERC20 for IERC20Metadata;
    using FixedPointMathLib for uint256;

    /// @notice The role required to issue bonds.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @inheritdoc IBondFactory
    address public immutable tokenImplementation;

    /// @inheritdoc IBondFactory
    mapping(address => bool) public isBond;

    /// @inheritdoc IBondFactory
    bool public isAllowListEnabled = true;

    /**
        @dev If allow list is enabled, only allow-listed issuers are
            able to call functions.
    */
    modifier onlyIssuer() {
        if (isAllowListEnabled) {
            _checkRole(ISSUER_ROLE, _msgSender());
        }
        _;
    }

    /*
        When deployed, the deployer will be granted the DEFAULT_ADMIN_ROLE. This
        gives the ability the ability to call `grantRole` to grant access to
        the ISSUER_ROLE as well as the ability to toggle if the allow list
        is enabled or not at any time.
    */
    constructor() {
        tokenImplementation = address(new Bond());
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @inheritdoc IBondFactory
    function setIsAllowListEnabled(bool _isAllowListEnabled)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        isAllowListEnabled = _isAllowListEnabled;
        emit AllowListEnabled(_isAllowListEnabled);
    }

    /// @inheritdoc IBondFactory
    function createBond(
        string memory name,
        string memory symbol,
        uint256 maturityDate,
        address paymentToken,
        address collateralToken,
        uint256 collateralTokenAmount,
        uint256 convertibleTokenAmount,
        uint256 bonds
    ) external onlyIssuer returns (address clone) {
        if (bonds == 0) {
            revert ZeroBondsToMint();
        }
        if (paymentToken == collateralToken) {
            revert TokensMustBeDifferent();
        }

        if (collateralTokenAmount < convertibleTokenAmount) {
            revert CollateralTokenAmountLessThanConvertibleTokenAmount();
        }
        if (
            maturityDate <= block.timestamp ||
            maturityDate > block.timestamp + 3650 days
        ) {
            revert InvalidMaturityDate();
        }
        if (
            IERC20Metadata(paymentToken).decimals() > 18 ||
            IERC20Metadata(collateralToken).decimals() > 18
        ) {
            revert DecimalsOver18();
        }

        clone = Clones.clone(tokenImplementation);

        isBond[clone] = true;
        uint256 collateralRatio = collateralTokenAmount.divWadDown(bonds);
        uint256 convertibleRatio = convertibleTokenAmount.divWadDown(bonds);
        _deposit(_msgSender(), clone, collateralToken, collateralTokenAmount);

        Bond(clone).initialize(
            name,
            symbol,
            _msgSender(),
            maturityDate,
            paymentToken,
            collateralToken,
            collateralRatio,
            convertibleRatio,
            bonds
        );

        emit BondCreated(
            clone,
            name,
            symbol,
            _msgSender(),
            maturityDate,
            paymentToken,
            collateralToken,
            collateralRatio,
            convertibleRatio,
            bonds
        );
    }

    function _deposit(
        address owner,
        address clone,
        address collateralToken,
        uint256 collateralToDeposit
    ) internal {
        IERC20Metadata(collateralToken).safeTransferFrom(
            owner,
            clone,
            collateralToDeposit
        );
        uint256 amountDeposited = IERC20Metadata(collateralToken).balanceOf(
            clone
        );
        // Greater than instead of != for the case where the collateralToken
        // is sent to the clone address before creation.
        if (collateralToDeposit > amountDeposited) {
            revert InvalidDeposit();
        }
    }
}
