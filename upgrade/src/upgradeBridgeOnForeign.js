require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../abi/multiSigwallet')
const proxyAbi = require('../../build/contracts/EternalStorageProxy').abi
const confirmTransaction = require('./confirmTransaction')
const validatorState = require('./validatorState')

const {
  FOREIGN_PRIVKEY,
  FOREIGN_RPC_URL,
  FOREING_BRIDGE_ADDRESS,
  ROLE,
  FOREIGN_START_BLOCK,
  FOREIGN_GAS_PRICE,
  NEW_IMPLEMENTATION_ETH_BRIDGE
} = process.env

const migrationMethodAbi = [
  {
    constant: false,
    inputs: [],
    name: 'upgradeToV250',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

const web3 = new Web3(new Web3.providers.HttpProvider(FOREIGN_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(FOREIGN_PRIVKEY)

const upgradeBridgeOnForeign = async () => {
  try {
    await validatorState(web3, address)

    const proxy = new web3.eth.Contract(proxyAbi, FOREING_BRIDGE_ADDRESS)
    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()
    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    const bridge = new web3.eth.Contract(migrationMethodAbi, FOREING_BRIDGE_ADDRESS)
    const upgradeData = bridge.methods.upgradeToV250().encodeABI()
    const data = proxy.methods.upgradeToAndCall('3', NEW_IMPLEMENTATION_ETH_BRIDGE, upgradeData).encodeABI()

    if (ROLE === 'leader') {
      const gas = await multiSigWallet.methods.submitTransaction(FOREING_BRIDGE_ADDRESS, 0, data).estimateGas({
        from: address
      })
      const receipt = await multiSigWallet.methods
        .submitTransaction(FOREING_BRIDGE_ADDRESS, 0, data)
        .send({ from: address, gas, gasPrice: FOREIGN_GAS_PRICE })
      console.log(receipt)
    } else {
      await confirmTransaction({
        fromBlock: FOREIGN_START_BLOCK,
        contract: multiSigWallet,
        destination: FOREING_BRIDGE_ADDRESS,
        data,
        address,
        gasPrice: FOREIGN_GAS_PRICE
      })
    }
  } catch (e) {
    console.log(e.message)
  }
}

upgradeBridgeOnForeign()
