[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949634-988ce327-3261-463f-a1d0-3a3e2d3015dc.png)](https://porter.finance/#gh-dark-mode-only)
[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949612-a695787d-d1d4-4311-90f6-2142aa334e2d.png)](https://porter.finance/#gh-light-mode-only)

<table align="center">
 <td><a href="https://app.porter.finance">app</a></td>
 <td><a href="https://rinkeby.porter.finance">testnet</a></td>
 <td><a href="https://porter.finance">landing</a></td>
 <td><a href="https://docs.porter.finance">docs</a></td>
 <td><a href="https://discord.gg/porter">discord</a></td>
 <td><a href="https://blog.porter.finance">blog</a></td>
 <td><a href="https://twitter.com/porterfinance_">twitter</a></td>
</table>

# Security

Please report any security issues to security@porter.finance

# V1

Smart Contracts powering the Porter protocol.

## Contracts

<table>
  <tr>
    <th></th>
    <th>mainnet</th>
    <th>rinkeby</th>
  </tr>
  <tr>
    <td>BondFactory</td>
    <td><a href="https://etherscan.io/address/0x9f20521ef789fd2020e708390b1e6c701d8218ba">0x9f20521ef789fd2020e708390b1e6c701d8218ba</a></td>
    <td><a href="https://rinkeby.etherscan.io/address/0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0">0x0ae42cF40Fb46A926e2dcCE92b2Fe785d2D1E0A0</a></td>
  </tr>
  <tr>
    <td>Bond Implementation</td>
    <td><a href="https://etherscan.io/address/0x79537dcba69fea2b8dc8292b3726195fe947e332">0x79537dcba69fea2b8dc8292b3726195fe947e332</a></td>
    <td><a href="https://rinkeby.etherscan.io/address/0xebc0d87f2fb27c967a3cb0e36f279579b0116261">0xebc0d87f2fb27c967a3cb0e36f279579b0116261</a></td>
  </tr>
</table>

## What does it do? How does it work?

The Porter V1 protocol allows a borrower to create a Bond. Each minted bond share has some amount of collateral backing and will be redeemable 1 share for 1 stablecoin at maturity. To incentivize lenders, the bond shares will be sold at a discount either OTC or through an auction.

For more information on this process, the [documentation site](https://docs.porter.finance) gives an overview of **what** the protocol does and some of the concepts like zero coupon bonds and the difference between "Simple" and "Convert" Bond types. For **how** the protocol works, check out the [spec](/spec/):

- [overview](/spec/overview.md) — An overview of the Bond and BondFactory as well as what actions Borrowers and Lenders can perform.
  - [bond](/spec/bond.md) — More detailed look at the Bond actions and design decisions.
- [architecture](/spec/architecture.md) — A technical document explaining how the Contracts interact and the lifecycle from deployment, creating a bond, and actions performed on that bond.
- [permissions](/spec/permissions.md) — The trust model and implementation of that model.
- [state machine](/spec/stateMachine.md) — The Bond represented as distinct states.

## Development

For local development there are environment variables necessary to enable some hardhat plugins.

### Deployment

Using hardhat-deploy all of the scripts in the `./deploy` folder are run. This will run the whole integration flow as well which includes deploying of the factory, tokens, creating bonds, doing bond actions, and starting auctions. If that is not desired, add a `tags` flag with what you want to deploy.

```
npx hardhat deploy --tags main-deployment # deploy bond factory
npx hardhat deploy --tags test-deployment # and deploy tokens
npx hardhat deploy --tags permissions # and grant roles & permissions
npx hardhat deploy --tags bonds # and deploy test bonds
npx hardhat deploy --tags auctions # and start bond auctions
npx hardhat deploy --tags actions # and do bond actions
```

Additionally, all of the above commands can be run with `--network rinkeby` to deploy to the Rinkeby test network.

Note: The deploy script will run with the `npx hardhat node` as well as the `npx hardhat test` tasks.

### Verification

The deployment script will automatically verify the BondFactory, Implementation contract, and TestERC20 token. To verify a contract not deployed within that script, use the `hardhat-etherscan` task.

```
npx hardhat verify <address>
```

### Testing

Running the hardhat test suite

```
npx hardhat test
```

Fork testing requires first running the mainnet-fork

```
npx hardhat node
```

and making the target for testing the local node

```
npx hardhat test --network localhost
```

Running the fuzzing test suite with Echidna

- Get latest release https://github.com/crytic/echidna
- Install to `/usr/local/bin`
- `npm run echidna`
- change the config located at `echidna.config.yaml` to tweak execution

### Other useful commands

```shell
npx hardhat help
npx hardhat compile # create contract artifacts
npx hardhat clean # removes artifacts and maybe other things
npx hardhat coverage # runs the contract coverage report
npx hardhat integration # runs the integration task
npx hardhat settle-auction --auctionId <auctionId> # settles an auction
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md,ts}' --write
npx solhint 'contracts/**/*.sol' --fix
```
