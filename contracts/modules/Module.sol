pragma solidity 0.5.10;

import "./IModule.sol";
import "../Pausable.sol";
import "../IERC1400.sol";
import "../storage/modules/ModuleStorage.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../proxy/OwnedUpgradeabilityProxy.sol";
import "../interface/ERC1820Implementer.sol";
import "erc1820/contracts/ERC1820Client.sol";
import "../interface/IERC1820Management.sol";

/**
 * @title Interface that any module contract should implement
 * @notice Contract is abstract
 * @notice On OwnedUpgradeabilityProxy, owner is msg.sender
 */
contract Module is IModule, ModuleStorage, Pausable, OwnedUpgradeabilityProxy, ERC1820Client, ERC1820Implementer {
    /**
     * @notice Constructor
     * @param factory Address of the factory or admin creating
     */
    constructor (address factory) public
    ModuleStorage(factory)
    {
        delegateManagement(factory); // ERC1820 Allows to use the registry (factory) to connect hook contracts
    }

    //Allows owner, factory or permissioned delegate
    modifier withControllerPermission() {
        require(_checkControllerPermission(msg.sender), "Invalid controller permission");
        _;
    }

    function _checkControllerPermission(address _caller) internal view returns (bool) {
        bool isOwner = _caller == Ownable(address(securityToken)).owner();
        bool isFactory = _caller == factory;
        if(!(isOwner || isFactory)){
            return IERC1400(address(securityToken)).isOperator(_caller, address(0));
        }
        return isOwner || isFactory;
    }

    function _checkControllerPermissionByPartition( bytes32 partition,address _caller, address _tokenHolder) internal view returns (bool) {
        bool isOwner = _caller == Ownable(address(securityToken)).owner();
        bool isFactory = _caller == factory;
        if(!(isOwner || isFactory)){
            return IERC1400(address(securityToken)).isOperatorForPartition(partition, _caller, _tokenHolder);
        }
        return isOwner || isFactory;
    }

    function _onlySecurityTokenOwner() internal view {
        require(msg.sender == Ownable(address(securityToken)).owner(), "Sender is not owner");
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Sender is not factory");
        _;
    }

    /**
     * @notice Pause (overridden function)
     */
    function pause() public {
        _onlySecurityTokenOwner();
        super._pause();
    }

    /**
     * @notice Unpause (overridden function)
     */
    function unpause() public {
        _onlySecurityTokenOwner();
        super._unpause();
    }

    /**
    * @notice Reclaims ERC20Basic compatible tokens
    * @dev We duplicate here due to the overriden owner & onlyOwner
    * @param _tokenContract The address of the token contract
    */
    function reclaimERC20(address _tokenContract) public {
        _onlySecurityTokenOwner();
        require(_tokenContract != address(0), "Invalid address");
        IERC20 token = IERC20(_tokenContract);
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(msg.sender, balance), "Transfer failed");
    }

    /**
     * @notice Reclaims ETH
     * @dev We duplicate here due to the overriden owner & onlyOwner
     */
    function reclaimETH() external {
        _onlySecurityTokenOwner();
        msg.sender.transfer(address(this).balance);
    }
}
