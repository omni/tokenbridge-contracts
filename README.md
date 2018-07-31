[![Build Status](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts.svg?branch=master)](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts)

# POA bridge smart contracts
These contracts are the core of POA bridge functionality. They implement the logic to relay assests between
two EVM-based blockchain networks by collecting bridge validators signatures to approve relay operations.

Currently the contracts supports two types of relay operations:
* to tokenize native coins circulating in one blockchain network (Home) into an ERC20 token in another network (Foreign);
* to swap a token presented by an ERC20 contract in Home network to an existing ERC20 token in Foreign network.

POA bridge consist of several main parts:
* Home Bridge is a smart contract that should be deployed in POA.network;
* Foreign Bridge is a smart contract that should be deployed in Ethereum Mainnet;
* Depending on type of relay operations the following components are used as well:
  * in `NATIVE-TO-ERC` mode: ERC20 token (in fact, ERC677 extension is used) should be deployed on Foreign network;
  * in `ERC-TO-ERC` mode: ERC20 token (in fact, ERC677 extension is used) should be deployed on Home network;

Responsibilities and roles of the bridge:
- Administrator Role(representation of a multisig contract):
  - add/remove validators
  - set daily limits on both bridges
  - set maximum per transaction limit on both bridges
  - set minimum per transaction limit on both bridges
  - upgrade contracts in case of vulnerability
  - set minimum required signatures from validators in order to relay a user's transaction
- Validator Role :
  - provide 100% uptime to relay transactions
  - listen for Deposit events on Home bridge to mint erc20 token on Foreign bridge
  - listen for Withdraw events on Foreign bridge to unlock funds on Home Bridge
- User role:
  - sends POA coins to Home bridge in order to receive ERC20 token on Foreign Bridge
  - sends ERC20 POA20 token on Foreign Bridge in order to receive POA coins on Home Bridge


# Dependencies
```bash
npm install
```

# To Deploy
Check README.md in `deploy` folder

# Manual Deployment steps(OUTDATED)

## Home Deployment(Sokol)

1. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218) (Example address: '0x01')
that will be used as Home Bridge Validators Proxy contract
2. Deploy [BridgeValidators contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/BridgeValidators_flat.sol#L197) (Example address: '0x02')
3. Call `upgradeTo` of EternalStorageProxy that is used as  Home Bridge Validators with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#2 BridgeValidators deployed contract (`0x02`)
4. Call `initialize` method at Home Bridge Validators Proxy(`0x01`) with 2 parameters:
- REQUIRED_NUMBER_OF_VALIDATORS. Example: `1`
- Array of validators. Example `["0x0039F22efB07A647557C7C5d17854CFD6D489eF3", "0xf052d236b8076879d86c9e4c116a068a0d420c55"]`
5. Deploy [Home Bridge](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/HomeBridge_flat.sol#L289). Example address: `0x03`
6. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Home Bridge Proxy contract.  Example address: `0x04`
7. Call `upgradeTo` of EternalStorageProxy that is used as  Home Bridge Proxy(step#6) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#5 HomeBridge deployed contract. (`0x03`)
8. Call `initialize` method at Home Bridge Proxy address with 4 parameters:
- address of Home Bridge **Validators** address Proxy ( step# 1) `0x01`
- Daily Limit in wei: Example `1000000000000000000` == 1 ether
- Maximum Per Transaction Limit in wei: Example `100000000000000000` == 0.1 ether. Should be less than Daily Limit
- Minimum Per Transaction Limit in wei: Example `10000000000000000` == 0.01 ether. Should be less than Daily Limit and less than MaxPerTx
=====
## Foreign Deployment on Kovan
=====

9. Deploy [POA20 contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/POA20_flat.sol#L448) Example(`0x05`)
10. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Foreign Bridge Validators Proxy contract. Example `0x06`
11. Deploy [BridgeValidators contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/BridgeValidators_flat.sol#L197) Example `0x07`
12. Call `upgradeTo` of EternalStorageProxy(`0x06`) that is used as  Foreign Bridge Validators Proxy(step#10) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#11 Foreign BridgeValidators deployed contract. (`0x07`)
13. Call `initialize` method at Foreign Bridge Validators Proxy(`0x06`) with 2 parameters:
- REQUIRED_NUMBER_OF_VALIDATORS. Example: `1`
- Array of validators. Example `["0x0039F22efB07A647557C7C5d17854CFD6D489eF3", "0xf052d236b8076879d86c9e4c116a068a0d420c55"]`
14. Deploy [EternalStorageProxy contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/EternalStorageProxy_flat.sol#L218)
that will be used as Foreign Bridge Proxy contract. Example `0x08`
15. Deploy [Foreign Bridge contract](https://github.com/poanetwork/poa-parity-bridge-contracts/blob/upgradable/flats/ForeignBridge_flat.sol#L345) Example `0x09`
16. Call `upgradeTo` of EternalStorageProxy(`0x08`) that is used as  Foreign Bridge Proxy(step#14) with 2 parameters:
- 0 - version of implementation contract
- address of implementation which is the address of step#15 Foreign Bridge deployed contract. (`0x09`)
17. Call `initialize` method at Foreign Bridge Proxy(`0x08`) address with 5 parameters:
- address of Foreign Bridge **Validators** address Proxy ( step# 10) `0x06`
- address of POA20 token contract. Step#9 `0x05`
- Daily Limit in wei: Example `1000000000000000000` == 1 ether
- Maximum Per Transaction Limit in wei: Example `100000000000000000` == 0.1 ether. Should be less than Daily Limit
- Minimum Per Transaction Limit in wei: Example `10000000000000000` == 0.01 ether. Should be less than Daily Limit and less than MaxPerTx
18. Call `transferOwnership` of POA20 contract(0x05) with 1 parameter:
- address of Foreign Bridge Proxy (`0x08`) from step#14


# To Flatten
```bash
npm run flatten
```
