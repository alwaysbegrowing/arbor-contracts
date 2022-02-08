pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SimpleBond is ERC20Burnable, Ownable, ReentrancyGuard {
  /// @notice this would go into default if maturityDate passes and the loan contract has not been paid back
  /// @notice to be set from the auction
  enum BondStanding {
    GOOD,
    DEFAULTED,
    PAID,
    REDEEMED
  }

  event BondStandingChange(BondStanding oldStanding, BondStanding newStanding);
  event Redeem(address receiver, uint256 amount);

  /// @notice this date is when the DAO must have repaid its debt
  /// @notice when bondholders can redeem their bonds
  uint256 public immutable maturityDate;

  /// @notice holds address to bond standing
  BondStanding public currentBondStanding;

  /// @dev New bond contract will be deployed before each auction
  /// @dev The Auction contract will be the owner
  /// @param _name Name of the bond.
  /// @param _symbol Bond ticket symbol
  /// @param _totalBondSupply Total number of bonds being issued - this is determined by auction config
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _totalBondSupply,
    uint256 _maturityDate
  ) ERC20(_name, _symbol) {
    require(_totalBondSupply > 0, "zeroMintAmount");

    // this timestamp is a date in 2020, which basically is here to confirm
    // the date provided is greater than 0 and a valid timestamp
    require(_maturityDate > 1580752251, "invalid date");

    // This mints bonds based on the config given in the auction contract and
    // sends them to the auction contract
    _mint(msg.sender, _totalBondSupply);
    maturityDate = _maturityDate;
    currentBondStanding = BondStanding.GOOD;
  }

  /// @notice To be set after the auction ends
  function setBondStanding(BondStanding newStanding) external onlyOwner {
    emit BondStandingChange(currentBondStanding, newStanding);

    currentBondStanding = newStanding;
  }

  function redeemBond(uint256 bondShares) external nonReentrant {
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
