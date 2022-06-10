import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("vote", "vote to proposal")
  .addParam("index", "proposal index")
  .addParam("agreement", "proposal agreement at bool")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.vote(taskArgs.index, taskArgs.agreement).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});