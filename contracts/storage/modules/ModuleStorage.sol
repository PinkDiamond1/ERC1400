pragma solidity 0.5.10;

import "../../IERC1400.sol";
import "../EternalStorage.sol";
/**
 * @title Controller Module Storages
 */
contract ModuleStorage is EternalStorage {
    address public factory;
    IERC1400 public securityToken;

    /**
     * @notice Constructor
     * @param _securityToken Address of the security token
     */
    constructor(address _securityToken) public {
        securityToken = IERC1400(_securityToken);
        factory = msg.sender;
    }

}
