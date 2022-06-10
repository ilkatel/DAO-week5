import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("addProposal", "Adding proposal")
  .addParam("receiver", "receiver contract address")
  .addParam("signature", "bytes signature")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.addProposal(taskArgs.receiver, taskArgs.signature).then((result: tx) => console.log(`tx hash: ${result.hash}`));
});