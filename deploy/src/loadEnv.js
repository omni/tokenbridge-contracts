const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3').utils
const envalid = require('envalid')
const { ZERO_ADDRESS } = require('./constants')

// Validations and constants
const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']
const validRewardModes = ['false', 'ONE_DIRECTION', 'BOTH_DIRECTIONS']
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
const validateRewardableAddresses = (validators, rewards) => {
  const validatorsLength = validators ? validators.split(' ').length : 0
  const validatorsRewardLength = rewards ? rewards.split(' ').length : 0
  if (validatorsLength !== validatorsRewardLength) {
    throw new Error(
      `List of rewards accounts (${validatorsRewardLength} accounts) should be the same length as list of validators (${validatorsLength} accounts)`
    )
  }
}

const {
  BRIDGE_MODE,
  HOME_REWARDABLE,
  FOREIGN_REWARDABLE,
  VALIDATORS,
  VALIDATORS_REWARD_ACCOUNTS,
  DEPLOY_REWARDABLE_TOKEN
} = process.env

if (!validBridgeModes.includes(BRIDGE_MODE)) {
  throw new Error(`Invalid bridge mode: ${BRIDGE_MODE}`)
}

if (!validRewardModes.includes(HOME_REWARDABLE)) {
  throw new Error(
    `Invalid HOME_REWARDABLE: ${HOME_REWARDABLE}. Supported values are ${validRewardModes}`
  )
}

if (!validRewardModes.includes(FOREIGN_REWARDABLE)) {
  throw new Error(
    `Invalid FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE}. Supported values are ${validRewardModes}`
  )
}

let validations = {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT: bigNumValidator(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  HOME_RPC_URL: envalid.str(),
  HOME_BRIDGE_OWNER: addressValidator(),
  HOME_VALIDATORS_OWNER: addressesValidator(),
  HOME_UPGRADEABLE_ADMIN: addressValidator(),
  HOME_DAILY_LIMIT: bigNumValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
  HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  HOME_GAS_PRICE: bigNumValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_BRIDGE_OWNER: addressValidator(),
  FOREIGN_VALIDATORS_OWNER: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN: addressValidator(),
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
  FOREIGN_GAS_PRICE: bigNumValidator(),
  REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
  VALIDATORS: addressesValidator()
}

if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    FOREIGN_DAILY_LIMIT: bigNumValidator(),
    FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool(),
    BLOCK_REWARD_ADDRESS: addressValidator()
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_VALIDATOR_SET_ADDRESS: addressValidator()
    }
  }

  if (FOREIGN_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(
      `FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE} is not supported on ${BRIDGE_MODE} bridge mode`
    )
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS' && FOREIGN_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Combination of HOME_REWARDABLE: ${HOME_REWARDABLE} and FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE} should be avoided on ${BRIDGE_MODE} bridge mode.`
    )
  }
}
if (BRIDGE_MODE === 'ERC_TO_ERC') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num()
  }
}
if (BRIDGE_MODE === 'ERC_TO_NATIVE') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BLOCK_REWARD_ADDRESS: addressValidator({
      default: ZERO_ADDRESS
    })
  }

  if (HOME_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Only BOTH_DIRECTIONS is supported for collecting fees on Home Network on ${BRIDGE_MODE} bridge mode.`
    )
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(
      `Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`
    )
  }
}

if (HOME_REWARDABLE !== 'false' || FOREIGN_REWARDABLE !== 'false') {
  validateRewardableAddresses(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
  validations = {
    ...validations,
    VALIDATORS_REWARD_ACCOUNTS: addressesValidator(),
    HOME_TRANSACTIONS_FEE: envalid.num(),
    FOREIGN_TRANSACTIONS_FEE: envalid.num()
  }
}

const env = envalid.cleanEnv(process.env, validations)

module.exports = env
