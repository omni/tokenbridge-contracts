const { web3Foreign } = require('../web3')
const { DEPLOY_REWARDABLE_TOKEN, DPOS_STAKING_ADDRESS } = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  if (DEPLOY_REWARDABLE_TOKEN) {
    const isDPOSStakingAContract = await isContract(web3Foreign, DPOS_STAKING_ADDRESS)
    if (!isDPOSStakingAContract) {
      throw new Error(`DPOS_STAKING_ADDRESS should be a contract address`)
    }
  }
}

module.exports = preDeploy
