import { task } from "hardhat/config";

task(
  "storage-layout",
  "Compiles and prints the storage layout of state variables for all contracts."
).setAction(async (_, hre) => {
  await hre.run("compile");
  await hre.storageLayout.export();
});
