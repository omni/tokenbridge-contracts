require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../abi/multiSigwallet')
const proxyAbi = require('../../contracts/build/contracts/EternalStorageProxy').abi
const bridgeAbi = require('../../contracts/build/contracts/ForeignBridgeErcToNative').abi
const callMultiSigWallet = require('./utils/callMultiSigWallet')
const validatorState = require('./utils/validatorState')

const {
  FOREIGN_PRIVKEY,
  FOREIGN_RPC_URL,
  FOREIGN_BRIDGE_ADDRESS,
  ROLE,
  FOREIGN_START_BLOCK,
  FOREIGN_GAS_PRICE,
  NEW_IMPLEMENTATION_ETH_BRIDGE,
  SAI_TOKENS_RECEIVER
} = process.env

const web3 = new Web3(new Web3.providers.HttpProvider(FOREIGN_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(FOREIGN_PRIVKEY)

const upgradeBridgeOnForeign = async () => {
  try {
    const proxy = new web3.eth.Contract(proxyAbi, FOREIGN_BRIDGE_ADDRESS)
    const foreignBridge = new web3.eth.Contract(bridgeAbi, FOREIGN_BRIDGE_ADDRESS)
    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()
    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    await validatorState(web3, address, multiSigWallet)

    const fixData = foreignBridge.methods.fixLockedSai(SAI_TOKENS_RECEIVER).encodeABI()

    const data = proxy.methods.upgradeToAndCall('6', NEW_IMPLEMENTATION_ETH_BRIDGE, fixData).encodeABI()

    await callMultiSigWallet({
      role: ROLE,
      contract: multiSigWallet,
      destination: FOREIGN_BRIDGE_ADDRESS,
      fromBlock: FOREIGN_START_BLOCK,
      gasPrice: FOREIGN_GAS_PRICE,
      address,
      data
    })
  } catch (e) {
    console.log(e.message)
  }
}

upgradeBridgeOnForeign()
