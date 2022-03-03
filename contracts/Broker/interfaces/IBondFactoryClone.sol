// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;

interface IBondFactoryClone {
  event BondCreated(address newBond);

  function createBond(
    address _owner,
    address _issuer,
    uint256 _maturityDate,
    uint256 _maxBondSupply,
    address _collateralAddress,
    uint256 _collateralizationRatio,
    address _borrowingAddress,
    bool _isConvertible,
    uint256 _convertibilityRatio
  ) external returns (address);
}
