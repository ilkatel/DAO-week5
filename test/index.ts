import { expect } from "chai";
import { ethers } from "hardhat";
import { DAOVoting } from "../typechain";
import { DAOVoting__factory } from "../typechain";
import { AnotherContract } from "../typechain/AnotherContract";
import { AnotherContract__factory } from "../typechain/factories/AnotherContract__factory";
import { ERCTOKEN } from "../typechain/ERCTOKEN";
import { ERCTOKEN__factory } from "../typechain/factories/ERCTOKEN__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

let token: ERCTOKEN;
let anotherContract: AnotherContract;
let dao: DAOVoting;
let accs: SignerWithAddress[];
const duration: number = 24*60*60*3;
const zeroHash = ethers.constants.HashZero;
const zeroAddress = ethers.constants.AddressZero;

const ABI = [
  "function switcher(bool _data)",
  "function vote(uint256 _index, bool _agreement)",
  "function changeQuorum(uint _minimumQuorum)",
  "function changeDuration(uint _duration)",
  "function changePersonRights(address _user)"
];
const iface = new ethers.utils.Interface(ABI);

async function sleep(_duration: number) {
  await ethers.provider.send("evm_increaseTime", [_duration]);
  await ethers.provider.send("evm_mine", []);
}

describe("Tests", function () {
  beforeEach(async function () {
    accs = await ethers.getSigners();
    token = await new ERCTOKEN__factory(accs[0]).deploy("DAOToken", "DAOT");
    await token.deployed();
    dao = await new DAOVoting__factory(accs[0]).deploy(token.address, 2, duration);
    await dao.deployed();
    anotherContract = await new AnotherContract__factory(accs[0]).deploy();
    await anotherContract.deployed();

    await token.mint(accs[0].address, ethers.utils.parseEther("10"));
    await token.mint(accs[1].address, ethers.utils.parseEther("10"));
  });

  it("SUCCESS  | Deposit: Deposit success", async function () {
    console.log("==================== Deposit ====================");

    await token.approve(dao.address, 100);
    await expect(() => dao.deposit(100)).to.changeTokenBalances(token, [accs[0], dao], [-100, 100]);
    expect((await dao.users(accs[0].address)).tokensAmount).to.be.eq(100);
  });

  it("REVERTED | Deposit: Without approve", async function () {
    await expect(dao.deposit(100)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("REVERTED | DepositTo: Deposit to the zero address", async function () {
    await expect(dao.depositTo(zeroAddress, 100)).to.be.revertedWith("Cant deposit to zero address");
  });

  it("SUCCESS  | AddProposal: Adding proposal", async function () {
    console.log("==================== AddProposal ================");

    const signature = iface.encodeFunctionData("switcher", [true]);
    await dao.addProposal(anotherContract.address, signature as string);
    expect((await dao.vp(0)).signature).to.be.eq(signature);
  });

  it("REVERTED | AddProposal: Not chairperson add proposal", async function () {
    await expect(dao.connect(accs[1]).addProposal(zeroAddress, zeroHash))
      .to.be.revertedWith("You are not chairperson");
  });

  it("REVERTED | AddProposal: Null receiver address", async function () {
    await expect(dao.addProposal(zeroAddress, zeroHash))
      .to.be.revertedWith("Receiver address cant be null");
  });

  it("REVERTED | AddProposal: Incorrect selector", async function () {
    await expect(dao.addProposal(anotherContract.address, zeroHash))
      .to.be.revertedWith("Incorrect function selector");
  });

  describe("", function () {
    beforeEach(async function () {
      const signature = iface.encodeFunctionData("switcher", [true]);
      await dao.addProposal(anotherContract.address, signature as string);

      await token.approve(dao.address, ethers.utils.parseEther("10"));
      await token.connect(accs[1]).approve(dao.address, ethers.utils.parseEther("10"));
      await dao.deposit(100);
      await dao.connect(accs[1]).deposit(100);
    });

    it("SUCCESS  | Vote: Agree vote", async function () {
      console.log("==================== Vote =======================");

      await dao.vote(0, true);
      expect((await dao.vp(0)).agreeVotes).to.be.eq(100);
    });

    it("SUCCESS  | Vote: Disagree vote", async function () {
      await dao.vote(0, false);
      expect((await dao.vp(0)).disagreeVotes).to.be.eq(100);
    });

    it("SUCCESS  | Vote: Changed withdrawTime", async function () {
      await dao.vote(0, false);
      expect((await dao.users(accs[0].address)).withdrawTime)
        .to.be.eq((await dao.vp(0)).finishTime);
    });

    it("SUCCESS  | Vote: Not changed withdrawTime", async function () {
      await sleep(10);
      const _signature = iface.encodeFunctionData("switcher", [false]);
      await dao.addProposal(anotherContract.address, _signature as string);

      await dao.vote(1, false);
      const finishTime = (await dao.vp(1)).finishTime
      expect((await dao.users(accs[0].address)).withdrawTime)
        .to.be.eq(finishTime);
      await dao.vote(0, false);
      expect((await dao.users(accs[0].address)).withdrawTime)
        .to.be.eq(finishTime);
    });

    it("REVERTED | Vote: Cant find voting", async function () {
      await expect(dao.vote(1, true)).to.be.revertedWith("Cant find voting");
    });
  
    it("REVERTED | Vote: Time is over", async function () {
      await sleep(duration);
      await expect(dao.vote(0, true)).to.be.revertedWith("Time is over");
    });
  
    it("REVERTED | Vote: Have no tokens", async function () {
      await expect(dao.connect(accs[2]).vote(0, true)).to.be.revertedWith("Have no tokens to vote");
    });
  
    it("REVERTED | Vote: Vote again", async function () {
      await dao.vote(0, true);
      await expect(dao.vote(0, true)).to.be.revertedWith("Cant vote again");
    });

    it("SUCCESS  | Finish: Finishing without execution (< minimumQuorum)", async function () {
      console.log("==================== Finish =====================");
      
      await sleep(duration);
      await dao.finish(0);
      expect(await anotherContract.result()).to.be.eq(false);
    });

    it("SUCCESS  | Finish: Finishing without execution (agree <= disagree)", async function () {
      await dao.vote(0, false);
      await dao.connect(accs[1]).vote(0, true);
      await sleep(duration);
      await dao.finish(0);
      expect(await anotherContract.result()).to.be.eq(false);
    });

    it("SUCCESS  | Finish: Finishing with execution", async function () {
      await dao.vote(0, true);
      await dao.connect(accs[1]).vote(0, true);
      await sleep(duration);
      await dao.finish(0);
      expect(await anotherContract.result()).to.be.eq(true);
    });

    it("REVERTED | Finish: Called function revert", async function () {
      const _signature = iface.encodeFunctionData("switcher", [false]);
      await dao.addProposal(anotherContract.address, _signature as string);
      await dao.vote(1, true);
      await dao.connect(accs[1]).vote(1, true);
      await sleep(duration);
      await expect(dao.finish(1)).to.be.revertedWith("Function error");
      expect(await anotherContract.result()).to.be.eq(false);
    });

    it("REVERTED | Finish: Cant find voting", async function () {
      await expect(dao.finish(1)).to.be.revertedWith("Cant find voting");
    });

    it("REVERTED | Finish: Cant finish yet", async function () {
      await expect(dao.finish(0)).to.be.revertedWith("Cant finish voting yet");
    });

    it("REVERTED | Finish: Already finished", async function () {
      await sleep(duration);
      await dao.finish(0);
      await expect(dao.finish(0)).to.be.revertedWith("Already finished");
    });

    it("SUCCESS  | Withdraw: Success withdraw", async function () {
      console.log("==================== Withdraw ===================");

      await expect(() => dao.withdraw()).to.changeTokenBalances(token, [accs[0], dao], [100, -100]);
      expect((await dao.users(accs[0].address)).tokensAmount).to.be.eq(0);
    });

    it("REVERTED | Withdraw: Nothing to withdraw", async function () {
      await expect(dao.connect(accs[2]).withdraw()).to.be.revertedWith("Nothing to withdraw");
    });

    it("REVERTED | Withdraw: Cant withdraw yet", async function () {
      await dao.vote(0, true);
      await expect(dao.withdraw()).to.be.revertedWith("Cant withdraw yet");
    });

    it("SUCCESS  | Delegate: Changed withdrawTime", async function () {
      console.log("==================== Delegate ===================");

      await dao.delegate(0, accs[1].address);
      expect((await dao.users(accs[0].address)).withdrawTime).to.be.eq((await dao.vp(0)).finishTime);
      expect((await dao.users(accs[1].address)).withdrawTime).to.be.eq(0);
    });

    it("SUCCESS  | Delegate: Not changed withdrawTime", async function () {
      await sleep(10);
      const _signature = iface.encodeFunctionData("switcher", [false]);
      await dao.addProposal(anotherContract.address, _signature as string);

      await dao.delegate(1, accs[1].address);
      const finishTime = (await dao.vp(1)).finishTime;
      expect((await dao.users(accs[0].address)).withdrawTime).to.be.eq(finishTime);
      await dao.delegate(0, accs[1].address);
      expect((await dao.users(accs[0].address)).withdrawTime).to.be.eq(finishTime);
    });

    it("REVERTED | Delegate: Time is over", async function () {
      await sleep(duration);
      await expect(dao.delegate(0, accs[1].address)).to.be.revertedWith("Time is over");
    });

    it("REVERTED | Delegate: Delegate to yourself", async function () {
      await expect(dao.delegate(0, accs[0].address)).to.be.revertedWith("Cant delegate to yourself");
    });

    it("REVERTED | Delegate: Delegate zero tokens", async function () {
      await expect(dao.connect(accs[2]).delegate(0, accs[0].address)).to.be.revertedWith("Nothing to delegate");
    });

    it("REVERTED | Delegate: Already voted", async function () {
      await dao.vote(0, true);
      await expect(dao.delegate(0, accs[1].address)).to.be.revertedWith("You already voted");
    });

    it("REVERTED | Delegate: Person already voted", async function () {
      await dao.connect(accs[1]).vote(0, true);
      await expect(dao.delegate(0, accs[1].address)).to.be.revertedWith("This person already voted");
    });

    it("SUCCESS  | GetBack: GetBack successfull", async function () {
      console.log("==================== GetBack ====================");

      await dao.delegate(0, accs[1].address);
      await dao.getBack(0, accs[1].address);
    });

    it("REVERTED | GetBack: Time is over", async function () {
      await dao.delegate(0, accs[1].address);
      await sleep(duration);
      await expect(dao.getBack(0, accs[1].address)).to.be.revertedWith("Time is over");
    });

    it("REVERTED | GetBack: Person already voted", async function () {
      await dao.delegate(0, accs[1].address);
      await dao.connect(accs[1]).vote(0, true);
      await expect(dao.getBack(0, accs[1].address)).to.be.revertedWith("This person already voted");
    });

    it("REVERTED | GetBack: Nothin to getting back", async function () {
      await expect(dao.getBack(0, accs[1].address)).to.be.revertedWith("Nothing to getting back");
    });

    it("SUCCESS  | ChangeQuorum: Changed minimum quorum", async function () {
      console.log("==================== Another funcs ==============");

      await dao.changeQuorum(10);
      expect(await dao.minimumQuorum()).to.be.eq(10);
    });

    it("SUCCESS  | DebatingDuration: Changed debating duration", async function () {
      await dao.changeDuration(10);
      expect(await dao.debatingDuration()).to.be.eq(10);
    });

    it("SUCCESS  | ChangePersonRights: Changed person rights", async function () {
      await dao.changePersonRights(accs[1].address);
      expect(await dao.chairPersons(accs[1].address)).to.be.eq(true);
    });

    it("SUCCESS  | CanChange: Changed params with self-calling", async function () {
      console.log("==================== Modifiers ==================");

      const _signature = iface.encodeFunctionData("changeQuorum", [20]);
      await dao.addProposal(dao.address, _signature as string);
      await dao.vote(1, true);
      await dao.connect(accs[1]).vote(1, true);
      await sleep(duration);
      await dao.finish(1);
      expect(await dao.minimumQuorum()).to.be.eq(20);
    });

    it("REVERTED | CanChange: Not chairperson try change params", async function () {
      await expect(dao.connect(accs[2]).changeDuration(10)).to.be.revertedWith("Have no rights");
    });

    it("REVERTED | NotThis: Try contract call self functions", async function () {
      const _signature = iface.encodeFunctionData("vote", [0, true]);
      await dao.addProposal(dao.address, _signature as string);
      await dao.vote(1, true);
      await dao.connect(accs[1]).vote(1, true);
      await sleep(duration);
      await expect(dao.finish(1)).to.be.revertedWith("Cant run it from this address");
    });
  });
});