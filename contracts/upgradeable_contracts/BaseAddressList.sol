pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @dev Implementation of the address list storage for upgradeable contracts.
 */
contract BaseAddressList is EternalStorage {
    using SafeMath for uint256;

    uint256 internal constant MAX_ADDRESSES = 50;
    bytes32 internal constant ADDRESS_COUNT = 0x12b7e58de774d1d5365a2137affa45ce692d3098fab50c1da8537b22e610e5f5; // keccak256(abi.encodePacked("addressCount"))
    string internal constant LIST_NAME = "addressList";

    function _addressList() internal view returns (address[]) {
        uint256 count = _addressCount();
        address[] memory list = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            list[i] = _addressByIndex(i);
        }

        return list;
    }

    function _addressCount() internal view returns (uint256) {
        return uintStorage[ADDRESS_COUNT];
    }

    function _initAddresses(address[] _addresses) internal {
        for (uint256 i = 0; i < _addresses.length; i++) {
            require(_addresses[i] != address(0));
            _setAddressByIndex(i, _addresses[i]);
        }
        _setAddressCount(_addresses.length);
    }

    function _addAddress(address _addr) internal {
        uint256 index = _addressCount();
        require(_addr != address(0));
        require(_addressIndex(_addr, index) == index);

        _setAddressByIndex(index, _addr);
        _setAddressCount(index.add(1));
    }

    function _removeAddress(address _addr) internal returns (uint256) {
        uint256 count = _addressCount();
        uint256 index = _addressIndex(_addr, count);

        require(index < count);

        _setAddressByIndex(index, _addressByIndex(count - 1));
        count = count.sub(1);
        _setAddressByIndex(count, address(0));
        _setAddressCount(count);

        return count;
    }

    function _addressIndex(address _addr, uint256 _count) internal view returns (uint256) {
        for (uint256 i = 0; i < _count; i++) {
            if (_addressByIndex(i) == _addr) {
                return i;
            }
        }
        return _count;
    }

    function _setAddressCount(uint256 _count) internal {
        require(_count <= MAX_ADDRESSES);
        uintStorage[ADDRESS_COUNT] = _count;
    }

    function _addressByIndex(uint256 _index) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(LIST_NAME, _index))];
    }

    function _setAddressByIndex(uint256 _index, address _addr) internal {
        addressStorage[keccak256(abi.encodePacked(LIST_NAME, _index))] = _addr;
    }
}
