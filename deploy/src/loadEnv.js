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
const validBridgeModes = [
  'NATIVE_TO_ERC',
  'ERC_TO_ERC',
  'ERC_TO_NATIVE',
  'ARBITRARY_MESSAGE',
  'AMB_ERC_TO_ERC',
  'STAKE_AMB_ERC_TO_ERC',
  'AMB_NATIVE_TO_ERC',
  'AMB_ERC_TO_NATIVE',
  'MULTI_AMB_ERC_TO_ERC'
]
const validRewardModes = ['false', 'ONE_DIRECTION', 'BOTH_DIRECTIONS']
const validFeeManagerTypes = ['BRIDGE_VALIDATORS_REWARD', 'POSDAO_REWARD']
const bigNumValidator = envalid.makeValidator(x => toBN(x))
const validateAddress = address => {
  if (isAddress(address)) {
    return address
  }

  throw new Error(`Invalid address: ${address}`)
}
const validateOptionalAddress = address => {
  if (address !== '') {
    return validateAddress(address)
  }
  return address
}
const addressValidator = envalid.makeValidator(validateAddress)
const optionalAddressValidator = envalid.makeValidator(validateOptionalAddress)
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
  DEPLOY_INTEREST_RECEIVER,
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

  if (BRIDGE_MODE !== 'AMB_ERC_TO_NATIVE' && BRIDGE_MODE !== 'MULTI_AMB_ERC_TO_ERC') {
    validations = {
      ...validations,
      BRIDGEABLE_TOKEN_NAME: envalid.str(),
      BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
      BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
      DEPLOY_REWARDABLE_TOKEN: envalid.bool({ default: false })
    }
  }

  if (DEPLOY_REWARDABLE_TOKEN === 'true') {
    validations = {
      ...validations,
      DPOS_STAKING_ADDRESS: addressValidator(),
      BLOCK_REWARD_ADDRESS: addressValidator()
    }
  }

  if (BRIDGE_MODE === 'AMB_ERC_TO_ERC') {
    validations = {
      ...validations,
      ERC20_TOKEN_ADDRESS: addressValidator()
    }
  } else if (BRIDGE_MODE === 'STAKE_AMB_ERC_TO_ERC') {
    validations = {
      ...validations,
      HOME_STAKE_TOKEN_ADDRESS: addressValidator(),
      FOREIGN_STAKE_TOKEN_ADDRESS: addressValidator(),
      HOME_TRANSACTIONS_FEE: envalid.num()
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

  if (BRIDGE_MODE !== 'AMB_ERC_TO_ERC' && BRIDGE_MODE !== 'STAKE_AMB_ERC_TO_ERC') {
    if (!validRewardModes.includes(HOME_REWARDABLE)) {
      throw new Error(`Invalid HOME_REWARDABLE: ${HOME_REWARDABLE}. Supported values are ${validRewardModes}`)
    }

    if (!validRewardModes.includes(FOREIGN_REWARDABLE)) {
      throw new Error(`Invalid FOREIGN_REWARDABLE: ${FOREIGN_REWARDABLE}. Supported values are ${validRewardModes}`)
    }
    if (BRIDGE_MODE === 'AMB_NATIVE_TO_ERC') {
      if (HOME_REWARDABLE !== 'false') {
        validations = {
          ...validations,
          HOME_MEDIATOR_REWARD_ACCOUNTS: addressesValidator()
        }
      }
      if (FOREIGN_REWARDABLE !== 'false') {
        validations = {
          ...validations,
          FOREIGN_MEDIATOR_REWARD_ACCOUNTS: addressesValidator()
        }
      }
    } else if (HOME_REWARDABLE !== 'false' || FOREIGN_REWARDABLE !== 'false') {
      validations = {
        ...validations,
        HOME_TRANSACTIONS_FEE: envalid.num(),
        FOREIGN_TRANSACTIONS_FEE: envalid.num()
      }
      if (
        (BRIDGE_MODE === 'ERC_TO_NATIVE' &&
          HOME_REWARDABLE === 'BOTH_DIRECTIONS' &&
          HOME_FEE_MANAGER_TYPE === 'POSDAO_REWARD') ||
        (BRIDGE_MODE === 'ERC_TO_ERC' && HOME_REWARDABLE === 'BOTH_DIRECTIONS')
      ) {
        validations = {
          ...validations,
          BLOCK_REWARD_ADDRESS: addressValidator({
            default: ZERO_ADDRESS
          })
        }
      } else if (BRIDGE_MODE !== 'AMB_ERC_TO_NATIVE' && BRIDGE_MODE !== 'MULTI_AMB_ERC_TO_ERC') {
        validations = {
          ...validations,
          VALIDATORS_REWARD_ACCOUNTS: addressesValidator()
        }
        validateRewardableAddresses(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
      }
    }
  }
}

if (BRIDGE_MODE === 'NATIVE_TO_ERC') {
  validations = {
    ...validations,
    BRIDGEABLE_TOKEN_NAME: envalid.str(),
    BRIDGEABLE_TOKEN_SYMBOL: envalid.str(),
    BRIDGEABLE_TOKEN_DECIMALS: envalid.num(),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    DEPLOY_REWARDABLE_TOKEN: envalid.bool({ default: false })
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
    DEPLOY_REWARDABLE_TOKEN: envalid.bool({ default: false }),
    ERC20_EXTENDED_BY_ERC677: envalid.bool({ default: false }),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator()
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
    }),
    FOREIGN_MIN_AMOUNT_PER_TX: bigNumValidator(),
    DEPLOY_INTEREST_RECEIVER: envalid.bool({ default: false })
  }

  if (DEPLOY_INTEREST_RECEIVER === 'true') {
    validations = {
      ...validations,
      FOREIGN_INTEREST_RECEIVER_OWNER: addressValidator()
    }
  }
}

if (BRIDGE_MODE === 'AMB_ERC_TO_NATIVE') {
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
}

if (env.BRIDGE_MODE === 'NATIVE_TO_ERC') {
  checkGasPrices(env.HOME_GAS_PRICE, homePrefix)
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)
  if (env.FOREIGN_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(`FOREIGN_REWARDABLE: ${env.FOREIGN_REWARDABLE} is not supported on ${env.BRIDGE_MODE} bridge mode`)
  }

  if (env.HOME_REWARDABLE === 'BOTH_DIRECTIONS' && env.FOREIGN_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Combination of HOME_REWARDABLE: ${env.HOME_REWARDABLE} and FOREIGN_REWARDABLE: ${env.FOREIGN_REWARDABLE} should be avoided on ${env.BRIDGE_MODE} bridge mode.`
    )
  }
}

if (env.BRIDGE_MODE === 'ERC_TO_ERC') {
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)

  if (env.HOME_REWARDABLE === 'BOTH_DIRECTIONS' && env.BLOCK_REWARD_ADDRESS === ZERO_ADDRESS) {
    throw new Error(
      'Collecting fees on Home Network on ERC_TO_ERC mode without Block Reward contract is not supported.'
    )
  }

  if (env.FOREIGN_REWARDABLE !== 'false') {
    throw new Error(`Collecting fees on Foreign Network on ${env.BRIDGE_MODE} bridge mode is not supported.`)
  }
}

if (env.BRIDGE_MODE === 'ERC_TO_NATIVE') {
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)

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

if (
  env.BRIDGE_MODE === 'AMB_ERC_TO_ERC' ||
  env.BRIDGE_MODE === 'STAKE_AMB_ERC_TO_ERC' ||
  env.BRIDGE_MODE === 'AMB_ERC_TO_NATIVE' ||
  env.BRIDGE_MODE === 'MULTI_AMB_ERC_TO_ERC'
) {
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)
}

if (env.BRIDGE_MODE === 'AMB_NATIVE_TO_ERC') {
  checkLimits(env.FOREIGN_MIN_AMOUNT_PER_TX, env.FOREIGN_MAX_AMOUNT_PER_TX, env.FOREIGN_DAILY_LIMIT, foreignPrefix)
  if (env.FOREIGN_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(`FOREIGN_REWARDABLE: ${env.FOREIGN_REWARDABLE} is not supported on ${env.BRIDGE_MODE} bridge mode`)
  }

  if (env.HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    throw new Error(`HOME_REWARDABLE: ${env.HOME_REWARDABLE} is not supported on ${env.BRIDGE_MODE} bridge mode.`)
  }
}

if (env.BRIDGE_MODE === 'AMB_ERC_TO_NATIVE') {
  if (HOME_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Only BOTH_DIRECTIONS is supported for collecting fees on Home Network on ${BRIDGE_MODE} bridge mode.`
    )
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(`Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`)
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    validations = {
      ...validations,
      HOME_MEDIATOR_REWARD_ACCOUNTS: addressesValidator()
    }
  }
}

if (env.BRIDGE_MODE === 'MULTI_AMB_ERC_TO_ERC') {
  if (HOME_REWARDABLE === 'ONE_DIRECTION') {
    throw new Error(
      `Only BOTH_DIRECTIONS is supported for collecting fees on Home Network on ${BRIDGE_MODE} bridge mode.`
    )
  }

  if (FOREIGN_REWARDABLE !== 'false') {
    throw new Error(`Collecting fees on Foreign Network on ${BRIDGE_MODE} bridge mode is not supported.`)
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    validations = {
      ...validations,
      HOME_MEDIATOR_REWARD_ACCOUNTS: addressesValidator()
    }
  }
  validations = {
    ...validations,
    HOME_AMB_BRIDGE: addressValidator(),
    FOREIGN_AMB_BRIDGE: addressValidator(),
    HOME_MEDIATOR_REQUEST_GAS_LIMIT: bigNumValidator(),
    FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT: bigNumValidator(),
    HOME_ERC677_TOKEN_IMAGE: optionalAddressValidator()
  }
}

module.exports = env
