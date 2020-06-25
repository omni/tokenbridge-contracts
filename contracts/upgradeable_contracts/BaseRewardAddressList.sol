pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../upgradeability/EternalStorage.sol";

/**
* @title BaseRewardAddressList
* @dev Implements the logic to store, add and remove reward account addresses. Works as a linked list.
*/
contract BaseRewardAddressList is EternalStorage {
    using SafeMath for uint256;

    address public constant F_ADDR = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;
    uint256 internal constant MAX_REWARD_ADDRESSES = 50;
    bytes32 internal constant REWARD_ADDRESS_COUNT = 0xabc77c82721ced73eef2645facebe8c30249e6ac372cce6eb9d1fed31bd6648f; // keccak256(abi.encodePacked("rewardAddressCount"))

    event RewardAddressAdded(address indexed addr);
    event RewardAddressRemoved(address indexed addr);

    function rewardAddressList() external view returns (address[]) {
        address[] memory list = new address[](rewardAddressCount());
        uint256 counter = 0;
        address nextAddr = getNextRewardAddress(F_ADDR);

        while (nextAddr != F_ADDR) {
            require(nextAddr != address(0));

            list[counter] = nextAddr;
            nextAddr = getNextRewardAddress(nextAddr);
            counter++;
        }

        return list;
    }

    function rewardAddressCount() public view returns (uint256) {
        return uintStorage[REWARD_ADDRESS_COUNT];
    }

    function isRewardAddress(address _addr) public view returns (bool) {
        return _addr != F_ADDR && getNextRewardAddress(_addr) != address(0);
    }

    function getNextRewardAddress(address _address) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked("rewardAddressList", _address))];
    }

    function _addRewardAddress(address _addr) internal {
        require(_addr != address(0) && _addr != F_ADDR);
        require(!isRewardAddress(_addr));

        address nextAddr = getNextRewardAddress(F_ADDR);

        require(nextAddr != address(0));

        _setNextRewardAddress(_addr, nextAddr);
        _setNextRewardAddress(F_ADDR, _addr);
        _setRewardAddressCount(rewardAddressCount().add(1));
    }

    function _removeRewardAddress(address _addr) internal {
        require(isRewardAddress(_addr));
        address nextAddr = getNextRewardAddress(_addr);
        address index = F_ADDR;
        address next = getNextRewardAddress(index);

        while (next != _addr) {
            require(next != address(0));
            index = next;
            next = getNextRewardAddress(index);
            require(next != F_ADDR);
        }

        _setNextRewardAddress(index, nextAddr);
        delete addressStorage[keccak256(abi.encodePacked("rewardAddressList", _addr))];
        _setRewardAddressCount(rewardAddressCount().sub(1));
    }

    function _setRewardAddressList(address[] _rewardAddresses) internal {
        require(_rewardAddresses.length > 0);

        _setNextRewardAddress(F_ADDR, _rewardAddresses[0]);

        for (uint256 i = 0; i < _rewardAddresses.length; i++) {
            require(_rewardAddresses[i] != address(0) && _rewardAddresses[i] != F_ADDR);
            require(!isRewardAddress(_rewardAddresses[i]));

            if (i == _rewardAddresses.length - 1) {
                _setNextRewardAddress(_rewardAddresses[i], F_ADDR);
            } else {
                _setNextRewardAddress(_rewardAddresses[i], _rewardAddresses[i + 1]);
            }

            emit RewardAddressAdded(_rewardAddresses[i]);
        }

        _setRewardAddressCount(_rewardAddresses.length);
    }

    function _setRewardAddressCount(uint256 _rewardAddressCount) internal {
        require(_rewardAddressCount <= MAX_REWARD_ADDRESSES);
        uintStorage[REWARD_ADDRESS_COUNT] = _rewardAddressCount;
    }

    function _setNextRewardAddress(address _prevAddr, address _addr) internal {
        addressStorage[keccak256(abi.encodePacked("rewardAddressList", _prevAddr))] = _addr;
    }
}
