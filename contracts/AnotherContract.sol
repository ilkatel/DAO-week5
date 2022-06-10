//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract AnotherContract {

    bool public result;

    // selector: 0xd6f829f2
    function switcher(bool _data) external {
        require(_data, "Function error");
        result = !result;
    }
}
