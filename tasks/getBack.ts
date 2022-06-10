import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("getBack", "get back delegated tokens")
  .addParam("index", "voting index")   
  .addParam("from", "receiver address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.getBack(taskArgs.index, taskArgs.from).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});