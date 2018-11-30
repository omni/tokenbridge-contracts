pragma solidity 0.4.23;
import "../IBridgeValidators.sol";
import "../upgradeability/EternalStorage.sol";
import "./Ownable.sol";


contract Validatable is EternalStorage, Ownable {

    event AdminTransferred(address previousAdmin, address newAdmin);

    function validatorContract() public view returns(IBridgeValidators) {
        return IBridgeValidators(addressStorage[keccak256("validatorContract")]);
    }

    modifier onlyValidator() {
        require(validatorContract().isValidator(msg.sender));
        _;
    }

    modifier onlyValidatorOwner() {
        require(validatorContract().owner() == msg.sender);
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin());
        _;
    }

    function transferOwnershipFromValidatorOwner(address newOwner) public onlyValidatorOwner {
        require(newOwner != address(0));
        require(owner() == address(0));
        setOwner(newOwner);
    }

    function admin() public view returns (address) {
        return addressStorage[keccak256("admin")];
    }

    function transferAdmin(address _newAdmin) public onlyOwner {
        require(_newAdmin != address(0));
        setAdmin(_newAdmin);
    }

    function setAdmin(address _newAdmin) internal {
        emit AdminTransferred(admin(), _newAdmin);
        addressStorage[keccak256("admin")] = _newAdmin;
    }
}
