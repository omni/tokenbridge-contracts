require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../../abi/multiSigwallet')
const proxyAbi = require('../../../build/contracts/EternalStorageProxy').abi
const foreignBridgeAbi = require('../../../build/contracts/ForeignBridgeErcToNative').abi
const callMultiSigWallet = require('../utils/callMultiSigWallet')
const validatorState = require('../utils/validatorState')

const {
  FOREIGN_PRIVKEY,
  FOREIGN_RPC_URL,
  FOREING_BRIDGE_ADDRESS,
  ROLE,
  FOREIGN_START_BLOCK,
  FOREIGN_GAS_PRICE,
  CHAI_INTEREST_RECEIVER
} = process.env

const web3 = new Web3(new Web3.providers.HttpProvider(FOREIGN_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(FOREIGN_PRIVKEY)

const initializeChai = async () => {
  try {
    const proxy = new web3.eth.Contract(proxyAbi, FOREING_BRIDGE_ADDRESS)
    const bridge = new web3.eth.Contract(foreignBridgeAbi, FOREING_BRIDGE_ADDRESS)

    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()
    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    await validatorState(web3, address, multiSigWallet)

    const data = bridge.methods.initializeChaiToken(CHAI_INTEREST_RECEIVER).encodeABI()

    await callMultiSigWallet({
      role: ROLE,
      contract: multiSigWallet,
      destination: FOREING_BRIDGE_ADDRESS,
      fromBlock: FOREIGN_START_BLOCK,
      gasPrice: FOREIGN_GAS_PRICE,
      address,
      data
    })
  } catch (e) {
    console.log(e.message)
  }
}

initializeChai()
