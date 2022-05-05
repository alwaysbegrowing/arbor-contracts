[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949634-988ce327-3261-463f-a1d0-3a3e2d3015dc.png)](https://porter.finance/#gh-dark-mode-only)
[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949612-a695787d-d1d4-4311-90f6-2142aa334e2d.png)](https://porter.finance/#gh-light-mode-only)

<table align="center">
 <td><a href="https://porter.finance">app</a></td>
 <td><a href="https://docs.porter.finance">docs</a></td>
 <td><a href="https://discord.gg/porter">discord</a></td>
 <td><a href="https://blog.porter.finance">blog</a></td>
 <td><a href="https://twitter.com/porterfinance_">twitter</a></td>
</table>

# Security 
Please report any security issues to security@porter.finance

# V1

Smart Contracts powering the Porter protocol.

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

Verify deployed contracts with `hardhat-etherscan`.

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
