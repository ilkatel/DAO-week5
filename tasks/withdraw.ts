import * as dotenv from "dotenv";

import { task } from "hardhat/config";
import { ContractTransaction as tx } from "ethers";

dotenv.config();

export default task("withdraw", "withdraw tokens")
  .setAction(async (_, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const dao = await hre.ethers.getContractAt("DAOVoting", process.env.DAO as string, signer);
    await dao.withdraw().then((result: tx) => console.log(`tx hash: ${result.hash}`));
});