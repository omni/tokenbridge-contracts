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

5. Add funds to the deployment accounts in both the Home and Foreign networks.

6. Run `npm run deploy`.

## `ERC-TO-NATIVE` Bridge Mode Configuration Example.

This example of an `.env` file for the `erc-to-native` bridge mode includes comments describing each parameter.

```bash
# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=ERC_TO_NATIVE

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# Extra gas added to the estimated gas of a particular deployment/configuration transaction
# E.g. if estimated gas returns 100000 and the parameter is 0.2,
# the transaction gas limit will be (100000 + 100000 * 0.2) = 120000
DEPLOYMENT_GAS_LIMIT_EXTRA=0.2
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Home network (in Wei).
HOME_DEPLOYMENT_GAS_PRICE=10000000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Foreign network (in Wei).
FOREIGN_DEPLOYMENT_GAS_PRICE=10000000000
# The timeout limit to wait for receipt of the deployment/configuration
# transaction.
GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://core.poa.network
# Address on Home network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
HOME_BRIDGE_OWNER=0x
# Address on Home network with permissions to change parameters of bridge validator contract.
HOME_VALIDATORS_OWNER=0x
# Address on Home network with permissions to upgrade the bridge contract and the
# bridge validator contract.
HOME_UPGRADEABLE_ADMIN=0x
# The daily transaction limit in Wei. As soon as this limit is exceeded, any
# transaction which requests to relay assets will fail.
HOME_DAILY_LIMIT=30000000000000000000000000
# The maximum limit for one transaction in Wei. If a single transaction tries to
# relay funds exceeding this limit it will fail. HOME_MAX_AMOUNT_PER_TX must be
# less than HOME_DAILY_LIMIT.
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

# The address of the existing smart contract for block reward calculation on Home network.
BLOCK_REWARD_ADDRESS=0x

# The RPC channel to a Foreign node able to handle deployment/configuration
# transactions.
FOREIGN_RPC_URL=https://mainnet.infura.io
# Address on Foreign network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
FOREIGN_BRIDGE_OWNER=0x
# Address on the Foreign network with permissions to change parameters of
# the bridge validator contract.
FOREIGN_VALIDATORS_OWNER=0x
# Address on the Foreign network with permissions to upgrade the bridge contract
# and the bridge validator contract.
FOREIGN_UPGRADEABLE_ADMIN=0x
# The daily transaction limit in Wei. Used on the Home side to check
# the bridge validator’s actions.
FOREIGN_DAILY_LIMIT=15000000000000000000000000
# The maximum limit for one transaction in Wei. FOREIGN_MAX_AMOUNT_PER_TX must be
# less than FOREIGN_DAILY_LIMIT. Used on the Home side to check the bridge validator’s actions.
FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
# Not used in this mode, comment out or delete this variable.
# FOREIGN_MIN_AMOUNT_PER_TX=
# The finalization threshold. The number of blocks issued after the block with
# the corresponding deposit transaction to guarantee the transaction will not be
# rolled back.
FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS=8
# The default gas price (in Wei) used to send Foreign network transactions
# finalizing asset deposits. This price is used if the Gas price oracle is
# unreachable.
FOREIGN_GAS_PRICE=10000000000

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
VALIDATORS=0x 0x 0x


# Variable to define whether to use RewardableValidators contract and set a fee manager contract on Home network
# On this bridge mode only BOTH_DIRECTIONS is supported on Home network
HOME_REWARDABLE=false
# Variable to define whether to use RewardableValidators contract and set a fee manager contract on Foreign network
# Collecting fees on Foreign network is not supported on this bridge mode.
FOREIGN_REWARDABLE=false
# Variable to define if Home network is a POSDAO and rewards are distributed by blockReward contract to network validators or transferred directly to bridge validators.
# Supported values are BRIDGE_VALIDATORS_REWARD and POSDAO_REWARD
HOME_FEE_MANAGER_TYPE=BRIDGE_VALIDATORS_REWARD
# List of validators accounts where rewards should be transferred separated by space without quotes
# Makes sense only when HOME_REWARDABLE=BOTH_DIRECTIONS
VALIDATORS_REWARD_ACCOUNTS=0x 0x 0x

# Fee to be taken for every transaction directed from the Home network to the Foreign network
# Makes sense only when HOME_REWARDABLE=BOTH_DIRECTIONS
# e.g. 0.1% fee
HOME_TRANSACTIONS_FEE=0.001
# Fee to be taken for every transaction directed from the Foreign network to the Home network
# Makes sense only when HOME_REWARDABLE=BOTH_DIRECTIONS
# e.g. 0.1% fee
FOREIGN_TRANSACTIONS_FEE=0.001

# The api url of an explorer to verify all the deployed contracts in Home network. Supported explorers: Blockscout, etherscan
#HOME_EXPLORER_URL=https://blockscout.com/poa/core/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Home network.
#HOME_EXPLORER_API_KEY=
# The api url of an explorer to verify all the deployed contracts in Foreign network. Supported explorers: Blockscout, etherscan
#FOREIGN_EXPLORER_URL=https://api.etherscan.io/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Foreign network.
#FOREIGN_EXPLORER_API_KEY=
```

## `ARBITRARY-MESSAGE` Bridge Mode Configuration Example.

This example of an `.env` file for the `arbitrary-message` bridge mode includes comments describing each parameter.

```bash
# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=ARBITRARY_MESSAGE

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# Extra gas added to the estimated gas of a particular deployment/configuration transaction
# E.g. if estimated gas returns 100000 and the parameter is 0.2,
# the transaction gas limit will be (100000 + 100000 * 0.2) = 120000
DEPLOYMENT_GAS_LIMIT_EXTRA=0.2
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Home network (in Wei).
HOME_DEPLOYMENT_GAS_PRICE=10000000000
# The "gasPrice" parameter set in every deployment/configuration transaction on
# Foreign network (in Wei).
FOREIGN_DEPLOYMENT_GAS_PRICE=10000000000
# The timeout limit to wait for receipt of the deployment/configuration
# transaction.
GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://poa.infura.io
# Address on Home network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
HOME_BRIDGE_OWNER=0x
# Address on Home network with permissions to change parameters of bridge validator contract.
HOME_VALIDATORS_OWNER=0x
# Address on Home network with permissions to upgrade the bridge contract and the
# bridge validator contract.
HOME_UPGRADEABLE_ADMIN=0x
# The maximum value of gas for one call to be allowed for relaying.
HOME_MAX_AMOUNT_PER_TX=20000000
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
# Address on Foreign network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
FOREIGN_BRIDGE_OWNER=0x
# Address on Foreign network with permissions to change parameters of bridge validator contract.
FOREIGN_VALIDATORS_OWNER=0x
# Address on Foreign network with permissions to upgrade the bridge contract and the
# bridge validator contract.
FOREIGN_UPGRADEABLE_ADMIN=0x
# The maximum value of gas for one call to be allowed for relaying.
FOREIGN_MAX_AMOUNT_PER_TX=20000000
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
VALIDATORS=0x 0x 0x

# The api url of an explorer to verify all the deployed contracts in Home network. Supported explorers: Blockscout, etherscan
#HOME_EXPLORER_URL=https://blockscout.com/poa/core/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Home network.
#HOME_EXPLORER_API_KEY=
# The api url of an explorer to verify all the deployed contracts in Foreign network. Supported explorers: Blockscout, etherscan
#FOREIGN_EXPLORER_URL=https://api.etherscan.io/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Foreign network.
#FOREIGN_EXPLORER_API_KEY=
```

## `AMB-ERC-TO-ERC` Bridge Mode Configuration Example.

This example of an `.env` file for the `AMB-ERC-TO-ERC` bridge mode includes comments describing each parameter.

```bash
# The type of bridge. Defines set of contracts to be deployed.
BRIDGE_MODE=AMB_ERC_TO_ERC

# The private key hex value of the account responsible for contracts
# deployments and initial configuration. The account's balance must contain
# funds from both networks.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
# Extra gas added to the estimated gas of a particular deployment/configuration transaction
# E.g. if estimated gas returns 100000 and the parameter is 0.2,
# the transaction gas limit will be (100000 + 100000 * 0.2) = 120000
DEPLOYMENT_GAS_LIMIT_EXTRA=0.2
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
BRIDGEABLE_TOKEN_NAME=Your New Bridged Token
# The symbol name of the ERC677 token to be deployed on the Home network.
BRIDGEABLE_TOKEN_SYMBOL=TEST
# The number of supportable decimal digits after the "point" in the ERC677 token
# to be deployed on the Home network.
BRIDGEABLE_TOKEN_DECIMALS=18
# The flag defining whether to use ERC677BridgeTokenRewardable contract instead of
# ERC677BridgeToken on Home network.
DEPLOY_REWARDABLE_TOKEN=false
# The address of Staking contract used by ERC677BridgeTokenRewardable contract.
# Makes sense only when DEPLOY_REWARDABLE_TOKEN=true
#DPOS_STAKING_ADDRESS=0x
# The address of BlockReward contract used by ERC677BridgeTokenRewardable contract.
# Makes sense only when DEPLOY_REWARDABLE_TOKEN=true
#BLOCK_REWARD_ADDRESS=0x

# The RPC channel to a Home node able to handle deployment/configuration
# transactions.
HOME_RPC_URL=https://core.poa.network
# Address on Home network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
HOME_BRIDGE_OWNER=0x
# Address on Home network with permissions to upgrade the bridge contract
HOME_UPGRADEABLE_ADMIN=0x
# The daily transaction limit in Wei. As soon as this limit is exceeded, any
# transaction which requests to relay assets will fail.
HOME_DAILY_LIMIT=30000000000000000000000000
# The maximum limit for one transaction in Wei. If a single transaction tries to
# relay funds exceeding this limit it will fail. HOME_MAX_AMOUNT_PER_TX must be
# less than HOME_DAILY_LIMIT.
HOME_MAX_AMOUNT_PER_TX=1500000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail. This is required to prevent dryout
# validator accounts.
HOME_MIN_AMOUNT_PER_TX=500000000000000000

# The RPC channel to a Foreign node able to handle deployment/configuration
# transactions.
FOREIGN_RPC_URL=https://mainnet.infura.io
# Address on Foreign network with permissions to change parameters of the bridge contract.
# For extra security we recommended using a multi-sig wallet contract address here.
FOREIGN_BRIDGE_OWNER=0x
# Address on Foreign network with permissions to upgrade the bridge contract and the
# bridge validator contract.
FOREIGN_UPGRADEABLE_ADMIN=0x
# The daily limit in Wei. As soon as this limit is exceeded, any transaction
# requesting to relay assets will fail.
FOREIGN_DAILY_LIMIT=15000000000000000000000000
# The maximum limit per one transaction in Wei. If a transaction tries to relay
# funds exceeding this limit it will fail. FOREIGN_MAX_AMOUNT_PER_TX must be less
# than FOREIGN_DAILY_LIMIT.
FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
# The minimum limit for one transaction in Wei. If a transaction tries to relay
# funds below this limit it will fail.
FOREIGN_MIN_AMOUNT_PER_TX=500000000000000000
# The address of the existing ERC20/ERC677 compatible token in the Foreign network to
# be exchanged to the ERC20/ERC677 token deployed on Home.
ERC20_TOKEN_ADDRESS=0x

# The address of the existing AMB bridge in the Home network that will be used to pass messages
# to the Foreign network.
HOME_AMB_BRIDGE=0x
# The address of the existing AMB bridge in the Foreign network that will be used to pass messages
# to the Home network.
FOREIGN_AMB_BRIDGE=0x
# The gas limit that will be used in the execution of the message passed to the mediator contract
# in the Foreign network.
HOME_MEDIATOR_REQUEST_GAS_LIMIT=2000000
# The gas limit that will be used in the execution of the message passed to the mediator contract
# in the Home network.
FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT=2000000

# The api url of an explorer to verify all the deployed contracts in Home network. Supported explorers: Blockscout, etherscan
#HOME_EXPLORER_URL=https://blockscout.com/poa/core/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Home network.
#HOME_EXPLORER_API_KEY=
# The api url of an explorer to verify all the deployed contracts in Foreign network. Supported explorers: Blockscout, etherscan
#FOREIGN_EXPLORER_URL=https://api.etherscan.io/api
# The api key of the explorer api, if required, used to verify all the deployed contracts in Foreign network.
#FOREIGN_EXPLORER_API_KEY=
```
