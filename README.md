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

There are two ways to deploy contracts: one option is to install and use NodeJS directly on the system,
another way is for those systems where it is more preferable to use NodeJS in the docker environment. 

### Deployment with NodeJS

#### Install Dependencies
```bash
npm install
```
#### Deploy
Please the [README.md](deploy/README.md) in the `deploy` folder for instructions and .env file configuration

#### Test
```bash
npm test
```

#### Flatten
The flatten contracts can be used to verify code of contracts in a block explorer like BlockScout or Etherscan.
The following command will prepare flattened version of the contracts:

```bash
npm run flatten
```
The flattened contracts can be found in the `flats` directory.

### Deployment in the Docker environment
[Docker](https://www.docker.com/community-edition) and [Docker Compose](https://docs.docker.com/compose/install/) could be used to deploy contracts without NodeJS installation on the system. 
f you are on Linux, it's also recommended that you [create a docker group and add your user to it](https://docs.docker.com/install/linux/linux-postinstall/), so that you can use the CLI without `sudo`.

#### Prepare the docker container
```bash
docker-compose up --build
```
_Note: The container must be rebuild every time when you change the code of contracts or the deployment scripts._

#### Deploy the contracts
1. Create the `.env` file in the `deploy` directory as it is described in deployment [README.md](deploy/README.md).
2. Run deployment process by
   ```bash
   docker-compose run bridge-contracts deploy.sh
   ```
   or (in case of Linux system)
   ```bash
   ./deploy.sh
   ```

#### Copy flatten sources (if it is needed)
1. Discover the container name by
   ```bash
   docker-compose images bridge-contracts
   ```
2. Use contaner name in the following comand to copy flatten sources to the current workin directory. Sources will be located in the `flats` directory.
   ```bash
   docker cp name-of-your-container:/contracts/flats ./
   ```

#### Shutdown the container
If the container is not needed any more it could be shutdown by the command

```bash
docker-compose down
```

### Gas Consumption
See the [GAS_CONSUMPTION](GAS_CONSUMPTION.md) document to get a description of gas consumption.

### Testing environment
In order to test the bridge scripts working in `ERC20-to-ERC20` mode in testnet like Sokol or Kovan, it is required to deploy an ERC20 token to
the Foreign network. This can be done by running the following command:
```bash
cd deploy
node testenv-deploy.js token
```
or in case of usage of Docker environment
```bash
./deploy.sh token
```

## Contributing

See the [CONTRIBUTING](CONTRIBUTING.md) document for contribution, testing and pull request protocol.

## License

[![License: GPL v3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.



