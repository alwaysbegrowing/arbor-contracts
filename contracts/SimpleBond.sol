pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

import "hardhat/console.sol";

contract SimpleBond is ERC20Burnable, Ownable {
  event Redeem(address receiver, uint256 amount);
  event Deposit(address sender, uint256 amount);

  /// @notice this date is when the DAO must have repaid its debt
  /// @notice when bondholders can redeem their bonds
  uint256 public maturityDate;

  /// @notice this would go into default if maturityDate passes and the loan contract has not been paid back
  /// @notice to be set from the auction
  enum BondStanding {
    GOOD,
    DEFAULTED,
    PAID,
    REDEEMED
  }

  /// @notice holds address to bond standings
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
    require(_maturityDate > 1580752251, "invalid date");

    // This mints bonds based on the config given in the auction contract and
    // sends them to the auction contract
    _mint(msg.sender, _totalBondSupply);
    maturityDate = _maturityDate;
    setBondStanding(BondStanding.GOOD);

    console.log(
      "Created tokenized bonds with totalSupply of",
      _totalBondSupply
    );
  }

  /// @notice To be set after the auction ends
  function setBondStanding(BondStanding standing) public onlyOwner {
    currentBondStanding = standing;
  }

  function redeemBond(uint256 numberOfBonds) public {
    require(totalSupply() > 0, "invalid total supply");
    require(
      numberOfBonds > 0 || numberOfBonds > totalSupply(),
      "invalid numberOfBonds"
    );
    require(block.timestamp >= maturityDate, "bond still immature");

    // check that the DAO has already paid back the bond, set from auction
    require(currentBondStanding == BondStanding.PAID, "bond not yet paid");

    burn(numberOfBonds);

    // TODO: code needs added here that sends the investor their how much they are owed in paymentToken
    // this might be calling the auction contract with AuctionContract.redeem(msg.sender, numberOfBonds * faceValue)

    // once all bonds are burned, then this can be set to redeemed
    if (totalSupply() <= 0) {
      setBondStanding(BondStanding.REDEEMED);
    }

    emit Redeem(msg.sender, numberOfBonds);
  }
}
