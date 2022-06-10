import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("finish", "finish voting")
  .addParam("index", "voting index")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.finish(taskArgs.index).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});