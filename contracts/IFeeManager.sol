pragma solidity 0.4.24;


interface IFeeManager {
    function calculateFee(uint256 _value, bool _recover) external view returns(uint256 fee);
    function distributeFeeFromSignatures(uint256 _fee) external;
    function distributeFeeFromAffirmation(uint256 _fee) external;
    function setFee(uint256 _fee) external;
    function getFee() external view returns(uint256 fee);
}
