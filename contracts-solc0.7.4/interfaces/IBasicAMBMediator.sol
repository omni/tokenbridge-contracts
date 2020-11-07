pragma solidity 0.7.4;

import "./IAMB.sol";

interface IBasicAMBMediator {
    function bridgeContract() external view returns (IAMB);
    function mediatorContractOnOtherSide() external view returns (address);
    function requestGasLimit() external view returns (uint256);
    function owner() external view returns (address);
}
