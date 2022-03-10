[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/157589962-34664111-72cb-40c9-81cf-86253cb671c4.png)](https://porter.finance/#gh-dark-mode-only)
[![Porter Smart Contracts](https://user-images.githubusercontent.com/7458951/157590019-ef886a73-bda8-489f-888d-a98faecf9c61.png)](https://porter.finance/#gh-light-mode-only)

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
Deploying privately on Tenderly requires a log in to the tenderly-cli and ensure the `tenderly.push` command is used in the deploy scripts.
```
npx hardhat deploy
```
### Verification
Verify deployed contracts with `hardhat-etherscan`.
```
npx hardhat verify <address>
```
Verify contract with Tenderly also requires a log in to the tenderly-cli and ensure the `tenderly.verify` command is used in the deploy scripts.
```
npx hardhat deploy
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
