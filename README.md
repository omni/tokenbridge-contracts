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

##### Gas usage report
```
·---------------------------------------------------------------------------------------------|-----------------------------------·
|                                             Gas                                             ·  Block limit: 17592186044415 gas  │
··························································|···································|····································
|  Methods                                                ·            1 gwei/gas             ·          204.45 usd/eth           │
·····························|····························|···········|···········|···········|··················|·················
|  Contract                  ·  Method                    ·  Min      ·  Max      ·  Avg      ·  # calls         ·  usd (avg)     │
·····························|····························|···········|···········|···········|··················|·················
|  BlockReward               ·  addMintedTotallyByBridge  ·        -  ·        -  ·    44279  ·               6  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  BridgeValidators          ·  addValidator              ·        -  ·        -  ·    53178  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  BridgeValidators          ·  initialize                ·   187738  ·   280847  ·   253949  ·              15  ·          0.05  │
·····························|····························|···········|···········|···········|··················|·················
|  BridgeValidators          ·  removeValidator           ·        -  ·        -  ·    24400  ·               3  ·          0.00  │
·····························|····························|···········|···········|···········|··················|·················
|  BridgeValidators          ·  setRequiredSignatures     ·        -  ·        -  ·    29790  ·              11  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  burn                      ·        -  ·        -  ·    18249  ·               1  ·          0.00  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  claimTokens               ·        -  ·        -  ·    44183  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  mint                      ·    53369  ·    68497  ·    66130  ·              27  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  setBridgeContract         ·    29432  ·    44432  ·    39432  ·              12  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  transfer                  ·    37691  ·    86589  ·    55005  ·              12  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  transferAndCall           ·    58370  ·   166206  ·    92399  ·               8  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  ERC677BridgeToken         ·  transferOwnership         ·    30860  ·    30924  ·    30919  ·              12  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  EternalStorageProxy       ·  upgradeTo                 ·    35871  ·    65871  ·    55864  ·               9  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  EternalStorageProxy       ·  upgradeToAndCall          ·   199612  ·   262801  ·   237404  ·               7  ·          0.05  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToErc     ·  claimTokens               ·        -  ·        -  ·    52157  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToErc     ·  executeSignatures         ·    73779  ·   115769  ·    93027  ·               6  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToErc     ·  initialize                ·        -  ·        -  ·   150614  ·               3  ·          0.03  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToNative  ·  claimTokens               ·        -  ·        -  ·    52157  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToNative  ·  executeSignatures         ·    73779  ·   115769  ·    92985  ·               6  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeErcToNative  ·  initialize                ·        -  ·        -  ·   150614  ·               3  ·          0.03  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  claimTokens               ·        -  ·        -  ·    47586  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  claimTokensFromErc677     ·        -  ·        -  ·    50828  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  executeSignatures         ·    89201  ·   146127  ·   120917  ·               6  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  initialize                ·   213493  ·   213557  ·   213549  ·               8  ·          0.04  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  setMaxPerTx               ·        -  ·        -  ·    32249  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc  ·  setMinPerTx               ·        -  ·        -  ·    32774  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc        ·  executeAffirmation        ·    79336  ·   134607  ·   108215  ·               8  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc        ·  initialize                ·   212299  ·   213195  ·   213003  ·               5  ·          0.04  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc        ·  setMaxPerTx               ·        -  ·        -  ·    32084  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc        ·  setMinPerTx               ·        -  ·        -  ·    32673  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc        ·  submitSignature           ·   159386  ·   275159  ·   220171  ·              10  ·          0.05  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  executeAffirmation        ·    64380  ·   140744  ·    97562  ·               6  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  initialize                ·   196910  ·   213930  ·   210795  ·               6  ·          0.04  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  setBlockRewardContract    ·        -  ·        -  ·    35251  ·               1  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  setDailyLimit             ·        -  ·        -  ·    32433  ·               3  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  setMaxPerTx               ·        -  ·        -  ·    32106  ·               3  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  setMinPerTx               ·        -  ·        -  ·    32716  ·               2  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative     ·  submitSignature           ·   159428  ·   275201  ·   220206  ·              10  ·          0.05  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  executeAffirmation        ·    64314  ·   107669  ·    83596  ·              10  ·          0.02  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  initialize                ·   190051  ·   190947  ·   190768  ·               5  ·          0.04  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  setDailyLimit             ·        -  ·        -  ·    32367  ·               3  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  setMaxPerTx               ·        -  ·        -  ·    32040  ·               3  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  setMinPerTx               ·        -  ·        -  ·    32651  ·               2  ·          0.01  │
·····························|····························|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc     ·  submitSignature           ·   159362  ·   275135  ·   220134  ·              10  ·          0.05  │
·····························|····························|···········|···········|···········|··················|·················
|  Deployments                                            ·                                   ·  % of limit      ·                │
··························································|···········|···········|···········|··················|·················
|  BlockReward                                            ·        -  ·        -  ·   329177  ·             0 %  ·          0.07  │
··························································|···········|···········|···········|··················|·················
|  BridgeValidators                                       ·        -  ·        -  ·  1144207  ·             0 %  ·          0.23  │
··························································|···········|···········|···········|··················|·················
|  ERC677BridgeToken                                      ·  1498202  ·  1499226  ·  1498825  ·             0 %  ·          0.31  │
··························································|···········|···········|···········|··················|·················
|  EternalStorageProxy                                    ·        -  ·        -  ·   378510  ·             0 %  ·          0.08  │
··························································|···········|···········|···········|··················|·················
|  ForeignBridgeErcToErc                                  ·        -  ·        -  ·  2449436  ·             0 %  ·          0.50  │
··························································|···········|···········|···········|··················|·················
|  ForeignBridgeErcToNative                               ·        -  ·        -  ·  2449564  ·             0 %  ·          0.50  │
··························································|···········|···········|···········|··················|·················
|  ForeignBridgeNativeToErc                               ·        -  ·        -  ·  2768705  ·             0 %  ·          0.57  │
··························································|···········|···········|···········|··················|·················
|  HomeBridgeErcToErc                                     ·        -  ·        -  ·  3492618  ·             0 %  ·          0.71  │
··························································|···········|···········|···········|··················|·················
|  HomeBridgeErcToNative                                  ·        -  ·        -  ·  3757420  ·             0 %  ·          0.77  │
··························································|···········|···········|···········|··················|·················
|  HomeBridgeNativeToErc                                  ·        -  ·        -  ·  3327263  ·             0 %  ·          0.68  │
·---------------------------------------------------------|-----------|-----------|-----------|------------------|----------------·
```

### Flatten
```bash
npm run flatten
```

## Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) document for contribution, testing and pull request protocol.

## License

[![License: GPL v3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.



