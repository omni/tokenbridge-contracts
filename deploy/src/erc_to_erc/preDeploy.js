const { web3Foreign } = require('../web3')
const { ERC20_TOKEN_ADDRESS, ERC20_EXTENDED_BY_ERC677 } = require('../loadEnv')
const { abi } = require('../../../build/contracts/ERC677BridgeToken.json')

async function preDeploy() {
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
