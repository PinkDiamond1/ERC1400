pragma solidity 0.5.10;

import "./IModule.sol";
import "../Pausable.sol";
import "../IERC1400.sol";
import "../storage/modules/ModuleStorage.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../proxy/OwnedUpgradeabilityProxy.sol";
import "../interface/ERC1820Implementer.sol";

/**
 * @title Interface that any module contract should implement
 * @notice Contract is abstract
 * @notice On OwnedUpgradeabilityProxy, owner is msg.sender
 */
contract Module is IModule, ModuleStorage, Pausable, OwnedUpgradeabilityProxy, ERC1820Implementer {
    /**
     * @notice Constructor
     * @param _securityToken Address of the security token
     */
    constructor (address _securityToken) public
    ModuleStorage(_securityToken)
    {
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
            address[] memory controllerList = IERC1400(address(securityToken)).controllers();
            for (uint i=0; i<controllerList.length; i++) {
                if(controllerList[i] == msg.sender){
                    return true; //TODO test that this works whether it is a controller on ST.
                }
            }
            return false;
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
