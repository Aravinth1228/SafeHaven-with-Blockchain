// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrustedForwarder
 * @author SafeHeaven
 * @notice ERC-2771 Trusted Forwarder contract for gasless meta-transactions
 * @dev This contract receives and executes meta-transactions from users
 *      The backend relayer will submit transactions on behalf of users
 */
contract TrustedForwarder is ERC2771Forwarder, ReentrancyGuard {
    address public owner;

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() ERC2771Forwarder("SafeHeaven Trusted Forwarder") {
        owner = msg.sender;
    }

    /**
     * @notice Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }
}
