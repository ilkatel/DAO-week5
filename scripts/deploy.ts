import { run } from "hardhat";
import { ethers } from "hardhat";
import { DAOVoting__factory } from "../typechain";
import { ERCTOKEN__factory } from "../typechain/factories/ERCTOKEN__factory";

async function main() {
  const [signer] = await ethers.getSigners();

  const token = await new ERCTOKEN__factory(signer).deploy("DAO Token", "DAOT");
  await token.deployed();
  console.log(`Token contract deployed to: ${token.address}`);

  const dao = await new DAOVoting__factory(signer).deploy(token.address, ethers.utils.parseEther("100"), 24*3*60*60);
  await dao.deployed();
  console.log(`DAO contract deployed to: ${dao.address}`);

  await run("verify:verify", {
    address: token.address,
    constructorArguments: ["DAO Token", "DAOT"],
  });

  await run("verify:verify", {
    address: dao.address,
    constructorArguments: [token.address, ethers.utils.parseEther("100"), 24*3*60*60],
  });

  await token.mint(signer.address, ethers.utils.parseEther("10000000000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
