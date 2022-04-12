// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

interface IBondFactory {
    /**
        @notice Emitted when the allow list is toggled on or off.
        @param isAllowListEnabled The new state of the allow list.
    */
    event AllowListEnabled(bool isAllowListEnabled);

    /**
        @notice Emitted when a new bond is created.
        @param newBond The address of the newley deployed bond.
        @param name Passed into the ERC20 token to define the name.
        @param symbol Passed into the ERC20 token to define the symbol.
        @param owner Ownership of the created Bond is transferred to this
            address by way of DEFAULT_ADMIN_ROLE. The ability to withdraw is 
            given by WITHDRAW_ROLE, and tokens are minted to this address. See
            `initialize` in `Bond`.
        @param maturityDate The timestamp at which the Bond will mature.
        @param paymentToken The ERC20 token address the Bond is redeemable for.
        @param collateralToken The ERC20 token address the Bond is backed by.
        @param collateralTokenAmount The amount of collateral tokens per bond.
        @param convertibleTokenAmount The amount of convertible tokens per bond.
        @param bonds The amount of Bonds given to the owner during the one-time
            mint during the `Bond`'s `initialize`.
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

    /// @notice Fails if the collateralToken takes a fee.
    error InvalidDeposit();

    /// @notice Decimals with more than 18 digits are not supported.
    error DecimalsOver18();

    /// @notice Maturity date is not valid.
    error InvalidMaturityDate();

    /// @notice There must be more collateralTokens than convertibleTokens.
    error CollateralTokenAmountLessThanConvertibleTokenAmount();

    /// @notice Bonds must be minted during initialization.
    error ZeroBondsToMint();

    /// @notice The paymentToken and collateralToken must be different.
    error TokensMustBeDifferent();

    /**
        @notice Creates a new Bond.
        @param name Passed into the ERC20 token to define the name.
        @param symbol Passed into the ERC20 token to define the symbol.
        @param maturityDate The timestamp at which the Bond will mature.
        @param paymentToken The ERC20 token address the Bond is redeemable for.
        @param collateralToken The ERC20 token address the Bond is backed by.
        @param collateralTokenAmount The amount of collateral tokens per bond.
        @param convertibleTokenAmount The amount of convertible tokens per bond.
        @param bonds The amount of Bonds given to the owner during the one-time
            mint during the `Bond`'s `initialize`.
        @dev This uses a clone to save on deployment costs which adds a slight
            overhead when users interact with the bonds, but also saves on gas
            during every deployment.
        @return clone The address of the newly created Bond.
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

    /// @notice If enabled, issuance is restricted to those with ISSUER_ROLE.
    function isAllowListEnabled() external view returns (bool);

    /**
        @notice Check if the address was created by this Bond factory.
        @dev This is used to check if a bond was issued by this contract
            on-chain. For example, if we want to make a new contract that
            accepts any issued bonds and exchanges them for new Bonds, the
            exchange contract would need a way to know that the Bonds are owned
            by this contract.
    */
    function isBond(address) external view returns (bool);

    /**
        @notice Turns the allow list on or off.
        @param _isAllowListEnabled If the allow list should be enabled or not.
        @dev Must be called by the current owner.
    */
    function setIsAllowListEnabled(bool _isAllowListEnabled) external;

    /**
        @notice Address where the bond implementation contract is stored.
        @dev This is needed since we are using a clone proxy.
        @return The implementation address.
    */
    function tokenImplementation() external view returns (address);
}
