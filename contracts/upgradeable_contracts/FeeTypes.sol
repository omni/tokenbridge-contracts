pragma solidity 0.4.24;

contract FeeTypes {
    bytes32 internal constant HOME_FEE = 0x89d93e5e92f7e37e490c25f0e50f7f4aad7cc94b308a566553280967be38bcf1; // keccak256(abi.encodePacked("home-fee"))
    bytes32 internal constant FOREIGN_FEE = 0xdeb7f3adca07d6d1f708c1774389db532a2b2f18fd05a62b957e4089f4696ed5; // keccak256(abi.encodePacked("foreign-fee"))

    /**
    * @dev Throws if given fee type is unknown.
    */
    modifier validFeeType(bytes32 _feeType) {
        require(_feeType == HOME_FEE || _feeType == FOREIGN_FEE);
        /* solcov ignore next */
        _;
    }
}
