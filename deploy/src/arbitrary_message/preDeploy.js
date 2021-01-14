const { web3Home, web3Foreign } = require('../web3')

async function preDeploy() {
  const homeChainId = await web3Home.eth.getChainId()
  const foreignChainId = await web3Foreign.eth.getChainId()

  if (homeChainId === foreignChainId) {
    throw new Error(
      `Chain ids on Home and Foreign networks should be different. Got the same value of ${homeChainId} on both networks instead.`
    )
  }
}

module.exports = preDeploy
