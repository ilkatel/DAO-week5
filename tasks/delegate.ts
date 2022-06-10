import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("withdraw", "delegate tokens")
  .addParam("index", "voting index")   
  .addParam("to", "receiver address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.delegate(taskArgs.index, taskArgs.to).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});