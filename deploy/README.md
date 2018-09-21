# How to deploy POA bridge contracts

It is assumed that steps listed below are executed in `deploy` folder.

1. Install packages needed for deployment
   ```bash
   npm install
   ```

2. create `.env` file by
   ```bash
   cp .env.example .env
   ```

3. if it is necessary, deploy and configure a multi-sig wallet contract which will be used to manage the bridge contracts after deployment.

4. adjust parameters in the .env file

   ```bash
   DEPLOYMENT_ACCOUNT_ADDRESS=0xb8988b690910913c97a090c3a6f80fad8b3a4683
   DEPLOYMENT_ACCOUNT_PRIVATE_KEY=67..14
   DEPLOYMENT_GAS_LIMIT=4000000
   DEPLOYMENT_GAS_PRICE=10
   GET_RECEIPT_INTERVAL_IN_MILLISECONDS=3000

   HOME_RPC_URL=https://sokol.poa.network
   HOME_OWNER_MULTISIG=0x
   HOME_UPGRADEABLE_ADMIN_VALIDATORS=0x
   HOME_UPGRADEABLE_ADMIN_BRIDGE=0x
   HOME_DAILY_LIMIT=30000000000000000000000000
   HOME_MAX_AMOUNT_PER_TX=1500000000000000000000000
   HOME_MIN_AMOUNT_PER_TX=500000000000000000
   HOME_REQUIRED_BLOCK_CONFIRMATIONS=1
   HOME_GAS_PRICE=1

   FOREIGN_RPC_URL=https://sokol.poa.network
   FOREIGN_OWNER_MULTISIG=0x
   FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS=0x
   FOREIGN_UPGRADEABLE_ADMIN_BRIDGE=0x
   FOREIGN_DAILY_LIMIT=15000000000000000000000000
   FOREIGN_MAX_AMOUNT_PER_TX=750000000000000000000000
   FOREIGN_MIN_AMOUNT_PER_TX=500000000000000000
   FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS=8
   FOREIGN_GAS_PRICE=10

   REQUIRED_NUMBER_OF_VALIDATORS=1
   VALIDATORS="0x 0x 0x"
   ```

5. fill the balance of the deployment account in Home and Foreign networks

6. run the deployment script
   ```bash
   node deploy.js
   ```

## Explanation of parameters in `.env` file

Name | Description
--------- | -------
DEPLOYMENT_ACCOUNT_ADDRESS | Temporary  account from which all contracts will be deployed. Make sure that the deployment account owns some ether on both kovan & sokol network.
DEPLOYMENT_ACCOUNT_PRIVATE_KEY | private key from temp account
DEPLOYMENT_GAS_LIMIT | Gas Limit to use for transactions during bridge contract provisioning 
DEPLOYMENT_GAS_PRICE | Gas Price to use for transactions during bridge contract provisioning on both networks in gwei  
GET_RECEIPT_INTERVAL_IN_MILLISECONDS | Interval that is used to wait for tx to be mined( 3 sec in example)
HOME_RPC_URL | Public RPC Node URL for Home Network  
HOME_OWNER_MULTISIG | Address of Administrator role on Home network to change parameters of the bridge and validator's contract
HOME_UPGRADEABLE_ADMIN_VALIDATORS | Address from which Validator's contract could be upgraded
HOME_UPGRADEABLE_ADMIN_BRIDGE | Address from which HomeBridge's contract could be upgraded
HOME_DAILY_LIMIT | Daily Limit in Wei. Example above is `1 eth`  
HOME_MAX_AMOUNT_PER_TX | Max limit per 1 tx in Wei. Example above is `0.1 eth`  
HOME_MIN_AMOUNT_PER_TX | Minimum amount per 1 tx in Wei. Example above is `0.01 eth`  
HOME_REQUIRED_BLOCK_CONFIRMATIONS | Number of blocks issued after the block with the corresponding deposit transaction to make sure that the transaction will not be rolled back
HOME_GAS_PRICE | Gas Price to use for transactions to relay withdraws to Home Network
FOREIGN_RPC_URL | Public RPC Node URL for Foreign Network  
FOREIGN_OWNER_MULTISIG | Address of Administrator role on FOREIGN network to change parameters of the bridge and validator's contract
FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS | Address from which Validator's contract could be upgraded
FOREIGN_UPGRADEABLE_ADMIN_BRIDGE | Address from which HomeBridge's contract could be upgraded
FOREIGN_DAILY_LIMIT | Daily Limit in Wei. Example above is `1 eth`  
FOREIGN_MAX_AMOUNT_PER_TX | Max limit per 1 tx in Wei. Example above is `0.1 eth`  
FOREIGN_MIN_AMOUNT_PER_TX | Minimum amount per 1 tx in Wei. Example above is `0.01 eth`  
FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS | Number of blocks issued after the block with the corresponding withdraw transaction to make sure that the transaction will not be rolled back
FOREIGN_GAS_PRICE | Gas Price to use for transactions to deposit and confirm withdraws to Foreign Network
VALIDATORS | array of validators on Home and Foreign network. Space separated.  
REQUIRED_NUMBER_OF_VALIDATORS | Minimum Number of validators in order to Withdraw Funds on POA network Sokol  

