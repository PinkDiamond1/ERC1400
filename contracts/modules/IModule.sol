pragma solidity 0.5.10;

/**
 * @title Interface for every controller module
 */
interface IModule {
    /**
     * @notice This function returns the signature of configure function
     */
    function getInitFunction() external pure returns(bytes4 initFunction);
}
