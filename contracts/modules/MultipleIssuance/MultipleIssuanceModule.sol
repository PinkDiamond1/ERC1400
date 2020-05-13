pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../Module.sol";
import "../../IERC1400.sol";
import "./IMultipleIssuanceModule.sol";

contract MultipleIssuanceModule is Module, IMultipleIssuanceModule {
    using SafeMath for uint256;

    string constant internal ERC1400_MULTIPLE_ISSUANCE = "ERC1400MultipleIssuance";

    struct Exemption {
        bool hasBeenAdded;
        uint256 index;
        uint256 totalBalanceIssuedUnderExemption;
        mapping(bytes32 => ExemptionByPartition) exemptionMapByPartition;
    }

    struct ExemptionByPartition {
        uint256 totalPartitionedBalanceIssuedUnderExemption;
        mapping(address => uint256) totalPartitionBalanceByTokenHolder;
    }

    // Array of exemptions
    bytes32[] public exemptionList;
    mapping(bytes32 => Exemption) public transactionIndexesToSender;

    /**
     * @notice Constructor
     * @param factory Address of the factory or admin
     */
    constructor(address factory) public
    Module(factory)
    {
        ERC1820Implementer._setInterface(ERC1400_MULTIPLE_ISSUANCE);
    }

    /**
    * @notice This function returns the signature of configure function
    */
    function getInitFunction() public pure returns (bytes4) {
        return this.configure.selector;
    }

    /**
    * @notice Function used to initialize the contract variables
    */
    function configure(
        address _securityToken
    )
    external
    onlyFactory
    {
        securityToken = _securityToken;
    }

    function _changeExemptionBalances(bytes32 exemption, bytes32 partition, address tokenHolder, uint256 value) internal {
        // Check if the exemption exists, if not add it
        if(!transactionIndexesToSender[exemption].hasBeenAdded){
            transactionIndexesToSender[exemption].index = exemptionList.push(exemption).sub(1);
            transactionIndexesToSender[exemption].hasBeenAdded = true;
        }
        // Update total under exemption
        transactionIndexesToSender[exemption].totalBalanceIssuedUnderExemption += value;

        // Update total under exemption for partition
        transactionIndexesToSender[exemption].exemptionMapByPartition[partition]
            .totalPartitionedBalanceIssuedUnderExemption += value;

        // Update total under exemption for partition by tokenHolder
        transactionIndexesToSender[exemption].exemptionMapByPartition[partition]
        .totalPartitionBalanceByTokenHolder[tokenHolder] += value;
    }

    // Get total tokens issued under an exemption
    function totalIssuedUnderExemption(bytes32 exemption) external view returns (uint256 totalTokens){
        return transactionIndexesToSender[exemption].totalBalanceIssuedUnderExemption;
    }

    // Get total tokens issued under an exemption by partition
    function totalIssuedUnderExemptionByPartition(bytes32 exemption, bytes32 partition) external view returns (uint256 totalTokens){
        return transactionIndexesToSender[exemption].exemptionMapByPartition[partition]
        .totalPartitionedBalanceIssuedUnderExemption;
    }

    // Get total tokens issued under an exemption by partition and token holder
    function totalIssuedUnderExemptionByPartitionAndTokenHolder(bytes32 exemption, bytes32 partition, address tokenHolder) external view returns (uint256 totalTokens){
        return transactionIndexesToSender[exemption].exemptionMapByPartition[partition]
        .totalPartitionBalanceByTokenHolder[tokenHolder];
    }

    function issueByPartitionMultiple(bytes32[] calldata exemptions, bytes32[] calldata partitions,
        address[] calldata tokenHolders,
        uint256[] calldata values,
        bytes calldata data)
    external
    withControllerPermission
    {
        require(partitions.length == tokenHolders.length, "Check array lengths");
        require(partitions.length == values.length, "Check array lengths");
        for (uint i=0; i < partitions.length; i++) {
            require(_checkControllerPermissionByPartition(partitions[i], msg.sender, tokenHolders[i]));
            IERC1400(address(securityToken))
            .issueByPartition(partitions[i], tokenHolders[i], values[i], data);
            _changeExemptionBalances(exemptions[i], partitions[i], tokenHolders[i], values[i]);
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
