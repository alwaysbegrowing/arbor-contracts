# Contracts Overview

## Main contracts
### [BondAuction](./bondAuction.md)
This wraps Gnosis Auction and adds a few pieces of additional functionality.
* Enables issuer to deposit collateral
* Deploys a new bond token representing the debt 
* Handles debt repayment

### [BondToken](./bondToken.md)
BondTokens are sent to investors upon a successful auction. After their maturity date - they can be redeemed for their par value. 
If the DAO issuing the debt defaults they can be exchanged for a proportional share of the underlying collateral. 