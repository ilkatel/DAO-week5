import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("deposit", "deposit tokens")
  .addParam("amount", "amount tokens")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);

    const erc20 = await hre.ethers.getContractAt("ERCTOKEN", process.env.ERC20 as string, signer);
    await erc20.approve(dao.address, taskArgs.amount);

    await dao.deposit(taskArgs.amount).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});