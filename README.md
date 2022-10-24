# Arbor Smart Contracts

<table align="center">
 <td><a href="https://app.arbor.garden">app</a></td>
 <td><a href="https://goerli.arbor.garden">testnet</a></td>
 <td><a href="https://arbor.garden">landing</a></td>
 <td><a href="https://docs.arbor.garden">docs</a></td>
 <td><a href="https://discord.gg/znhkdtgXWc">discord</a></td>
 <td><a href="https://blog.arbor.garden">blog</a></td>
 <td><a href="https://twitter.com/arborfinance">twitter</a></td>
</table>

# Security

Please report any security issues to security@arbor.garden

# V1

Smart Contracts powering the Arbor protocol.

## Contracts

<table>
  <tr>
    <th></th>
    <th>Mainnet</th>
    <th>Görli</th>
  </tr>
  <tr>
    <td>BondFactory</td>
    <td><a href="https://etherscan.io/address/0x1533Eb8c6cc510863b496D182596AB0e9E77A00c">0x1533Eb8c6cc510863b496D182596AB0e9E77A00c</a></td>
    <td><a href="https://goerli.etherscan.io/address/0xBE9A5b24dbEB65b21Fc91BD825257f5c4FE9c01D">0xBE9A5b24dbEB65b21Fc91BD825257f5c4FE9c01D</a></td>
  </tr>
  <tr>
    <td>Bond Implementation</td>
    <td><a href="https://etherscan.io/address/0x6285D6b0Ccac4ecaF4f7a2738fEc03330809B162">0x6285D6b0Ccac4ecaF4f7a2738fEc03330809B162</a></td>
    <td><a href="https://goerli.etherscan.io/address/0xF457Fcb60F761c98b23b4edDe638E99711476FF7">0xF457Fcb60F761c98b23b4edDe638E99711476FF7</a></td>
  </tr>
</table>

## What does it do? How does it work?

The Arbor protocol allows a borrower to create a Bond. Each minted bond share has some amount of collateral backing and will be redeemable 1 share for 1 stablecoin at maturity. To incentivize lenders, the bond shares will be sold at a discount either OTC or through an auction.

For more information on this process, the [documentation site](https://docs.arbor.garden) gives an overview of **what** the protocol does and some of the concepts like zero coupon bonds and the difference between "Simple" and "Convert" Bond types. For **how** the protocol works, check out the [spec](/spec/):

- [overview](/spec/overview.md) — An overview of the Bond and BondFactory as well as what actions Borrowers and Lenders can perform.
  - [bond](/spec/bond.md) — More detailed look at the Bond actions and design decisions.
- [architecture](/spec/architecture.md) — A technical document explaining how the Contracts interact and the lifecycle from deployment, creating a bond, and actions performed on that bond.
- [permissions](/spec/permissions.md) — The trust model and implementation of that model.
- [state machine](/spec/stateMachine.md) — The Bond represented as distinct states.

## Development

For local development there are environment variables necessary to enable some hardhat plugins. To interact with the frontend, you will also need to update your wallet with a new network pointing to hardhat's network.

```
Network Name: Hardhat
RPC URL: http://localhost:8545
Chain ID: 31337
Currency: ETH
```

Then, run the local node with `npx hardhat node`. If forking a blockchain, avoid deploying dependencies with the `--no-deploy` flag: `npx hardhat node --no-deploy`.

### Deployment

Using hardhat-deploy all of the scripts in the `./deploy` folder are run. This will run the whole integration flow as well which includes deploying of the factory, tokens, creating bonds, doing bond actions, and starting auctions. If that is not desired, add a `tags` flag with what you want to deploy.

```
npx hardhat deploy --tags main-deployment # deploy bond factory
npx hardhat deploy --tags test-deployment # and deploy tokens
npx hardhat deploy --tags permissions # and grant roles & permissions
npx hardhat deploy --tags e2e # and run e2e test
npx hardhat deploy --tags bonds # and deploy test bonds
npx hardhat deploy --tags auctions # and start bond auctions
npx hardhat deploy --tags actions # and do bond actions
```

Additionally, all of the above commands can be run with `--network goerli` to deploy to the Görli test network.

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
