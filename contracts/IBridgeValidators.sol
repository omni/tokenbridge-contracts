pragma solidity 0.4.24;


interface IBridgeValidators {
    function initialize(uint256 _requiredSignatures, address[] _initialValidators, address _owner) public returns(bool);
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint256);
    function owner() public view returns(address);
}
