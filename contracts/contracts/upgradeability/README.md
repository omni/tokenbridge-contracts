# Upgradeability contracts

This directory contains contracts needed for the idea of upgradeable contracts. The source code for this contracts was originally taken from [openzeppelin-labs](https://github.com/OpenZeppelin/openzeppelin-labs/tree/8212ac638ce0a6517fd1c4c7f445fe9665925020/upgradeability_using_eternal_storage) repository.

Since the original code is not recommended for production use, it is not directly imported into this project.

During the development process and performing security audits, the following minor changes were introduced:
- Required solidity compiler version was fixed at `0.4.24`, since this version is used in the source code of other contracts. Deprecated syntax for constructors and emitting events was also updated to a new one.
- Access modifier `onlyProxyOwner` was renamed to `onlyUpgradeabilityOwner`. Function calls to `proxyOwner()` in `OwnedUpgradeabilityProxy.sol` were directly replaced by calls to `upgradeabilityOwner()`, in order to avoid possible ambiguity. See [#195](https://github.com/poanetwork/tokenbridge-contracts/issues/195).
- Functions modifier `public` was replaced by `external` where possible.
- Version field type was changed from `string` to `uint256`, as it reduces possible complexity and allows to easily introduce a version mutability requirement (`require(version > _version);` in `UpgradeabilityProxy.sol`).
- Additional assembly operation was introduced in `Proxy.sol`, opcodes in line `mstore(0x40, add(ptr, returndatasize))` guarantee the correct value of free memory pointer for execution of next instructions.
- Additional check in `UpgradeabilityProxy.sol` was added, `require(AddressUtils.isContract(implementation))` verifies that new implementation is not a regular address, but a contract. See [#256](https://github.com/poanetwork/tokenbridge-contracts/pull/256).
