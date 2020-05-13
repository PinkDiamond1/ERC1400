pragma solidity 0.5.10;

import "../../IERC1400.sol";
import "../EternalStorage.sol";
/**
 * @title Controller Module Storages
 */
contract ModuleStorage {
    address public factory;
    address public securityToken;

    /**
     * @notice Constructor
     * @param _factory Address of the factory or admin
     */
    constructor(address _factory) public {
        factory = _factory;
        securityToken = address(0);
    }

}
