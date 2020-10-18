pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title BaseAddressList
 * @dev Implementation of the address list storage for upgradeable contracts.
 */
contract BaseAddressList is EternalStorage {
    using SafeMath for uint256;

    uint256 internal constant MAX_ADDRESSES = 50;
    bytes32 internal constant ADDRESS_COUNT = 0x12b7e58de774d1d5365a2137affa45ce692d3098fab50c1da8537b22e610e5f5; // keccak256(abi.encodePacked("addressCount"))
    string internal constant LIST_NAME = "addressList";

    /**
     * @dev Internal function which returns saved addresses in a form of an array.
     * @return array for addresses.
     */
    function _addressList() internal view returns (address[]) {
        uint256 count = _addressCount();
        address[] memory list = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            list[i] = _addressByIndex(i);
        }

        return list;
    }

    /**
     * @dev Internal function which returns the size of the stored addresses array.
     * @return number of saved addreses.
     */
    function _addressCount() internal view returns (uint256) {
        return uintStorage[ADDRESS_COUNT];
    }

    /**
     * @dev Internal function for initializing addresses list from scratch.
     * Each address present in the list should be unique.
     * @param _addresses array with the initial addresses to save.
     */
    function _initAddresses(address[] _addresses) internal {
        for (uint256 i = 0; i < _addresses.length; i++) {
            require(_addresses[i] != address(0));
            require(_addressIndex(_addresses[i], i) == i);
            _setAddressByIndex(i, _addresses[i]);
        }
        _setAddressCount(_addresses.length);
    }

    /**
     * @dev Internal function for adding new address into the list.
     * @param _addr new address to be added into the list.
     */
    function _addAddress(address _addr) internal {
        uint256 index = _addressCount();
        require(_addr != address(0));
        require(_addressIndex(_addr, index) == index);

        _setAddressByIndex(index, _addr);
        _setAddressCount(index.add(1));
    }

    /**
     * @dev Internal function for removing address from the list.
     * @param _addr old address to be removed from the list.
     * @return number of left addresses in the list.
     */
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

    /**
     * @dev Internal function for checking index of some particular address in the list.
     * @param _addr address to search.
     * @param _count amount of addresses to iterate starting from the beginning of the list.
     * @return index of the address in the list, or _count if address was not found.
     */
    function _addressIndex(address _addr, uint256 _count) internal view returns (uint256) {
        for (uint256 i = 0; i < _count; i++) {
            if (_addressByIndex(i) == _addr) {
                return i;
            }
        }
        return _count;
    }

    /**
     * @dev Internal function for updating size of the list.
     * @param _count new value for the list size.s
     */
    function _setAddressCount(uint256 _count) internal {
        require(_count <= MAX_ADDRESSES);
        uintStorage[ADDRESS_COUNT] = _count;
    }

    /**
     * @dev Internal function for retrieving address stored at some particular index.
     * @param _index in the list, should be less than _addressCount().
     * @return address stored at specified index.
     */
    function _addressByIndex(uint256 _index) internal view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(LIST_NAME, _index))];
    }

    /**
     * @dev Internal function for updating address stored at some particular index.
     * @param _index in the list, should be less than _addressCount().
     * @param _addr new value for the stored address.
     */
    function _setAddressByIndex(uint256 _index, address _addr) internal {
        addressStorage[keccak256(abi.encodePacked(LIST_NAME, _index))] = _addr;
    }
}
