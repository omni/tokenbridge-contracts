pragma solidity 0.4.24;

import "../../upgradeability/EternalStorage.sol";
import "../InitializableBridge.sol";
import "../Ownable.sol";

/**
 * @title ForeignUtopiaBridge
 * @dev Foreign side implementation for Utopia bridge.
 * It is designed to be used as an implementation contract of EternalStorageProxy contract.
 */
contract ForeignUtopiaBridge is EternalStorage, InitializableBridge, Ownable {
    bytes32 internal constant VALIDATORS_MERKLE_ROOT = 0x863437a66f76b8fbda63b4aa8b9f3c18ab374a52d0ad4ac1d1cbc703aca6f142; // keccak256(abi.encodePacked("validatorsMerkleRoot"))
    bytes32 internal constant VALIDATORS_UPDATE_TIME = 0x2c3eecc20bf5925ae1fb6d8092cfdea1078fe3eb5bdab302355b97fdbef6fc0e; // keccak256(abi.encodePacked("validatorsUpdateTime"))

    bytes32 internal constant COMMITS_DAILY_LIMIT = 0x69388e2c2e6daee4eabfbc84444561133977b9215f19fc6a6719f60f330029fb; // keccak256(abi.encodePacked("commitsDailyLimiy"))
    bytes32 internal constant COMMITS_PER_DAY = 0xb7915c3fee8df0689c3fb999c82b426049cb546c49c1d551a34fab840df2369d; // keccak256(abi.encodePacked("commitsPerDay"))
    bytes32 internal constant COMMIT_MINIMAL_BOND = 0xfd90e54293bb1c2fc18e58c663fb50cd45f75cefded747f2e42384659f918ab5; // keccak256(abi.encodePacked("commitsPerDay"))
    bytes32 internal constant COMMIT_TIME_AND_BOND = 0x1d53b8d5f4752dc94386abf27e4fa63e3fb5ad0d0ae123bfc3c17ae41fac2ce2; // keccak256(abi.encodePacked("commitTimeAndBond"))
    bytes32 internal constant COMMIT_EXECUTOR = 0xe7d5e82ac97b50d6c4713c35396235f792273b197cb0d972f5dee27b953eb7a9; // keccak256(abi.encodePacked("commitExecutor"))
    bytes32 internal constant COMMIT_CALLDATA = 0x80cacfae8438100f1380eb301b38a51925c7ae3de79c938425d38d480fc35380; // keccak256(abi.encodePacked("commitCalldata"))
    bytes32 internal constant COMMIT_REJECTS_THRESHOLD = 0xa139fa29257b1b7273d947a76a2793fca7a3343c8585d9c26ab221068ce86e1f; // keccak256(abi.encodePacked("commitRejectsThreshold"))
    bytes32 internal constant COMMIT_REJECTS_COUNT = 0x105696f3de999fd44b78ef1d643acae4a4de8b6d7e7d41a46458f55fca776147; // keccak256(abi.encodePacked("commitRejectsCount"))
    bytes32 internal constant COMMIT_REJECTS_PARTY = 0xd2c15b9a60babfb4ff9a06c15fa0bdbbc40d08b4ad6618ceaa7eee2cc0c969db; // keccak256(abi.encodePacked("commitRejectsParty"))

    uint256 internal constant MAX_HEIGHT = 5;
    uint256 internal constant MAX_VALIDATORS = 2**MAX_HEIGHT;

    event UpdateValidatorsRoot(bytes32 indexed root);
    event Commit(bytes32 indexed messageId);
    event Execute(bytes32 indexed messageId, bool status);
    event Reject(bytes32 indexed messageId, address party);
    event Slash(bytes32 indexed messageId);

    function initialize(
        bytes32 _validatorsRoot,
        uint256 _commitMinimalBond,
        uint256 _commitRejectsThreshold,
        uint256 _commitsDailyLimit,
        address _owner
    ) external onlyRelevantSender returns (bool) {
        require(!isInitialized());
        require(_owner != address(0));

        _setValidatorsRoot(_validatorsRoot);
        _setCommitMinimalBond(_commitMinimalBond);
        _setCommitRejectsThreshold(_commitRejectsThreshold);
        _setCommitsDailyLimit(_commitsDailyLimit);

        setOwner(_owner);
        setInitialize();

        return true;
    }

    function submitValidatorsRoot(bytes32 _newValidatorsRoot, bytes _signatures) external {
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _newValidatorsRoot));
        bytes32[MAX_VALIDATORS] memory validators; // merkle tree
        uint256 signaturesCount = 0;
        uint256 validatorsCount = 0;
        uint256 offset = 0;
        while (offset < _signatures.length) {
            uint8 v = uint8(_signatures[offset]);
            if (v > 0) {
                bytes32 r;
                bytes32 s;
                assembly {
                    r := calldataload(add(offset, 101))
                    s := calldataload(add(offset, 133))
                }
                validators[validatorsCount++] = bytes32(ecrecover(messageHash, v, r, s));
                signaturesCount++;
                offset += 65;
            } else {
                bytes32 validator;
                assembly {
                    validator := and(0xffffffffffffffffffffffffffffffffffffffff, calldataload(add(offset, 89)))
                }
                validators[validatorsCount++] = validator;
                offset += 21;
            }
        }
        require(2 * signaturesCount > validatorsCount);
        for (uint256 i = 1; i < validatorsCount; i *= 2) {
            for (uint256 j = 0; j + i < validatorsCount; j += i + i) {
                if (uint256(validators[j]) < uint256(validators[j + i])) {
                    validators[j] = keccak256(abi.encodePacked(validators[j], validators[j + i]));
                } else {
                    validators[j] = keccak256(abi.encodePacked(validators[j + i], validators[j]));
                }
            }
        }
        require(validators[0] == getValidatorsRoot());
        _setValidatorsRoot(_newValidatorsRoot);
    }

    function commit(bytes32 _messageId, address _executor, bytes _data) external payable {
        require(msg.value >= getCommitMinimalBond());
        require(getTodayCommits() < getCommitsDailyLimit());
        _incrementTodayCommits();

        _setCommitData(_messageId, now, msg.value, _executor, _data);

        emit Commit(_messageId);
    }

    function execute(bytes32 _messageId, uint256 _gas) external {
        require(now >= getExecuteTime(_messageId));
        require(getCommitRejectsCount(_messageId) < getCommitRejectsThreshold());
        uint256 bond = getCommitBond(_messageId);
        require(bond > 0);
        address executor = getCommitExecutor(_messageId);
        bytes memory data = getCommitCalldata(_messageId);

        _deleteCommitData(_messageId);

        msg.sender.transfer(bond);

        require(gasleft() >= _gas + 10000);
        bool status = executor.call.gas(_gas)(data);

        emit Execute(_messageId, status);
    }

    function rejectCommit(bytes32[MAX_HEIGHT] _merklePath, bytes32 _messageId) external {
        require(now < getExecuteTime(_messageId));
        bytes32 hash = bytes32(msg.sender);
        for (uint256 i = 0; i < MAX_HEIGHT; i++) {
            if (hash < _merklePath[i]) {
                hash = keccak256(abi.encodePacked(hash, _merklePath[i]));
            } else {
                hash = keccak256(abi.encodePacked(_merklePath[i], hash));
            }
        }
        require(hash == getValidatorsRoot());
        uint256 rejectsCount = _addReject(_messageId);
        require(rejectsCount < getCommitRejectsThreshold()); // failed validator txs?

        emit Reject(_messageId, msg.sender);
    }

    function slash(bytes32 _messageId, address[] _parties) external {
        uint256 bond = getCommitBond(_messageId);
        require(bond > 0);

        // 1 pie for each party + 1 pie for first party + 1 pie for msg.sender
        uint256 pie = bond / (_parties.length + 2);

        for (uint256 i = 0; i < _parties.length; i++) {
            require(boolStorage[keccak256(abi.encodePacked(COMMIT_REJECTS_PARTY, _messageId, _parties[i]))]);
            if (i > 0) {
                _parties[i].transfer(pie);
            } else {
                _parties[i].transfer(pie * 2);
            }
        }
        msg.sender.transfer(bond - pie * (_parties.length + 1));

        require(getCommitRejectsCount(_messageId) >= getCommitRejectsThreshold());

        _deleteCommitData(_messageId);

        emit Slash(_messageId);
    }

    function getTodayCommits() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(COMMITS_PER_DAY, now / 1 days))];
    }

    function getExecuteTime(bytes32 _messageId) public view returns (uint256) {
        uint256 commitTime = getCommitTime(_messageId);
        uint256 rejects = getCommitRejectsCount(_messageId);
        uint256 validatorsUpdateTime = getValidatorsUpdateTime();
        uint256 delay = 24 hours + rejects * rejects * 12 hours;
        if (commitTime > validatorsUpdateTime) {
            delay += commitTime - validatorsUpdateTime;
        }
        return commitTime + (delay > 10 days ? 10 days : delay);
    }

    function getValidatorsRoot() public view returns (bytes32) {
        return bytes32(uintStorage[VALIDATORS_MERKLE_ROOT]);
    }

    function getCommitsDailyLimit() public view returns (uint256) {
        return uintStorage[COMMITS_DAILY_LIMIT];
    }

    function getValidatorsUpdateTime() public view returns (uint256) {
        return uintStorage[VALIDATORS_UPDATE_TIME];
    }

    function getCommitRejectsCount(bytes32 _messageId) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(COMMIT_REJECTS_COUNT, _messageId))];
    }

    function getCommitTime(bytes32 _messageId) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(COMMIT_TIME_AND_BOND, _messageId))] >> 128;
    }

    function getCommitBond(bytes32 _messageId) public view returns (uint256) {
        return
            uintStorage[keccak256(abi.encodePacked(COMMIT_TIME_AND_BOND, _messageId))] &
                0xffffffffffffffffffffffffffffffff;
    }

    function getCommitExecutor(bytes32 _messageId) public view returns (address) {
        return addressStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR, _messageId))];
    }

    function getCommitCalldata(bytes32 _messageId) public view returns (bytes memory) {
        return bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))];
    }

    function getCommitRejectsThreshold() public view returns (uint256) {
        return uintStorage[COMMIT_REJECTS_THRESHOLD];
    }

    function getCommitMinimalBond() public view returns (uint256) {
        return uintStorage[COMMIT_MINIMAL_BOND];
    }

    function setCommitsDailyLimit(uint256 _commitsDailyLimit) external onlyOwner {
        _setCommitsDailyLimit(_commitsDailyLimit);
    }

    function setCommitRejectsThreshold(uint256 _threshold) external onlyOwner {
        _setCommitRejectsThreshold(_threshold);
    }

    function setCommitMinimalBond(uint256 _bond) external onlyOwner {
        _setCommitMinimalBond(_bond);
    }

    function _incrementTodayCommits() internal {
        uintStorage[keccak256(abi.encodePacked(COMMITS_PER_DAY, now / 1 days))]++;
    }

    function _setCommitData(bytes32 _messageId, uint256 _time, uint256 _bond, address _executor, bytes _data) internal {
        require(_time < 2**128 && _bond < 2**128);
        uintStorage[keccak256(abi.encodePacked(COMMIT_TIME_AND_BOND, _messageId))] = (_time << 128) | _bond;
        addressStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR, _messageId))] = _executor;
        bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))] = _data;
    }

    function _deleteCommitData(bytes32 _messageId) internal {
        delete uintStorage[keccak256(abi.encodePacked(COMMIT_TIME_AND_BOND, _messageId))];
        delete addressStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR, _messageId))];
        delete bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))];
    }

    function _setValidatorsRoot(bytes32 _validatorsRoot) internal {
        uintStorage[VALIDATORS_MERKLE_ROOT] = uint256(_validatorsRoot);
        uintStorage[VALIDATORS_UPDATE_TIME] = now;

        emit UpdateValidatorsRoot(_validatorsRoot);
    }

    function _setCommitsDailyLimit(uint256 _commitsDailyLimit) internal {
        uintStorage[COMMITS_DAILY_LIMIT] = _commitsDailyLimit;
    }

    function _setCommitRejectsThreshold(uint256 _threshold) internal {
        require(_threshold > 0 && _threshold <= MAX_VALIDATORS);
        uintStorage[COMMIT_REJECTS_THRESHOLD] = _threshold;
    }

    function _setCommitMinimalBond(uint256 _bond) internal {
        require(_bond > 0);
        uintStorage[COMMIT_MINIMAL_BOND] = _bond;
    }

    function _addReject(bytes32 _messageId) internal returns (uint256) {
        uint256 count = uintStorage[keccak256(abi.encodePacked(COMMIT_REJECTS_COUNT, _messageId))]++;
        bytes32 hash = keccak256(abi.encodePacked(COMMIT_REJECTS_PARTY, _messageId, msg.sender));
        require(!boolStorage[hash]);
        boolStorage[hash] = true;
        return count;
    }
}
