const Web3 = require('web3')
const env = require('./loadEnv')

const {
  HOME_RPC_URL,
  FOREIGN_RPC_URL,
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY
} = env

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL)
const web3Home = new Web3(homeProvider)

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL)
const web3Foreign = new Web3(foreignProvider)

const { HOME_DEPLOYMENT_GAS_PRICE, FOREIGN_DEPLOYMENT_GAS_PRICE } = env
const GAS_LIMIT = env.DEPLOYMENT_GAS_LIMIT

const deploymentPrivateKey = Buffer.from(DEPLOYMENT_ACCOUNT_PRIVATE_KEY, 'hex')

module.exports = {
  web3Home,
  web3Foreign,
  deploymentPrivateKey,
  HOME_RPC_URL,
  FOREIGN_RPC_URL,
  GAS_LIMIT,
  HOME_DEPLOYMENT_GAS_PRICE,
  FOREIGN_DEPLOYMENT_GAS_PRICE,
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS
}
