const { web3Home, web3Foreign } = require('../web3')
const {
  ERC20_TOKEN_ADDRESS,
  ERC20_EXTENDED_BY_ERC677,
  HOME_REWARDABLE,
  BLOCK_REWARD_ADDRESS,
  DEPLOY_REWARDABLE_TOKEN,
  DPOS_STAKING_ADDRESS
} = require('../loadEnv')
const { isContract } = require('../deploymentUtils')
const {
  foreignContracts: {
    ERC677BridgeToken: { abi }
  }
} = require('../loadContracts')

async function preDeploy() {
  const isERC20AContract = await isContract(web3Foreign, ERC20_TOKEN_ADDRESS)
  if (!isERC20AContract) {
    throw new Error(`ERC20_TOKEN_ADDRESS should be a contract address`)
  }

  if (DEPLOY_REWARDABLE_TOKEN) {
    const isDPOSStakingAContract = await isContract(web3Foreign, DPOS_STAKING_ADDRESS)
    if (!isDPOSStakingAContract) {
      throw new Error(`DPOS_STAKING_ADDRESS should be a contract address`)
    }
  }

  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    const isBlockRewardAContract = await isContract(web3Home, BLOCK_REWARD_ADDRESS)
    if (!isBlockRewardAContract) {
      throw new Error(`BLOCK_REWARD_ADDRESS should be a contract address`)
    }
  }

  if (ERC20_EXTENDED_BY_ERC677) {
    const tokenContract = new web3Foreign.eth.Contract(abi, ERC20_TOKEN_ADDRESS)
    try {
      await tokenContract.methods.bridgeContract().call()
    } catch (e) {
      throw new Error(
        `ERC20_EXTENDED_BY_ERC677 is set to TRUE but bridgeContract method was not found on ERC677 token.`
      )
    }
  }
}

module.exports = preDeploy
