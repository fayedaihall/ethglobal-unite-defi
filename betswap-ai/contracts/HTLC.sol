// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HTLC {
    struct Lock {
        address sender;
        address recipient;
        address token;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        bool withdrawn;
    }

    mapping(bytes32 => Lock) public locks;

    event LockCreated(bytes32 id, address recipient, uint256 amount);
    event Withdrawn(bytes32 id);
    event Refunded(bytes32 id);

    function createLock(bytes32 id, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock) external {
        require(locks[id].sender == address(0), "ID exists");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        locks[id] = Lock(msg.sender, recipient, token, amount, hashlock, block.timestamp + timelock, false);
        emit LockCreated(id, recipient, amount);
    }

    function withdraw(bytes32 id, bytes calldata preimage) external {
        Lock storage l = locks[id];
        require(keccak256(preimage) == l.hashlock, "Invalid preimage");
        require(block.timestamp < l.timelock, "Expired");
        require(!l.withdrawn, "Withdrawn");
        l.withdrawn = true;
        IERC20(l.token).transfer(l.recipient, l.amount);
        emit Withdrawn(id);
    }

    function refund(bytes32 id) external {
        Lock storage l = locks[id];
        require(block.timestamp >= l.timelock, "Not expired");
        require(!l.withdrawn, "Withdrawn");
        l.withdrawn = true;
        IERC20(l.token).transfer(l.sender, l.amount);
        emit Refunded(id);
    }
}