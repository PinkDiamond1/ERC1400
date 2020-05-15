pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/access/Roles.sol";
/**
 * @title AdminRole
 * @dev Admins are responsible for assigning and removing role based accounts.
 */
contract AdminRole {
    using Roles for Roles.Role;

    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    Roles.Role private _admins;

    constructor(address owner) public {
        _addAdmin(owner);
    }

    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "Not Admin");
        _;
    }

    function isAdmin(address account) public view returns (bool) {
        return _admins.has(account);
    }

    function addAdmin(address account) public onlyAdmin {
        _addAdmin(account);
    }

    function renounceAdmin() public {
        _removeAdmin(msg.sender);
    }

    function _addAdmin(address account) internal {
        _admins.add(account);
        emit AdminAdded(account);
    }

    function _removeAdmin(address account) internal {
        _admins.remove(account);
        emit AdminRemoved(account);
    }
}