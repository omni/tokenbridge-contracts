[![Build Status](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts.svg?branch=master)](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts)

# POA Bridge Smart Contracts
These contracts provide the core functionality for the POA bridge. They implement the logic to relay assests between two EVM-based blockchain networks. The contracts collect bridge validator's signatures to approve and facilitate relay operations. 

The POA bridge smart contracts are intended to work with [the bridge process implemented on NodeJS](https://github.com/poanetwork/bridge-nodejs).
Please refer to the bridge process documentation to configure and deploy the bridge.

## Summary

### Operations

Currently, the contracts support two types of relay operations:
* Tokenize the native coin in one blockchain network (Home) into an ERC20 token in another network (Foreign).
* Swap a token presented by an existing ERC20 contract in a Foreign network into an ERC20 token in the Home network, where one pair of bridge contracts corresponds to one pair of ERC20 tokens.
* to mint new native coins in Home blockchain network from a token presented by an existing ERC20 contract in a Foreign network.


### Components

The POA bridge contracts consist of several components:
* The **Home Bridge** smart contract. This is currently deployed in POA.Network.
* The **Foreign Bridge** smart contract. This is deployed in the Ethereum Mainnet.
* Depending on the type of relay operations the following components are also used:
  * in `NATIVE-TO-ERC` mode: the ERC20 token (in fact, the ERC677 extension is used) is deployed on the Foreign network;
  * in `ERC-TO-ERC` mode: the ERC20 token (in fact, the ERC677 extension is used) is deployed on the Home network;
  * in `ERC-TO-NATIVE` mode: The home network nodes must support consensus engine that allows using a smart contract for block reward calculation;
* The **Validators** smart contract is deployed in both the POA.Network and the Ethereum Mainnet.

### Bridge Roles and Responsibilities

Responsibilities and roles of the bridge:
- **Administrator** role (representation of a multisig contract):
  - add/remove validators
  - set daily limits on both bridges
  - set maximum per transaction limit on both bridges
  - set minimum per transaction limit on both bridges
  - upgrade contracts in case of vulnerability
  - set minimum required signatures from validators in order to relay a user's transaction
- **Validator** role:
  - provide 100% uptime to relay transactions
  - listen for `UserRequestForSignature` events on Home Bridge and sign an approval to relay assets on Foreign network
  - listen for `CollectedSignatures` events on Home Bridge. As soon as enough signatures are collected, transfer all collected signatures to the Foreign Bridge contract.
  - listen for `UserRequestForAffirmation` or `Transfer` (depending on the bridge mode) events on the Foreign Bridge and send approval to Home Bridge to relay assets from Foreign Network to Home
- **User** role:
  - sends assets to Bridge contracts:
    - in `NATIVE-TO-ERC` mode: send native coins to the Home Bridge to receive ERC20 tokens from the Foreign Bridge, send ERC20 tokens to the Foreign Bridge to unlock native coins from the Home Bridge;
    - in `ERC-TO-ERC` mode: transfer ERC20 tokens to the Foreign Bridge to mint ERC20 tokens on the Home Network, transfer ERC20 tokens to the Home Bridge to unlock ERC20 tokens on Foreign networks; 
    - in `ERC-TO-NATIVE` mode: send ERC20 tokens to the Foreign Bridge to receive native coins from the Home Bridge, send native coins to the Home Bridge to unlock ERC20 tokens from the Foreign Bridge.

## Usage

### Install Dependencies
```bash
npm install
```
### Deploy
Please the [README.md](deploy/README.md) in the `deploy` folder for instructions and .env file configuration

### Test
```bash
npm test
```

### Flatten
```bash
npm run flatten
```

### Gas Consumption

#### `NATIVE-TO-ERC` Bridge Mode

##### Deployment
###### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeNativeToErc|deployment|3327263|3327263|3327263
EternalStorageProxy|upgradeTo|35871|30924|30913
HomeBridgeNativeToErc|initialize|190051|190947|190755
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |5739327|5823438|5796326

###### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
ERC677BridgeToken|deployment|1498202|1499226|1498829
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeNativeToErc|deployment|2768705|2768705|2768705
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeNativeToErc|initialize|213493|213557|213549
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |6762705|6862072|6829736

##### Usage

###### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeNativeToErc|submitSignature|159362|275135|220127
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|89201|146127|120917
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|64314|107669|83596

###### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|46982|46982|46982
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58370|166206|92399  


## Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) document for contribution, testing and pull request protocol.

## License

[![License: GPL v3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.



