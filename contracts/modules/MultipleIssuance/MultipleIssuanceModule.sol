pragma solidity 0.5.10;

import "../Module.sol";
import "../../IERC1400.sol";

contract MultipleIssuanceModule is Module {

    string constant internal ERC1400_MULTIPLE_ISSUANCE = "ERC1400MultipleIssuance";

    struct Exemption {
        uint256 index;
        uint256 totalBalanceIssuedUnderExemption;
        mapping(bytes32 => ExemptionByPartition) exemptionMapByPartition;
    }

    struct ExemptionByPartition {
        uint256 totalPartitionedBalanceIssuedUnderExemption;
        mapping(address => uint256) totalPartitionBalanceByTokenHolderIssuedUnderExemption;
    }

    // Array of exemptions
    bytes32[] internal _exemptions;
    mapping(bytes32 => Exemption) public transactionIndexesToSender;

    /**
     * @notice Constructor
     * @param _securityToken Address of the security token
     */
    constructor (address _securityToken) public
    Module(_securityToken)
    {
        ERC1820Implementer._setInterface(ERC1400_MULTIPLE_ISSUANCE);
    }

    /**
    * @notice This function returns the signature of configure function
    */
    function getInitFunction() public pure returns (bytes4) {
        return bytes4(0);
    }

    function issueByPartitionMultiple(bytes32[] calldata partitions,
        address[] calldata tokenHolders,
        uint256[] calldata values,
        bytes calldata data)
    external
    withControllerPermission
    {
        require(partitions.length == tokenHolders.length, "Check array lengths");
        require(partitions.length == values.length, "Check array lengths");
        for (uint i=0; i < partitions.length; i++) {
            IERC1400(address(securityToken))
            .issueByPartition(partitions[i], tokenHolders[i], values[i], data);
        }
    }

    function operatorTransferByPartitionMultiple(bytes32[] calldata partitions,
        address[] calldata from,
        address[] calldata to,
        uint256[] calldata values,
        bytes calldata data,
        bytes calldata operatorData)
    external
    withControllerPermission
    {
        require(partitions.length == to.length, "Check array lengths");
        require(partitions.length == from.length, "Check array lengths");
        require(partitions.length == values.length, "Check array lengths");
        for (uint i=0; i < partitions.length; i++) {
            IERC1400(address(securityToken))
            .operatorTransferByPartition(partitions[i], from[i], to[i], values[i], data, operatorData);
        }
    }

}
