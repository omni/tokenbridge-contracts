pragma solidity ^0.4.19;


interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint8);
    function currentOwner() public view returns(address);
}
