const { web3Home, web3Foreign } = require('../web3')
const {
  HOME_STAKE_TOKEN_ADDRESS,
  FOREIGN_STAKE_TOKEN_ADDRESS,
  HOME_AMB_BRIDGE,
  FOREIGN_AMB_BRIDGE,
  BLOCK_REWARD_ADDRESS
} = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  const isHomeStakeTokenAContract = await isContract(web3Home, HOME_STAKE_TOKEN_ADDRESS)
  if (!isHomeStakeTokenAContract) {
    throw new Error(`HOME_STAKE_TOKEN_ADDRESS should be a contract address`)
  }

  const isForeignStakeTokenAContract = await isContract(web3Foreign, FOREIGN_STAKE_TOKEN_ADDRESS)
  if (!isForeignStakeTokenAContract) {
    throw new Error(`FOREIGN_STAKE_TOKEN_ADDRESS should be a contract address`)
  }

  const isHomeAMBAContract = await isContract(web3Home, HOME_AMB_BRIDGE)
  if (!isHomeAMBAContract) {
    throw new Error(`HOME_AMB_BRIDGE should be a contract address`)
  }

  const isForeignAMBAContract = await isContract(web3Foreign, FOREIGN_AMB_BRIDGE)
  if (!isForeignAMBAContract) {
    throw new Error(`FOREIGN_AMB_BRIDGE should be a contract address`)
  }

  const isBlockRewardAContract = await isContract(web3Home, BLOCK_REWARD_ADDRESS)
  if (!isBlockRewardAContract) {
    throw new Error(`BLOCK_REWARD_ADDRESS should be a contract address`)
  }
}

module.exports = preDeploy
