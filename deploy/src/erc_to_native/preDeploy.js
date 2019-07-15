const { web3Foreign } = require('../web3')
const { ERC20_TOKEN_ADDRESS } = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  const isERC20AContract = await isContract(web3Foreign, ERC20_TOKEN_ADDRESS)
  if (!isERC20AContract) {
    throw new Error(`ERC20_TOKEN_ADDRESS should be a contract address`)
  }
}

module.exports = preDeploy
