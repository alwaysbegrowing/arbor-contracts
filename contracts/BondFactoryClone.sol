// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./SimpleBond.sol";

/// @title Porter bond v1 factory
/// @notice Deploys Porter bonds
/// @dev This uses a cloneFactory to save on gas costs during deployment https://docs.openzeppelin.com/contracts/4.x/api/proxy#Clones
contract BondFactoryClone is AccessControl {
    address public immutable tokenImplementation;
    bool public isAllowListEnabled = true;
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @notice Emitted when a new bond is created
    /// @param newBond The address of the newley deployed bond
    // inherit the rest of the paramters from createBond
    event BondCreated(
        address newBond,
        string name,
        string symbol,
        address owner,
        uint256 maturityDate,
        address repaymentToken,
        address backingToken,
        uint256 backingRatio,
        uint256 convertibilityRatio
    );

    /// @notice Emitted when the allow list is toggled on or off
    /// @param isAllowListEnabled the new state of the allow list
    event AllowListEnabled(bool isAllowListEnabled);

    /// @dev If allow list is enabled
    /// Then only allow listed issuers are able to call functions marked by this modifier
    modifier onlyIssuer() {
        if (isAllowListEnabled) {
            _checkRole(ISSUER_ROLE, msg.sender);
        }
        _;
    }

    constructor() {
        tokenImplementation = address(new SimpleBond());
        // this grants the user deploying this contract the DEFAULT_ADMIN_ROLE
        // which gives them the ability to call grantRole to grant access to
        // the ISSUER_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Turns the allow list on or off
    /// @param _isAllowListEnabled If the allow list should be enabled or not
    /// @dev Must be called by the current owner
    function setIsAllowListEnabled(bool _isAllowListEnabled)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        isAllowListEnabled = _isAllowListEnabled;
        emit AllowListEnabled(isAllowListEnabled);
    }

    /// @notice Creates a bond
    /// @param _name Name of the bond
    /// @param _symbol Ticker symbol for the bond
    /// @param _owner Owner of the bond
    /// @param _maturityDate Timestamp of when the bond matures
    /// @param _backingToken Address of the collateral to use for the bond
    /// @param _backingRatio Ratio of bond:token to be used
    /// @param _repaymentToken Address of the token being repayed at maturity
    /// @param _convertibilityRatio Ratio of bond:token that the bond can be converted into
    /// @dev this uses a clone to save on deployment costs https://github.com/porter-finance/v1-core/issues/15
    /// This adds a slight overhead everytime users interact with the bonds - but saves 10x the gas during deployment
    function createBond(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint256 _maturityDate,
        address _repaymentToken,
        address _backingToken,
        uint256 _backingRatio,
        uint256 _convertibilityRatio,
        uint256 _maxSupply
    ) external onlyIssuer returns (address clone) {
        clone = Clones.clone(tokenImplementation);
        SimpleBond(clone).initialize(
            _name,
            _symbol,
            _owner,
            _maturityDate,
            _repaymentToken,
            _backingToken,
            _backingRatio,
            _convertibilityRatio,
            _maxSupply
        );
        emit BondCreated(
            clone,
            _name,
            _symbol,
            _owner,
            _maturityDate,
            _repaymentToken,
            _backingToken,
            _backingRatio,
            _convertibilityRatio
        );
    }
}
