[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949634-988ce327-3261-463f-a1d0-3a3e2d3015dc.png)](https://porter.finance/#gh-dark-mode-only)
[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/159949612-a695787d-d1d4-4311-90f6-2142aa334e2d.png)](https://porter.finance/#gh-light-mode-only)

<table align="center">
 <td><a href="https://porter.finance">app</a></td>
 <td><a href="https://docs.porter.finance">docs</a></td>
 <td><a href="https://discord.gg/porter">discord</a></td>
 <td><a href="https://blog.porter.finance">blog</a></td>
 <td><a href="https://twitter.com/porterfinance_">twitter</a></td>
</table>

# V1

Smart Contracts powering the Porter protocol.

## Development

For local development there are environment variables necessary to enable some hardhat plugins.

### Deployment

Using hardhat-deploy all of the scripts in the `./deploy` folder are run.

Deploying to rinkeby

```
npx hardhat deploy --network rinkeby
```

### Verification

Verify deployed contracts with `hardhat-etherscan`.

```
npx hardhat verify <address>
```

### Testing

Running the test suite

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

### Other useful commands

```shell
npx hardhat help
npx hardhat compile # create contract artifacts
npx hardhat clean # removes artifacts and maybe other things
npx hardhat coverage # runs the contract coverage report
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md,ts}' --write
npx solhint 'contracts/**/*.sol' --fix
```
