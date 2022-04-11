// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IBondFactory {
    /**
        @notice Emitted when the allow list is toggled on or off
        @param isAllowListEnabled the new state of the allow list
    */
    event AllowListEnabled(bool isAllowListEnabled);

    /**
        @notice Emitted when a new bond is created
        @param newBond The address of the newley deployed bond
        Inherit createBond
    */
    event BondCreated(
        address newBond,
        string name,
        string symbol,
        address indexed owner,
        uint256 maturityDate,
        address indexed paymentToken,
        address indexed collateralToken,
        uint256 collateralTokenAmount,
        uint256 convertibleTokenAmount,
        uint256 bonds
    );

    /// @notice fails if the collateral token takes a fee
    error InvalidDeposit();

    /// @notice Decimals with more than 18 digits are not supported
    error DecimalsOver18();

    /// @notice maturity date is not valid
    error InvalidMaturityDate();

    /// @notice There must be more collateral tokens than convertible tokens
    error CollateralTokenAmountLessThanConvertibleTokenAmount();

    /// @notice max bonds must be a positive number
    error ZeroBondsToMint();

    /// @notice payment and collateral token can not be the same
    error TokensMustBeDifferent();

    /**
        @notice Creates a bond
        @param name Name of the bond
        @param symbol Ticker symbol for the bond
        @param maturityDate Timestamp of when the bond matures
        @param paymentToken Address of the token being paid
        @param collateralToken Address of the collateral to use for the bond
        @param collateralTokenAmount Number of all collateral tokens that the bonds will convert into
        @param convertibleTokenAmount Number of the collateral token that all bonds will convert into
        @param bonds number of bonds to mint
        @dev This uses a clone to save on deployment costs which adds a slight overhead
            everytime users interact with the bonds - but saves on gas during deployment
        @return clone the address of the newly created bond-clone
    */
    function createBond(
        string memory name,
        string memory symbol,
        uint256 maturityDate,
        address paymentToken,
        address collateralToken,
        uint256 collateralTokenAmount,
        uint256 convertibleTokenAmount,
        uint256 bonds
    ) external returns (address clone);

    /// @notice when enabled, issuance is restricted to those with the ISSUER_ROLE
    function isAllowListEnabled() external view returns (bool);

    /**
     @notice Check if a specific address is a porter bond created by this factory
     @dev this is useful if we need to check if a bond is a porter bond on chain
     for example, if we want to make a new contract that accepts any porter bonds and exchanges them
     for new bonds, the exchange contract would need a way to know that the bonds are porter bonds
    */
    function isBond(address) external view returns (bool);

    /**
        @notice Turns the allow list on or off
        @param _isAllowListEnabled If the allow list should be enabled or not
        @dev Must be called by the current owner
    */
    function setIsAllowListEnabled(bool _isAllowListEnabled) external;

    /**
     @notice Address where the bond implementation contract is stored
     @dev this is needed since we are using a clone proxy
    */
    function tokenImplementation() external view returns (address);
}
