//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAOVoting {

    struct VotingProcess {
        bool finished;
        uint256 disagreeVotes;
        uint256 agreeVotes;
        uint256 finishTime;
        address receiver;
        bytes signature;
    }

    struct User {
        uint256 tokensAmount;
        uint256 withdrawTime;
        mapping(uint256 => bool) voted;  // index => is voted
        mapping(uint256 => uint256) allocated;  // index => amount
        mapping(uint256 => mapping(address => uint256)) delegated;  // index => to => amount
    }
    
    address public owner;
    uint256 public minimumQuorum;
    uint256 public debatingDuration;
    IERC20 immutable public token;
    mapping(address => User) public users;
    mapping(address => bool) public chairPersons;
    VotingProcess[] public vp;


    constructor(
        address _token,
        uint256 _minimumQuorum,
        uint256 _debatingDuration
    ) {
        owner = msg.sender;
        token = IERC20(_token);
        minimumQuorum = _minimumQuorum;
        debatingDuration = _debatingDuration;
        changePersonRights(msg.sender);
    }

    // Modifier to protect calling self functions
    modifier notThis() {
        require(msg.sender != address(this), "Cant run it from this address");
        _;
    }

    modifier canChange() {
        require(msg.sender == owner || msg.sender == address(this), "Have no rights");
        _;
    }

    function addProposal(address _receiver, bytes calldata _signature) external notThis {
        require(chairPersons[msg.sender], "You are not chairperson");
        require(_receiver != address(0), "Receiver address cant be null");

        bytes4 selector;
        assembly {
            selector := calldataload(_signature.offset)
        }
        require(selector != bytes4(0), "Incorrect function selector");

        vp.push(VotingProcess(
            {
                finishTime: block.timestamp + debatingDuration,
                disagreeVotes: 0,
                agreeVotes: 0,
                receiver: _receiver,
                signature: _signature,
                finished: false
            }
        ));
    }

    function vote(uint256 _index, bool _agreement) external notThis {
        require(_index < vp.length, "Cant find voting");
        require(vp[_index].finishTime > block.timestamp, "Time is over");
        address _sender = msg.sender;

        uint totalAmount = users[_sender].tokensAmount + users[_sender].allocated[_index];
        require(totalAmount > 0, "Have no tokens to vote");
        require(!users[_sender].voted[_index], "Cant vote again");

        if (vp[_index].finishTime > users[_sender].withdrawTime)
            users[_sender].withdrawTime = vp[_index].finishTime;

        users[_sender].voted[_index] = true;

        if (_agreement) vp[_index].agreeVotes += totalAmount;
        else vp[_index].disagreeVotes += totalAmount;
    }   

    function finish(uint256 _index) external notThis {
        require(_index < vp.length, "Cant find voting");
        require(vp[_index].finishTime <= block.timestamp, "Cant finish voting yet");
        require(!vp[_index].finished, "Already finished");

        vp[_index].finished = true;
        if ((vp[_index].disagreeVotes + vp[_index].agreeVotes >= minimumQuorum) && (vp[_index].disagreeVotes < vp[_index].agreeVotes)) {

            (bool success, bytes memory data) = vp[_index].receiver.call{value: 0}(vp[_index].signature);
            if (success) return;
            assembly {
                revert(add(data, 32), mload(data))
            }
        }
    }

    function deposit(uint256 _amount) external notThis {
        depositTo(msg.sender, _amount);
    }

    function depositTo(address _to, uint256 _amount) public notThis {
        require(_to != address(0), "Cant deposit to zero address");
        // *its do ERC20 ontract
        // require(_amount > 0, "Cant deposit zero tokens");

        token.transferFrom(msg.sender, address(this), _amount);

        users[_to].tokensAmount += _amount;
    }

    function withdraw() external notThis {
        address _sender = msg.sender;
        require(users[_sender].tokensAmount > 0, "Nothing to withdraw");
        require(users[_sender].withdrawTime < block.timestamp, "Cant withdraw yet");

        uint _amount = users[_sender].tokensAmount;
        users[_sender].tokensAmount = 0;

        token.transfer(_sender, _amount);
    }

    function delegate(uint256 _index, address _to) external notThis {
        require(vp[_index].finishTime > block.timestamp, "Time is over");

        address _sender = msg.sender;
        require(_to != msg.sender, "Cant delegate to yourself");
        require(users[_sender].tokensAmount > 0, "Nothing to delegate");
        require(!users[_sender].voted[_index], "You already voted");
        require(!users[_to].voted[_index], "This person already voted");

        if (vp[_index].finishTime > users[_sender].withdrawTime)
            users[_sender].withdrawTime = vp[_index].finishTime;

        uint totalAmount = users[_sender].tokensAmount + users[_sender].allocated[_index];
        users[_sender].voted[_index] = true;
        users[_to].allocated[_index] += totalAmount;
        users[_sender].delegated[_index][_to] = totalAmount;
    }   

    function getBack(uint256 _index, address _from) external notThis {
        require(vp[_index].finishTime > block.timestamp, "Time is over");

        address _sender = msg.sender;
        require(!users[_from].voted[_index], "This person already voted");

        uint totalAmount = users[_sender].delegated[_index][_from];
        require(totalAmount > 0, "Nothing to getting back");
        
        users[_from].allocated[_index] -= totalAmount;
        users[_sender].delegated[_index][_from] = 0;
        users[_sender].voted[_index] = false;
    }

    // selector: 0xd2cd96bd
    function changeQuorum(uint256 _minimumQuorum) external canChange { 
        minimumQuorum = _minimumQuorum;
    }

    // selector: 0xb594f086
    function changeDuration(uint256 _duration) external canChange { 
        debatingDuration = _duration;
    }

    // selector: 0x43a0a31f
    function changePersonRights(address _user) public canChange { 
        chairPersons[_user] = !chairPersons[_user];
    }
}
