const { web3Home, web3Foreign } = require('../web3')
const {
  HOME_AMB_BRIDGE,
  FOREIGN_AMB_BRIDGE,
  FOREIGN_ENS_REGISTRY_ADDRESS
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

  const isENSRegistry = await isContract(web3Foreign, FOREIGN_ENS_REGISTRY_ADDRESS)
  if (!isENSRegistry) {
    throw new Error(`FOREIGN_ENS_REGISTRY_ADDRESS should be a contract address`)
  }
}

module.exports = preDeploy
