// SPDX-License-Identifier: AGPL
pragma solidity 0.8.9;
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleBond is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  ReentrancyGuard
{
  /// @notice this would go into default if maturityDate passes and the loan contract has not been paid back
  /// @notice to be set from the auction
  enum BondStanding {
    // the auction completed
    GOOD,
    // when maturity date passes and its unpaid
    DEFAULTED,
    // after DAO pays
    PAID,
    // when 100% of bondholders have redeemed their bonds
    REDEEMED,
    // when something goes wrong and this contract becomes nullified
    NULL
  }

  event BondStandingChange(BondStanding oldStanding, BondStanding newStanding);
  event Redeem(address receiver, uint256 amount);

  /// @notice this date is when the DAO must have repaid its debt
  /// @notice when bondholders can redeem their bonds
  uint256 public maturityDate;

  /// @notice holds address to bond standing
  BondStanding public currentBondStanding;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /// @dev New bond contract will be deployed before each auction
  /// @dev The Auction contract will be the owner
  /// @param _name Name of the bond.
  /// @param _symbol Bond ticket symbol
  /// @param _totalBondSupply Total number of bonds being issued - this is determined by auction config
  function initialize(
    string memory _name,
    string memory _symbol,
    uint256 _totalBondSupply,
    uint256 _maturityDate,
    address _owner
  ) public initializer {
    require(_totalBondSupply > 0, "zeroMintAmount");

    // this timestamp is a date in 2020, which basically is here to confirm
    // the date provided is greater than 0 and a valid timestamp
    require(_maturityDate > 1580752251, "invalid date");

    // This mints bonds based on the config given in the auction contract and
    // sends them to the auction contract
    __ERC20_init(_name, _symbol);
    __ERC20Burnable_init();
    __Ownable_init();

    _mint(_owner, _totalBondSupply);

    maturityDate = _maturityDate;
    _transferOwnership(_owner);
    currentBondStanding = BondStanding.GOOD;
  }

  /// @notice To be set after the auction ends
  function setBondStanding(BondStanding newStanding) external onlyOwner {
    emit BondStandingChange(currentBondStanding, newStanding);

    currentBondStanding = newStanding;
  }

  function redeemBond(uint256 bondShares) external onlyOwner nonReentrant {
    require(bondShares > 0, "invalid amount");
    require(block.timestamp >= maturityDate, "bond still immature");

    // check that the DAO has already paid back the bond, set from auction
    require(currentBondStanding == BondStanding.PAID, "bond not yet paid");

    burn(bondShares);

    // TODO: code needs added here that sends the investor their how much they are owed in paymentToken
    // this might be calling the auction contract with AuctionContract.redeem(msg.sender, bondShares * faceValue)

    // once all bonds are burned, then this can be set to redeemed
    if (totalSupply() == 0) {
      currentBondStanding = BondStanding.REDEEMED;
    }

    emit Redeem(msg.sender, bondShares);
  }
}
