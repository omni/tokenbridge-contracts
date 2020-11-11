const { web3Home, web3Foreign } = require('../web3')
const {
  HOME_AMB_BRIDGE,
  FOREIGN_AMB_BRIDGE,
  HOME_ERC677_TOKEN_IMAGE,
  HOME_TOKEN_FACTORY,
  HOME_FORWARDING_RULES_MANAGER
} = require('../loadEnv')
const { isContract } = require('../deploymentUtils')

async function preDeploy() {
  const isHomeAMBAContract = await isContract(web3Home, HOME_AMB_BRIDGE)
  if (!isHomeAMBAContract) {
    throw new Error(`HOME_AMB_BRIDGE should be a contract address`)
  }

  const isForeignAMBAContract = await isContract(web3Foreign, FOREIGN_AMB_BRIDGE)
  if (!isForeignAMBAContract) {
    throw new Error(`FOREIGN_AMB_BRIDGE should be a contract address`)
  }

  if (HOME_ERC677_TOKEN_IMAGE) {
    if (!(await isContract(web3Home, HOME_ERC677_TOKEN_IMAGE))) {
      throw new Error(`HOME_ERC677_TOKEN_IMAGE should be a contract address`)
    }
  }

  if (HOME_TOKEN_FACTORY) {
    if (!(await isContract(web3Home, HOME_TOKEN_FACTORY))) {
      throw new Error(`HOME_TOKEN_FACTORY should be a contract address`)
    }
  }

  if (HOME_FORWARDING_RULES_MANAGER) {
    if (!(await isContract(web3Home, HOME_FORWARDING_RULES_MANAGER))) {
      throw new Error(`HOME_FORWARDING_RULES_MANAGER should be a contract address`)
    }
  }
}

module.exports = preDeploy
