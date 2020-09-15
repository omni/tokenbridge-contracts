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
    bytes32 internal constant COMMIT_SENDER_AND_BOND = 0xd7c19899e363650488919c769302d7e09b298b961733495fc2a486a72678813f; // keccak256(abi.encodePacked("commitSenderAndBond"))
    bytes32 internal constant COMMIT_EXECUTOR_AND_TIME = 0xc77838aeeacb01d0d1a17abaf548660d25018f36a911300f60d440fde7e2f217; // keccak256(abi.encodePacked("commitExecutorAndTime"))
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
    event Reject(bytes32 indexed messageId, address sender);
    event Slash(bytes32 indexed messageId);

    /**
     * @dev Initializes this contract.
     * @param _validatorsRoot initial merkle root of the validator set.
     * @param _commitMinimalBond minimum required bond for each commit, in WEI.
     * @param _commitRejectsThreshold specifies the amount of rejects, after which the commit will be slashed.
     * @param _commitsDailyLimit daily limit on the number of commits.
     * @param _owner future owner of this contract.
     */
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

    /**
     * @dev Updates validator root. Should be called after a new POSDAO validar set is established.
     * At least 50% + 1 signatures should be provided.
     * @param _newValidatorsRoot validators merkle root for the new set.
     * @param _signatures blob containing some of the validators signatures and the remaining addresses.
     */
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

    /**
     * @dev Commits a new message for further execution.
     * It is important that commited _executor and _data parameters are equal to the ones used to obtain the _messageId on the home side.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @param _executor address of the receiver contract.
     * @param _data calldata of the message that will be passed to the receiver contract.
     */
    function commit(bytes32 _messageId, address _executor, bytes _data) external payable {
        require(msg.value >= getCommitMinimalBond());
        require(getTodayCommits() < getCommitsDailyLimit());
        _incrementTodayCommits();

        _setCommitData(_messageId, _executor, _data);

        emit Commit(_messageId);
    }

    /**
     * @dev Executes a previously committed message.
     * Message can be executed only after a specific time period after commit.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @param _gas amount of gas to pass to the executor contract. Can be chosen arbitrarly.
     * @return execution status of the called message.
     */
    function execute(bytes32 _messageId, uint256 _gas) external returns (bool) {
        require(now >= getExecuteTime(_messageId));
        require(getCommitRejectsCount(_messageId) < getCommitRejectsThreshold());
        (address committer, uint256 bond) = getCommitSenderAndBond(_messageId);
        require(bond > 0);
        address executor = getCommitExecutor(_messageId);
        bytes memory data = getCommitCalldata(_messageId);

        _deleteCommitData(_messageId);

        committer.transfer(bond);

        require(gasleft() >= _gas + 10000);
        bool status = executor.call.gas(_gas)(data);

        emit Execute(_messageId, status);

        return status;
    }

    /**
     * @dev Submits reject for the committed, but not yet executed message.
     * Message can be rejected only by the current validators.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @param _merkleProof merkle tree proof that confirmes that transaction sender is indeed a validator.
     */
    function reject(bytes32 _messageId, bytes32[] _merkleProof) external {
        require(now < getExecuteTime(_messageId));
        bytes32 hash = bytes32(msg.sender);
        for (uint256 i = 0; i < _merkleProof.length; i++) {
            if (hash < _merkleProof[i]) {
                hash = keccak256(abi.encodePacked(hash, _merkleProof[i]));
            } else {
                hash = keccak256(abi.encodePacked(_merkleProof[i], hash));
            }
        }
        require(hash == getValidatorsRoot());
        uint256 rejectsCount = _addReject(_messageId);
        require(rejectsCount < getCommitRejectsThreshold()); // failed validator txs?

        emit Reject(_messageId, msg.sender);
    }

    /**
     * @dev Distributes the locked bond for some commit, after sufficient amount of rejects was accumulated.
     * Can be called by anyone.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @param _parties list of parties that participated in the reject process. In any order.
     */
    function slash(bytes32 _messageId, address[] _parties) external {
        require(_parties.length == getCommitRejectsCount(_messageId));
        (, uint256 bond) = getCommitSenderAndBond(_messageId);
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

    /**
     * @dev Counts amount of commits made today.
     * @return number of commits.
     */
    function getTodayCommits() public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(COMMITS_PER_DAY, now / 1 days))];
    }

    /**
     * @dev Checks when a committed message can be executed.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return approximate execution time.
     */
    function getExecuteTime(bytes32 _messageId) public view returns (uint256) {
        uint256 commitTime = getCommitTime(_messageId);
        uint256 rejects = getCommitRejectsCount(_messageId);
        uint256 validatorsUpdateTime = getValidatorsUpdateTime();
        uint256 delay = 24 hours + rejects * rejects * 12 hours;
        if (commitTime > validatorsUpdateTime + 1 weeks) {
            delay += commitTime - validatorsUpdateTime - 1 weeks;
        }
        return commitTime + (delay > 10 days ? 10 days : delay);
    }

    /**
     * @dev Retrieves current validators merkle root.
     * @return merkle tree root for the validators set.
     */
    function getValidatorsRoot() public view returns (bytes32) {
        return bytes32(uintStorage[VALIDATORS_MERKLE_ROOT]);
    }

    /**
     * @dev Retrieves the maximum amount of commits that can be made daily.
     * @return current daily limit on the amount of commits.
     */
    function getCommitsDailyLimit() public view returns (uint256) {
        return uintStorage[COMMITS_DAILY_LIMIT];
    }

    /**
     * @dev Retrieves the approximate time when validator set should be updated.
     * @return approximate validators set update time.
     */
    function getValidatorsUpdateTime() public view returns (uint256) {
        return uintStorage[VALIDATORS_UPDATE_TIME];
    }

    /**
     * @dev Retrieves the amount of received rejects for the particular commit.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return number of collected rejects from the validators.
     */
    function getCommitRejectsCount(bytes32 _messageId) public view returns (uint256) {
        return uintStorage[keccak256(abi.encodePacked(COMMIT_REJECTS_COUNT, _messageId))];
    }

    /**
     * @dev Retrieves the time when the specified message was commited.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return message commit time.
     */
    function getCommitTime(bytes32 _messageId) public view returns (uint256) {
        return
            uintStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR_AND_TIME, _messageId))] & 0xffffffffffffffffffffffff;
    }

    /**
     * @dev Retrieves the commit sender and sent bond amount.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return pair of commit sender address and locked amount of coins.
     */
    function getCommitSenderAndBond(bytes32 _messageId) public view returns (address, uint256) {
        uint256 blob = uintStorage[keccak256(abi.encodePacked(COMMIT_SENDER_AND_BOND, _messageId))];
        return (address(blob >> 96), blob & 0xffffffffffffffffffffffff);
    }

    /**
     * @dev Retrieves executor contract for the specific commit.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return executor contract address.
     */
    function getCommitExecutor(bytes32 _messageId) public view returns (address) {
        return address(uintStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR_AND_TIME, _messageId))] >> 96);
    }

    /**
     * @dev Retrieves a calldata associated with the specific commit.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return calldata bytes blob.
     */
    function getCommitCalldata(bytes32 _messageId) public view returns (bytes memory) {
        return bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))];
    }

    /**
     * @dev Retrieves required amount of rejects before slash.
     * @return amount of required rejects.
     */
    function getCommitRejectsThreshold() public view returns (uint256) {
        return uintStorage[COMMIT_REJECTS_THRESHOLD];
    }

    /**
     * @dev Retrieves the minimum required commit bond.
     * @return minumum amount of bond.
     */
    function getCommitMinimalBond() public view returns (uint256) {
        return uintStorage[COMMIT_MINIMAL_BOND];
    }

    /**
     * @dev Updates the daily limit for the commits.
     * Can be called only by the contract owner.
     * @param _commitsDailyLimit new daily limit.
     */
    function setCommitsDailyLimit(uint256 _commitsDailyLimit) external onlyOwner {
        _setCommitsDailyLimit(_commitsDailyLimit);
    }

    /**
     * @dev Updates the amount of required rejects.
     * Can be called only by the contract owner.
     * @param _threshold new threshold value.
     */
    function setCommitRejectsThreshold(uint256 _threshold) external onlyOwner {
        _setCommitRejectsThreshold(_threshold);
    }

    /**
     * @dev Updates the minimum amount of locked coins per commit.
     * Can be called only by the contract owner.
     * @param _bond new minimum bond value.
     */
    function setCommitMinimalBond(uint256 _bond) external onlyOwner {
        _setCommitMinimalBond(_bond);
    }

    /**
     * @dev Internal function for incrementing amount of today commits.
     */
    function _incrementTodayCommits() internal {
        uintStorage[keccak256(abi.encodePacked(COMMITS_PER_DAY, now / 1 days))]++;
    }

    /**
     * @dev Internal function for setting new commit data.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @param _executor executor of the commit message.
     * @param _data committed message payload.
     */
    function _setCommitData(bytes32 _messageId, address _executor, bytes _data) internal {
        require(msg.value < 2**96);
        uintStorage[keccak256(abi.encodePacked(COMMIT_SENDER_AND_BOND, _messageId))] =
            (uint256(msg.sender) << 96) |
            msg.value;
        uintStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR_AND_TIME, _messageId))] =
            (uint256(_executor) << 96) |
            now;
        bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))] = _data;
    }

    /**
     * @dev Internal function for clearing the storage after commit processing.
     * @param _messageId id of the message obtained on the home side of the bridge.
     */
    function _deleteCommitData(bytes32 _messageId) internal {
        delete uintStorage[keccak256(abi.encodePacked(COMMIT_SENDER_AND_BOND, _messageId))];
        delete uintStorage[keccak256(abi.encodePacked(COMMIT_EXECUTOR_AND_TIME, _messageId))];
        delete bytesStorage[keccak256(abi.encodePacked(COMMIT_CALLDATA, _messageId))];
    }

    /**
     * @dev Internal function for updating validator set merkle tree root.
     * @param _validatorsRoot value of the new validator set root.
     */
    function _setValidatorsRoot(bytes32 _validatorsRoot) internal {
        uintStorage[VALIDATORS_MERKLE_ROOT] = uint256(_validatorsRoot);
        uintStorage[VALIDATORS_UPDATE_TIME] = now;

        emit UpdateValidatorsRoot(_validatorsRoot);
    }

    /**
     * @dev Internal function for updating daily commits limit.
     * @param _commitsDailyLimit new value for the limit.
     */
    function _setCommitsDailyLimit(uint256 _commitsDailyLimit) internal {
        uintStorage[COMMITS_DAILY_LIMIT] = _commitsDailyLimit;
    }

    /**
     * @dev Internal function for updating required rejects threshold.
     * @param _threshold new value for the threshold.
     */
    function _setCommitRejectsThreshold(uint256 _threshold) internal {
        require(_threshold > 0 && _threshold <= MAX_VALIDATORS);
        uintStorage[COMMIT_REJECTS_THRESHOLD] = _threshold;
    }

    /**
     * @dev Internal function for updating minimum required bond value.
     * @param _bond new value for the required bond.
     */
    function _setCommitMinimalBond(uint256 _bond) internal {
        require(_bond > 0);
        uintStorage[COMMIT_MINIMAL_BOND] = _bond;
    }

    /**
     * @dev Internal function for recording a new reject for the particular commit.
     * @param _messageId id of the message obtained on the home side of the bridge.
     * @return total amount of received rejects for this particular commit.
     */
    function _addReject(bytes32 _messageId) internal returns (uint256) {
        uint256 count = uintStorage[keccak256(abi.encodePacked(COMMIT_REJECTS_COUNT, _messageId))]++;
        bytes32 hash = keccak256(abi.encodePacked(COMMIT_REJECTS_PARTY, _messageId, msg.sender));
        require(!boolStorage[hash]);
        boolStorage[hash] = true;
        return count;
    }
}
