require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../abi/multiSigwallet')
const proxyAbi = require('../../build/contracts/EternalStorageProxy').abi
const callMultiSigWallet = require('./utils/callMultiSigWallet')
const validatorState = require('./utils/validatorState')

const {
  HOME_PRIVKEY,
  HOME_RPC_URL,
  HOME_BRIDGE_ADDRESS,
  ROLE,
  HOME_START_BLOCK,
  HOME_GAS_PRICE,
  NEW_IMPLEMENTATION_XDAI_BRIDGE
} = process.env

const migrationMethodAbi = [
  {
    constant: false,
    inputs: [],
    name: 'prepareToPOSDAO',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

const web3 = new Web3(new Web3.providers.HttpProvider(HOME_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(HOME_PRIVKEY)

const upgradeBridgeOnHome = async () => {
  try {
    const proxy = new web3.eth.Contract(proxyAbi, HOME_BRIDGE_ADDRESS)
    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()
    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    await validatorState(web3, address, multiSigWallet)

    const bridge = new web3.eth.Contract(migrationMethodAbi, HOME_BRIDGE_ADDRESS)
    const upgradeData = bridge.methods.prepareToPOSDAO().encodeABI()

    const data = proxy.methods.upgradeToAndCall('4', NEW_IMPLEMENTATION_XDAI_BRIDGE, upgradeData).encodeABI()

    await callMultiSigWallet({
      role: ROLE,
      contract: multiSigWallet,
      destination: HOME_BRIDGE_ADDRESS,
      fromBlock: HOME_START_BLOCK,
      gasPrice: HOME_GAS_PRICE,
      address,
      data
    })
  } catch (e) {
    console.log(e.message)
  }
}

upgradeBridgeOnHome()
