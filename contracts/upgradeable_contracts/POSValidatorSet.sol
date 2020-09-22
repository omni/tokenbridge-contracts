pragma solidity 0.4.24;

import "../upgradeability/EternalStorage.sol";
import "./InitializableBridge.sol";
import "./Ownable.sol";

/**
 * @title POSValidatorSet
 * @dev Implementation of validator set based on the merkle tree, supporting expiration times.
 * It is designed to be used as a part of an Optimistic AMB bridge contract.
 */
contract POSValidatorSet is EternalStorage, InitializableBridge, Ownable {
    bytes32 internal constant VALIDATORS_MERKLE_ROOT = 0x863437a66f76b8fbda63b4aa8b9f3c18ab374a52d0ad4ac1d1cbc703aca6f142; // keccak256(abi.encodePacked("validatorsMerkleRoot"))
    bytes32 internal constant VALIDATORS_EXPIRATION_TIME = 0x9bfabb96ed0d9bec33eea4a0ac3b0450469954d4af8a67b0d8a1fd6e41adca19; // keccak256(abi.encodePacked("validatorsExpirationTime"))
    bytes32 internal constant VALIDATORS_REQUIRED_SIGNATURES = 0xd62b222a52a5f37668bb29da5ae74297fc843b334f4f86901c0812adb43ccc9e; // keccak256(abi.encodePacked("validatorsRequiredSignatures"))

    uint256 internal constant MAX_HEIGHT = 5;
    uint256 internal constant MAX_VALIDATORS = 2**MAX_HEIGHT;

    event NewValidatorSet(bytes32 indexed root, uint256 requiredSignatures, uint256 expirationTime);

    /**
     * @dev Internal function for initialization of this optimistic bridge module.
     * @param _validatorsRoot new value of the new validator set root.
     * @param _requiredSignatures new minimum number of required signatures/rejects.
     * @param _expirationTime new timestamp when a given validators merkle root will expire.
     * @param _owner owner of this contract.
     */
    function initialize(bytes32 _validatorsRoot, uint256 _requiredSignatures, uint256 _expirationTime, address _owner)
        external
        onlyRelevantSender
        returns (bool)
    {
        require(!isInitialized());
        require(_owner != address(0));

        _updateValidatorSet(_validatorsRoot, _requiredSignatures, _expirationTime);
        setOwner(_owner);

        setInitialize();

        return true;
    }

    /**
     * @dev Updates validator root. Should be called after a new POSDAO validar set is established.
     * At least 50% + 1 signatures should be provided.
     * @param _validatorsRoot new value of the new validator set root.
     * @param _requiredSignatures new minimum number of required signatures/rejects.
     * @param _expirationTime new timestamp when a given validators merkle root will expire.
     * @param _signatures blob containing some of the validators signatures and the remaining addresses.
     */
    function updateValidatorSet(
        bytes32 _validatorsRoot,
        uint256 _requiredSignatures,
        uint256 _expirationTime,
        bytes _signatures
    ) external returns (bool) {
        bytes32 currentValidatorsRoot = validatorsRoot();
        if (_validatorsRoot == currentValidatorsRoot) {
            return false;
        }
        bytes32 messageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n96", _validatorsRoot, _requiredSignatures, _expirationTime)
        );
        (bytes32[MAX_VALIDATORS] memory validators, uint256 validatorsCount) = _restoreValidatorsFromSignatures(
            messageHash,
            _signatures
        );
        require(_merkleRoot(validators, validatorsCount) == currentValidatorsRoot);
        _updateValidatorSet(_validatorsRoot, _requiredSignatures, _expirationTime);
        return true;
    }

    /**
     * @dev Force update of the validator set merkle root. Can be called only be the owner of this contract.
     * @param _validatorsRoot new value of the new validator set root.
     * @param _requiredSignatures new minimum number of required signatures/rejects.
     * @param _expirationTime new timestamp when a given validators merkle root will expire.
     */
    function forceUpdateValidatorSet(bytes32 _validatorsRoot, uint256 _requiredSignatures, uint256 _expirationTime)
        external
        onlyOwner
    {
        require(_expirationTime > now);
        _updateValidatorSet(_validatorsRoot, _requiredSignatures, _expirationTime);
    }

    /**
     * @dev Checks if the given address is a POS validator, by checking the merkle proof.
     * @param _validator address of the validator to check.
     * @param _merkleProof merkle proof for the given address.
     * @return true, if a given address is indeed a validator.
     */
    function isPOSValidator(address _validator, bytes32[] _merkleProof) external view returns (bool) {
        bytes32 hash = bytes32(_validator);
        for (uint256 i = 0; i < _merkleProof.length; i++) {
            if (hash < _merkleProof[i]) {
                hash = keccak256(abi.encodePacked(hash, _merkleProof[i]));
            } else {
                hash = keccak256(abi.encodePacked(_merkleProof[i], hash));
            }
        }
        return hash == validatorsRoot();
    }

    /**
     * @dev Retrieves current validators merkle root.
     * @return merkle tree root for the validators set.
     */
    function validatorsRoot() public view returns (bytes32) {
        return bytes32(uintStorage[VALIDATORS_MERKLE_ROOT]);
    }

    /**
     * @dev Retrieves the time when the validator set will expire and will need to be updated.
     * @return validator set expiration time.
     */
    function expirationTime() external view returns (uint256) {
        return uintStorage[VALIDATORS_EXPIRATION_TIME];
    }

    /**
     * @dev Retrieves the minimum number of signatures/rejects required to perform an action on behald of the validators.
     * @return number of signatures/rejects.
     */
    function requiredSignatures() public view returns (uint256) {
        return uintStorage[VALIDATORS_REQUIRED_SIGNATURES];
    }

    /**
     * @dev Internal function for updating validator set merkle tree root.
     * @param _validatorsRoot new value of the new validator set root.
     * @param _requiredSignatures new minimum number of required signatures/rejects.
     * @param _expirationTime new timestamp when a given validators merkle root will expire.
     */
    function _updateValidatorSet(bytes32 _validatorsRoot, uint256 _requiredSignatures, uint256 _expirationTime)
        internal
    {
        require(_requiredSignatures > 0);

        uintStorage[VALIDATORS_MERKLE_ROOT] = uint256(_validatorsRoot);
        uintStorage[VALIDATORS_EXPIRATION_TIME] = _expirationTime;
        uintStorage[VALIDATORS_REQUIRED_SIGNATURES] = _requiredSignatures;

        emit NewValidatorSet(_validatorsRoot, _requiredSignatures, _expirationTime);
    }

    /**
     * @dev Restores signatures and simple address from the signatures blob.
     * @param _messageHash hash of the message that was used for signature generation.
     * @param _signatures signatures and addresses blob.
     * @return pair of validators array and validators count.
     */
    function _restoreValidatorsFromSignatures(bytes32 _messageHash, bytes _signatures)
        internal
        view
        returns (bytes32[MAX_VALIDATORS], uint256)
    {
        bytes32[MAX_VALIDATORS] memory validators;
        uint256 validatorsCount = 0;
        uint256 offset = 0;
        uint256 signaturesCount = 0;
        while (offset < _signatures.length) {
            uint8 v = uint8(_signatures[offset]);
            if (v > 0) {
                bytes32 r;
                bytes32 s;
                assembly {
                    r := mload(add(_signatures, add(offset, 33)))
                    s := mload(add(_signatures, add(offset, 65)))
                }
                validators[validatorsCount++] = bytes32(ecrecover(_messageHash, v, r, s));
                signaturesCount++;
                offset += 65;
            } else {
                bytes32 validator;
                assembly {
                    validator := and(0xffffffffffffffffffffffffffffffffffffffff, mload(add(_signatures, add(offset, 21))))
                }
                validators[validatorsCount++] = validator;
                offset += 21;
            }
        }
        require(signaturesCount >= requiredSignatures());
        return (validators, validatorsCount);
    }

    /**
     * @dev Computes merkle root of the given validators array.
     * @param _validators array of address of validators, should be sorted in increasing order.
     * @param _validatorsCount amount of validators in the array.
     * @return merkle root of the built tree.
     */
    function _merkleRoot(bytes32[MAX_VALIDATORS] _validators, uint256 _validatorsCount)
        internal
        pure
        returns (bytes32)
    {
        for (uint256 i = 1; i < _validatorsCount; i *= 2) {
            for (uint256 j = 0; j + i < _validatorsCount; j += i + i) {
                if (uint256(_validators[j]) < uint256(_validators[j + i])) {
                    _validators[j] = keccak256(abi.encodePacked(_validators[j], _validators[j + i]));
                } else {
                    _validators[j] = keccak256(abi.encodePacked(_validators[j + i], _validators[j]));
                }
            }
        }
        return _validators[0];
    }
}
