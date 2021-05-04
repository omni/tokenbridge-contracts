const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '..', '.env')
})
const { isAddress, toBN } = require('web3').utils
const envalid = require('envalid')
const { ZERO_ADDRESS } = require('./constants')

const homePrefix = 'HOME'
const foreignPrefix = 'FOREIGN'

// Validations and constants
const validBridgeModes = ['ERC_TO_NATIVE', 'ARBITRARY_MESSAGE', 'AMB_ERC_TO_ERC']
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
  HOME_FEE_MANAGER_TYPE
} = process.env

// Types validations

if (!validBridgeModes.includes(BRIDGE_MODE)) {
  throw new Error(`Invalid bridge mode: ${BRIDGE_MODE}`)
}

let validations = {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY: envalid.str(),
  DEPLOYMENT_GAS_LIMIT_EXTRA: envalid.num(),
  HOME_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  FOREIGN_DEPLOYMENT_GAS_PRICE: bigNumValidator(),
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS: bigNumValidator(),
  HOME_RPC_URL: envalid.str(),
  HOME_BRIDGE_OWNER: addressValidator(),
  HOME_UPGRADEABLE_ADMIN: addressValidator(),
  FOREIGN_RPC_URL: envalid.str(),
  FOREIGN_BRIDGE_OWNER: addressValidator(),
  FOREIGN_UPGRADEABLE_ADMIN: addressValidator(),
  HOME_MAX_AMOUNT_PER_TX: bigNumValidator(),
  FOREIGN_MAX_AMOUNT_PER_TX: bigNumValidator()
}

if (BRIDGE_MODE.includes('AMB_')) {
  validations = {
    ...validations,
    HOME_AMB_BRIDGE: addressValidator(),
    FOREIGN_AMB_BRIDGE: addressValidator(),
    HOME_MEDIATOR_REQUEST_GAS_LIMIT: bigNumValidator(),
    FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT: bigNumValidator(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    FOREIGN_DAILY_LIMIT: bigNumValidator()
  }

  if (BRIDGE_MODE === 'AMB_ERC_TO_ERC') {
    validations = {
      ...validations,
      BRIDGEABLE_TOKEN_NAME: envalid.str(),
      BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
      BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
      DEPLOY_REWARDABLE_TOKEN: envalid.bool({ default: false }),
      ERC20_TOKEN_ADDRESS: addressValidator()
    }
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_STAKING_ADDRESS: addressValidator(),
      BLOCK_REWARD_ADDRESS: addressValidator()
    }
  }
} else {
  validations = {
    ...validations,
    HOME_VALIDATORS_OWNER: addressesValidator(),
    HOME_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
    HOME_GAS_PRICE: bigNumValidator(),
    FOREIGN_VALIDATORS_OWNER: addressValidator(),
    FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS: envalid.num(),
    FOREIGN_GAS_PRICE: bigNumValidator(),
    REQUIRED_NUMBER_OF_VALIDATORS: envalid.num(),
    VALIDATORS: addressesValidator()
  }
}

if (BRIDGE_MODE !== 'ARBITRARY_MESSAGE') {
  validations = {
    ...validations,
    HOME_DAILY_LIMIT: bigNumValidator(),
    HOME_MIN_AMOUNT_PER_TX: bigNumValidator(),
    FOREIGN_DAILY_LIMIT: bigNumValidator()
  }

  if (BRIDGE_MODE === 'ERC_TO_NATIVE') {
    if (!validRewardModes.includes(HOME_REWARDABLE)) {
      throw new Error(`Invalid HOME_REWARDABLE: ${HOME_REWARDABLE}. Supported values are ${validRewardModes}`)
    }

    if (!validRewardModes.includes(FOREIGN_REWARDABLE)) {
      throw new Error(`Invalid FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE}. Supported values are ${validRewardModes}`)
    }

    if (HOME_REWARDABLE !== 'false' || FOREIGN_REWARDABLE !== 'false') {
      validations = {
        ...validations,
        HOME_TRANSACTIONS_FEE: envalid.num(),
        FOREIGN_TRANSACTIONS_FEE: envalid.num()
      }
      if (
        BRIDGE_MODE === 'ERC_TO_NATIVE' &&
        HOME_REWARDABLE === 'BOTH_DIRECTIONS' &&
        HOME_FEE_MANAGER_TYPE === 'POSDAO_REWARD'
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
  }
}

if (BRIDGE_MODE === 'ERC_TO_NATIVE') {
  validations = {
    ...validations,
    ERC20_TOKEN_ADDRESS: addressValidator(),
    BLOCK_REWARD_ADDRESS: addressValidator({
      default: ZERO_ADDRESS
    }),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator()
  }
}

const env = envalid.cleanEnv(process.env, validations)

if (!env.BRIDGE_MODE.includes('AMB_')) {
  // Logic validations
  checkValidators(env.VALIDATORS, env.REQUIRED_NUMBER_OF_VALIDATORS)
  checkGasPrices(env.FOREIGN_GAS_PRICE, foreignPrefix)
  checkBlockConfirmations(env.HOME_REQUIRED_BLOCK_CONFIRMATIONS, homePrefix)
  checkBlockConfirmations(env.FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS, foreignPrefix)
}

if (env.BRIDGE_MODE === 'ARBITRARY_MESSAGE') {
  if (env.HOME_MAX_AMOUNT_PER_TX.isZero()) {
    throw new Error(`HOME_MAX_AMOUNT_PER_TX should be greater than 0`)
  }
  if (env.FOREIGN_MAX_AMOUNT_PER_TX.isZero()) {
    throw new Error(`FOREIGN_MAX_AMOUNT_PER_TX should be greater than 0`)
  }
} else {
  checkLimits(env.HOME_MIN_AMOUNT_PER_TX, env.HOME_MAX_AMOUNT_PER_TX, env.HOME_DAILY_LIMIT, homePrefix)
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)
}

if (env.BRIDGE_MODE === 'ERC_TO_NATIVE') {
  if (HOME_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Only BOTH_DIRECTIONS is supported for collecting fees on Home Network on ${BRIDGE_MODE} bridge mode.`
    )
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(`Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`)
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
