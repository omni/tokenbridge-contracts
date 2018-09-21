const { isAddress, toBN } = require('web3').utils
const path = require('path')
const envalid = require('envalid')
require('dotenv').config({
  path: path.join(__dirname, '', '.env')
})

const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']
const bigNumValidator = envalid.makeValidator(x => toBN(x))
const validateAddress = address => {
  if (isAddress(address)) {
    return address
  }

  throw new Error(`Invalid address: ${address}`)
}
const addressValidator = envalid.makeValidator(validateAddress)
const addressesValidator = envalid.makeValidator(addresses => {
  addresses.split(' ').forEach(validateAddress)
  return addresses
})

const env = envalid.cleanEnv(process.env, {
  BRIDGE_MODE: envalid.str(validBridgeModes),
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT: bigNumValidator(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  BRIDGEABLE_TOKEN_NAME: envalid.str(),
  BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
  BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
  HOME_RPC_URL: envalid.str(),
  HOME_OWNER_MULTISIG: addressValidator(),
  HOME_UPGRADEABLE_ADMIN_VALIDATORS: addressesValidator(),
  HOME_UPGRADEABLE_ADMIN_BRIDGE: addressValidator(),
  HOME_DAILY_LIMIT: bigNumValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
  HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  HOME_GAS_PRICE: bigNumValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_OWNER_MULTISIG: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN_BRIDGE: addressValidator(),
  FOREIGN_DAILY_LIMIT: bigNumValidator(),
  FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  FOREIGN_GAS_PRICE: bigNumValidator(),
  REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
  VALIDATORS: addressesValidator(),
  ERC20_TOKEN_ADDRESS: addressValidator({
    default: '0x0000000000000000000000000000000000000000'
  }),
  BLOCK_REWARD_ADDRESS: envalid.str({
    devDefault: ''
  })
})

if (
  env.BRIDGE_MODE === 'ERC_TO_ERC' &&
  env.ERC20_TOKEN_ADDRESS === '0x0000000000000000000000000000000000000000'
) {
  throw new Error('ERC_TO_ERC mode requires ERC20_TOKEN_ADDRESS to be set')
}

module.exports = env
