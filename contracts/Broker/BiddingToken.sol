//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BiddingToken is ERC20 {
  constructor(
    string memory name,
    string memory symbol,
    uint96 _mintAmount
  ) ERC20(name, symbol) {
    _mint(msg.sender, _mintAmount);
  }
}
