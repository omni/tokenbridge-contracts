# How to Deploy POA Bridge Contracts

In order to deploy bridge contracts you must run `npm install` to install all dependencies. For more information, see the [project README](../README.md).

1. Compile the source contracts.
```
cd ..
npm run compile
```

2. Create a `.env` file.
```
cd deploy
cp .env.example .env
```

3. If necessary, deploy and configure a multi-sig wallet contract to manage the bridge contracts after deployment. We have not audited any wallets for security, but have used https://github.com/gnosis/MultiSigWallet/ with success.

4. Adjust the parameters in the `.env` file depending on the desired bridge mode. See below for comments related to each parameter.

5. Add funds to the deployment accounts in both theHome and Foreign networks. 

6. Run `node deploy.js`. 

## `NATIVE-TO-ERC` Bridge Mode Configuration Example.

This example of an `.env` file for the `native-to-erc` bridge mode includes comments describing each parameter.

```bash


# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=NATIVE_TO_ERC

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# The "gas" parameter set in every deployment/configuration transaction.
DEPLOYMENT_GAS_LIMIT=4000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Home network (in Wei).
HOME_DEPLOYMENT_GAS_PRICE=10000000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Foreign network (in Wei).
FOREIGN_DEPLOYMENT_GAS_PRICE=10000000000
# The timeout limit to wait for receipt of the deployment/configuration
# transaction.
GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

# The name of the ERC677 token to be deployed on the Foreign network.
BRIDGEABLE_TOKEN_NAME="Your New Bridged Token"
# The symbol name of the ERC677 token to be deployed on the Foreign network.
BRIDGEABLE_TOKEN_SYMBOL="TEST"
# The number of supportable decimal digits after the "point" in the ERC677 token
# to be deployed on the Foreign network.
BRIDGEABLE_TOKEN_DECIMALS="18"

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://poa.infura.io
# The address of an administrator on the Home network who can change bridge
# parameters and a validator's contract. For extra security we recommended using
# a multi-sig wallet contract address here.
HOME_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_BRIDGE=0x
# The daily transaction limit in Wei. As soon as this limit is exceeded, any
# transaction which requests to relay assets will fail.
HOME_DAILY_LIMIT=30000000000000000000000000
# The maximum limit for one transaction in Wei. If a single transaction tries to
# relay funds exceeding this limit it will fail.
HOME_MAX_AMOUNT_PER_TX=1500000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail. This is required to prevent dryout
# validator accounts.
HOME_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
HOME_REQUIRED_BLOCK_CONFIRMATIONS=1
# The default gas price (in Wei) used to send Home Network signature
# transactions for deposit or withdrawal confirmations. This price is used if
# the Gas price oracle is unreachable.
HOME_GAS_PRICE=1000000000

# The RPC channel to a Foreign node able to handle deployment/configuration
# transactions.
FOREIGN_RPC_URL=https://mainnet.infura.io
# The address of an administrator on the Foreign network who can change bridge
# parameters and the validator's contract. For extra security we recommended
# using a multi-sig wallet contract address here.
FOREIGN_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_BRIDGE=0x
# The daily limit in Wei. As soon as this limit is exceeded, any transaction
# requesting to relay assets will fail.
FOREIGN_DAILY_LIMIT=15000000000000000000000000
# The maximum limit per one transaction in Wei. If a transaction tries to relay
# funds exceeding this limit it will fail.
FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail. This is required to prevent dryout
# validator accounts.
FOREIGN_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS=8
# The default gas price (in Wei) used to send Foreign network transactions
# finalizing asset deposits. This price is used if the Gas price oracle is
# unreachable.
FOREIGN_GAS_PRICE=10000000000

# The minimum number of validators required to send their signatures confirming
# the relay of assets. The same number of validators is expected on both sides
# of the bridge.
REQUIRED_NUMBER_OF_VALIDATORS=1
# The set of validators' addresses. It is assumed that signatures from these
# addresses are collected on the Home side. The same addresses will be used on
# the Foreign network to confirm that the finalized agreement was transferred
# correctly to the Foreign network.
VALIDATORS="0x 0x 0x"
```


## `ERC-TO-ERC` Bridge Mode Configuration Example. 

This example of an `.env` file for the `erc-to-erc` bridge mode includes comments describing each parameter.

```bash
# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=ERC_TO_ERC

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# The "gas" parameter set in every deployment/configuration transaction.
DEPLOYMENT_GAS_LIMIT=4000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Home network (in Wei).
HOME_DEPLOYMENT_GAS_PRICE=10000000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Foreign network (in Wei).
FOREIGN_DEPLOYMENT_GAS_PRICE=10000000000
# The timeout limit to wait for receipt of the deployment/configuration
# transaction.
GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

# The name of the ERC677 token to be deployed on the Home network.
BRIDGEABLE_TOKEN_NAME="Your New Bridged Token"
# The symbol name of the ERC677 token to be deployed on the Home network.
BRIDGEABLE_TOKEN_SYMBOL="TEST"
# The number of supportable decimal digits after the "point" in the ERC677 token
# to be deployed on the Home network.
BRIDGEABLE_TOKEN_DECIMALS="18"

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://poa.infura.io
# The address of an administrator on the Home network who can change bridge
# parameters and a validator's contract. For extra security we recommended using
# a multi-sig wallet contract address here.
HOME_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_BRIDGE=0x
# The daily transaction limit in Wei. As soon as this limit is exceeded, any
# transaction which requests to relay assets will fail.
HOME_DAILY_LIMIT=30000000000000000000000000
# The maximum limit for one transaction in Wei. If a single transaction tries to
# relay funds exceeding this limit it will fail.
HOME_MAX_AMOUNT_PER_TX=1500000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail. This is required to prevent dryout
# validator accounts.
HOME_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
HOME_REQUIRED_BLOCK_CONFIRMATIONS=1
# The default gas price (in Wei) used to send Home Network signature
# transactions for deposit or withdrawl confirmations. This price is used if
# the Gas price oracle is unreachable.
HOME_GAS_PRICE=1000000000

# The RPC channel to a Foreign node able to handle deployment/configuration
# transactions.
FOREIGN_RPC_URL=https://mainnet.infura.io
# The address of an administrator on the Foreign network who can change bridge
# parameters and the validator's contract. For extra security we recommended
# using a multi-sig wallet contract address here.
FOREIGN_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_BRIDGE=0x
# These three parameters are not used in this mode, but the deployment script
# requires it to be set to some value.
FOREIGN_DAILY_LIMIT=15000000000000000000000000
FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
FOREIGN_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS=8
# The default gas price (in Wei) used to send Foreign network transactions
# finalizing asset deposits. This price is used if the Gas price oracle is
# unreachable.
FOREIGN_GAS_PRICE=10000000000
# The address of the existing ERC20 compatible token in the Foreign network to
# be exchanged to the ERC20/ERC677 token deployed on Home.
ERC20_TOKEN_ADDRESS=0x

# The minimum number of validators required to send their signatures confirming
# the relay of assets. The same number of validators is expected on both sides
# of the bridge.
REQUIRED_NUMBER_OF_VALIDATORS=1
# The set of validators' addresses. It is assumed that signatures from these
# addresses are collected on the Home side. The same addresses will be used on
# the Foreign network to confirm that the finalized agreement was transferred
# correctly to the Foreign network.
VALIDATORS="0x 0x 0x"
```

## `ERC-TO-NATIVE` Bridge Mode Configuration Example. 

This example of an `.env` file for the `erc-to-native` bridge mode includes comments describing each parameter.

```bash
# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=ERC_TO_NATIVE

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# The "gas" parameter set in every deployment/configuration transaction.
DEPLOYMENT_GAS_LIMIT=4000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# home network.
HOME_DEPLOYMENT_GAS_PRICE=10000000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# foreign network.
FOREIGN_DEPLOYMENT_GAS_PRICE=10000000000
# The timeout limit to wait for receipt of the deployment/configuration
# transaction.
GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://poa.infura.io
# The address of an administrator on the Home network who can change bridge
# parameters and a validator's contract. For extra security we recommended using
# a multi-sig wallet contract address here.
HOME_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Home.
HOME_UPGRADEABLE_ADMIN_BRIDGE=0x
# The daily transaction limit in Wei. As soon as this limit is exceeded, any
# transaction which requests to relay assets will fail.
HOME_DAILY_LIMIT=30000000000000000000000000
# The maximum limit for one transaction in Wei. If a single transaction tries to
# relay funds exceeding this limit it will fail.
HOME_MAX_AMOUNT_PER_TX=1500000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail. This is required to prevent dryout
# validator accounts.
HOME_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
HOME_REQUIRED_BLOCK_CONFIRMATIONS=1
# The default gas price used to send Home Network signature transactions for
# deposit or withdrawl confirmations. This price is used if the Gas price oracle
# is unreachable.
HOME_GAS_PRICE=1

# The address of the existing smart contract for block reward calculation on Home network.
BLOCK_REWARD_ADDRESS=0x

# The RPC channel to a Foreign node able to handle deployment/configuration
# transactions.
FOREIGN_RPC_URL=https://mainnet.infura.io
# The address of an administrator on the Foreign network who can change bridge
# parameters and the validator's contract. For extra security we recommended
# using a multi-sig wallet contract address here.
FOREIGN_OWNER_MULTISIG=0x
# The address from which a validator's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS=0x
# The address from which the bridge's contract can be upgraded on Foreign.
FOREIGN_UPGRADEABLE_ADMIN_BRIDGE=0x
# These three parameters are not used in this mode, but the deployment script
# requires it to be set to some value.
FOREIGN_DAILY_LIMIT=15000000000000000000000000
FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
FOREIGN_MIN_AMOUNT_PER_TX=500000000000000000
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS=8
# The default gas price used to send Foreign network transactions finalizing
# asset deposits. This price is used if the Gas price oracle is unreachable.
FOREIGN_GAS_PRICE=10

# The address of the existing ERC20 compatible token in the Foreign network to
# be exchanged to the native coins on Home.
ERC20_TOKEN_ADDRESS=0x

# The minimum number of validators required to send their signatures confirming
# the relay of assets. The same number of validators is expected on both sides
# of the bridge.
REQUIRED_NUMBER_OF_VALIDATORS=1
# The set of validators' addresses. It is assumed that signatures from these
# addresses are collected on the Home side. The same addresses will be used on
# the Foreign network to confirm that the finalized agreement was transferred
# correctly to the Foreign network.
VALIDATORS="0x 0x 0x"
```
