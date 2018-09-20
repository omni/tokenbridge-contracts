[![Build Status](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts.svg?branch=master)](https://travis-ci.org/poanetwork/poa-parity-bridge-contracts)

# POA bridge smart contracts
These contracts are the core of POA bridge functionality. They implement the logic to relay assests between
two EVM-based blockchain networks by collecting bridge validators signatures to approve relay operations.

Currently the contracts supports two types of relay operations:
* to tokenize native coins circulating in one blockchain network (Home) into an ERC20 token in another network (Foreign);
* to swap a token presented by an existing ERC20 contract in Foreign network to an ERC20 token in Home network, one pair of bridge contracts correspond to one pair of ERC20 tokens.

This version of contract is intended to be work with [the bridge process implemented on NodeJS](https://github.com/poanetwork/bridge-nodejs).
Please refer to the bridge process documentation to deploy it and configure.

POA bridge contracts consist of several main parts:
* Home Bridge is a smart contract that should be deployed in POA.Network;
* Foreign Bridge is a smart contract that should be deployed in Ethereum Mainnet;
* Depending on type of relay operations the following components are used as well:
  * in `NATIVE-TO-ERC` mode: ERC20 token (in fact, ERC677 extension is used) should be deployed on Foreign network;
  * in `ERC-TO-ERC` mode: ERC20 token (in fact, ERC677 extension is used) should be deployed on Home network;
* Validators is a smart contract that should be deployed in both POA.Network and Ethereum Mainnet.

Responsibilities and roles of the bridge:
- Administrator Role (representation of a multisig contract):
  - add/remove validators
  - set daily limits on both bridges
  - set maximum per transaction limit on both bridges
  - set minimum per transaction limit on both bridges
  - upgrade contracts in case of vulnerability
  - set minimum required signatures from validators in order to relay a user's transaction
- Validator Role :
  - provide 100% uptime to relay transactions
  - listen for `UserRequestForSignature` events on Home Bridge and sign an approval to relay assets on Foreign network;
  - listen for `CollectedSignatures` events on Home Bridge as soon enough signatures are collected and transfer all collected signatures to Foreign Bridge contact;
  - listen for `UserRequestForAffirmation` or `Transfer` (depending on the bridge mode) events on Foreign Bridge and send approval to Home Bridge to relay assets from Foreign Network to Home
- User role:
  - sends assets to Bridge contracts:
    - in `NATIVE-TO-ERC` mode: send native coins to Home Bridge to receive ERC20 tokens from Foreign Bridge, send ERC20 tokens to Foreign Bridge to unlock native coins from Home Bride;
    - in `ERC-TO-ERC` mode: transfer ERC20 tokens to Foreign Bridge to mint ERC20 tokens on Home Network, transfer ERC20 tokens to Home Bridge to unlock ERC20 tokens on Foreing networks. 

# Dependencies
```bash
npm install
```

# To Deploy
Check README.md in `deploy` folder

# To Flatten
```bash
npm run flatten
```
