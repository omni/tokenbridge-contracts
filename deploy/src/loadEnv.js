const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3').utils
const envalid = require('envalid')
const { ZERO_ADDRESS, EVM_TYPES } = require('./constants')

const homePrefix = 'HOME'
const foreignPrefix = 'FOREIGN'

// Validations and constants
const evmVersions = [EVM_TYPES.BYZANTIUM, EVM_TYPES.SPURIOUSDRAGON]
const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC', 'ERC_TO_NATIVE']
const validRewardModes = ['false', 'ONE_DIRECTION', 'BOTH_DIRECTIONS']
const validFeeManagerTypes = ['BRIDGE_VALIDATORS_REWARD', 'POSDAO_REWARD']
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

function checkValidators(validators, requiredValidators) {
  if (validators.split(' ').length < requiredValidators) {
    throw new Error(
      `The number of validators VALIDATORS = ${
        validators.split(' ').length
      } should be bigger or equal the number of required signatures REQUIRED_NUMBER_OF_VALIDATORS = ${requiredValidators} .`
    )
  }
}

function checkGasPrices(gasPrice, prefix) {
  if (gasPrice.isZero()) {
    throw new Error(`${prefix}_GAS_PRICE should be bigger than zero.`)
  }
}

function checkBlockConfirmations(confirmations, prefix) {
  if (confirmations <= 0) {
    throw new Error(`${prefix}_REQUIRED_BLOCK_CONFIRMATIONS should be bigger than zero.`)
  }
}

function checkLimits(min, max, daily, prefix) {
  if (min.isZero() || min.gte(max) || max.gte(daily)) {
    throw new Error(
      `Limit parameters should be defined as 0 < ${prefix}_MIN_AMOUNT_PER_TX < ${prefix}_MAX_AMOUNT_PER_TX < ${prefix}_DAILY_LIMIT`
    )
  }
}

const {
  BRIDGE_MODE,
  HOME_REWARDABLE,
  FOREIGN_REWARDABLE,
  VALIDATORS,
  VALIDATORS_REWARD_ACCOUNTS,
  DEPLOY_REWARDABLE_TOKEN,
  HOME_FEE_MANAGER_TYPE,
  ERC20_EXTENDED_BY_ERC677,
  HOME_EVM_VERSION,
  FOREIGN_EVM_VERSION
} = process.env

// Types validations

if (HOME_EVM_VERSION) {
  if (!evmVersions.includes(HOME_EVM_VERSION)) {
    throw new Error(
      `Invalid Home EVM Version: ${HOME_EVM_VERSION}. Supported values are ${evmVersions}`
    )
  }
}

if (FOREIGN_EVM_VERSION) {
  if (!evmVersions.includes(FOREIGN_EVM_VERSION)) {
    throw new Error(
      `Invalid Foreign EVM Version: ${FOREIGN_EVM_VERSION}. Supported values are ${evmVersions}`
    )
  }
}

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
  DEPLOYMENT_GAS_LIMIT_EXTRA: envalid.num(),
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
  FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_DAILY_LIMIT: bigNumValidator(),
  REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
  VALIDATORS: addressesValidator()
}

if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool()
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_STAKING_ADDRESS: addressValidator(),
      BLOCK_REWARD_ADDRESS: addressValidator()
    }
  }
}

if (BRIDGE_MODE === 'ERC_TO_ERC') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool(),
    ERC20_EXTENDED_BY_ERC677: envalid.bool()
  }

  if (ERC20_EXTENDED_BY_ERC677 === 'true') {
    validations = {
      ...validations,
      FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator()
    }
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_STAKING_ADDRESS: addressValidator(),
      BLOCK_REWARD_ADDRESS: addressValidator()
    }
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
}

if (HOME_REWARDABLE !== 'false' || FOREIGN_REWARDABLE !== 'false') {
  validations = {
    ...validations,
    HOME_TRANSACTIONS_FEE: envalid.num(),
    FOREIGN_TRANSACTIONS_FEE: envalid.num(),
  }
  if (
    (BRIDGE_MODE === 'ERC_TO_NATIVE' &&
      HOME_REWARDABLE === 'BOTH_DIRECTIONS' &&
      HOME_FEE_MANAGER_TYPE === 'POSDAO_REWARD') ||
    (BRIDGE_MODE === 'ERC_TO_ERC' &&
      HOME_REWARDABLE === 'BOTH_DIRECTIONS')
  ) {
    validations = {
      ...validations,
      BLOCK_REWARD_ADDRESS: addressValidator({
        default: ZERO_ADDRESS
      })
    }
  } else {
    validations = {
      ...validations,
      VALIDATORS_REWARD_ACCOUNTS: addressesValidator()
    }
    validateRewardableAddresses(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
  }
}

const env = envalid.cleanEnv(process.env, validations)

// Logic validations
checkValidators(env.VALIDATORS, env.REQUIRED_NUMBER_OF_VALIDATORS)
checkGasPrices(env.FOREIGN_GAS_PRICE, foreignPrefix)
checkBlockConfirmations(env.HOME_REQUIRED_BLOCK_CONFIRMATIONS, homePrefix)
checkBlockConfirmations(env.FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS, foreignPrefix)
checkLimits(
  env.HOME_MIN_AMOUNT_PER_TX,
  env.HOME_MAX_AMOUNT_PER_TX,
  env.HOME_DAILY_LIMIT,
  homePrefix
)

if (env.BRIDGE_MODE === 'NATIVE_TO_ERC') {
  checkGasPrices(env.HOME_GAS_PRICE, homePrefix)
  checkLimits(
    env.FOREIGN_MIN_AMOUNT_PER_TX,
    env.FOREIGN_MAX_AMOUNT_PER_TX,
    env.FOREIGN_DAILY_LIMIT,
    foreignPrefix
  )
  if (env.FOREIGN_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(
      `FOREIGN_REWARDABLE: ${env.FOREIGN_REWARDABLE} is not supported on ${
        env.BRIDGE_MODE
      } bridge mode`
    )
  }

  if (env.HOME_REWARDABLE === 'BOTH_DIRECTIONS' && env.FOREIGN_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Combination of HOME_REWARDABLE: ${env.HOME_REWARDABLE} and FOREIGN_REWARDABLE: ${
        env.FOREIGN_REWARDABLE
      } should be avoided on ${env.BRIDGE_MODE} bridge mode.`
    )
  }
}

if (env.BRIDGE_MODE === 'ERC_TO_ERC') {
  if (env.ERC20_EXTENDED_BY_ERC677) {
    checkLimits(
      env.FOREIGN_MIN_AMOUNT_PER_TX,
      env.FOREIGN_MAX_AMOUNT_PER_TX,
      env.FOREIGN_DAILY_LIMIT,
      foreignPrefix
    )
  } else if (env.FOREIGN_MAX_AMOUNT_PER_TX.gte(env.FOREIGN_DAILY_LIMIT)) {
    throw new Error(`FOREIGN_DAILY_LIMIT should be greater than FOREIGN_MAX_AMOUNT_PER_TX`)
  }

  if (env.HOME_REWARDABLE === 'BOTH_DIRECTIONS' && env.BLOCK_REWARD_ADDRESS === ZERO_ADDRESS) {
    throw new Error(
      'Collecting fees on Home Network on ERC_TO_ERC mode without Block Reward contract is not supported.'
    )
  }

  if (env.FOREIGN_REWARDABLE !== 'false') {
    throw new Error(
      `Collecting fees on Foreign Network on ${env.BRIDGE_MODE} bridge mode is not supported.`
    )
  }
}

if (env.BRIDGE_MODE === 'ERC_TO_NATIVE') {
  if (env.FOREIGN_MAX_AMOUNT_PER_TX.gte(env.FOREIGN_DAILY_LIMIT)) {
    throw new Error(`FOREIGN_DAILY_LIMIT should be greater than FOREIGN_MAX_AMOUNT_PER_TX`)
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

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    if (!validFeeManagerTypes.includes(HOME_FEE_MANAGER_TYPE)) {
      throw new Error(
        `Invalid fee manager type: HOME_FEE_MANAGER_TYPE = ${HOME_FEE_MANAGER_TYPE}. Supported values are ${validFeeManagerTypes}`
      )
    }
  }
}

module.exports = env
