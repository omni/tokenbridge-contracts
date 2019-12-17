require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../abi/multiSigwallet')
const proxyAbi = require('../../build/contracts/EternalStorageProxy').abi
const foreignBridgeAbi = require('../../build/contracts/ForeignBridgeErcToNative').abi
const confirmTransaction = require('./confirmTransaction')
const validatorState = require('./validatorState')

const migrationMethodAbi = [
  {
    constant: false,
    inputs: [],
    name: 'upgradeToV230',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

const {
  FOREIGN_PRIVKEY,
  FOREIGN_RPC_URL,
  FOREING_BRIDGE_ADDRESS,
  ROLE,
  FOREIGN_START_BLOCK,
  FOREIGN_GAS_PRICE,
  NEW_IMPLEMENTATION_ETH_VALIDATORS
} = process.env

const web3 = new Web3(new Web3.providers.HttpProvider(FOREIGN_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(FOREIGN_PRIVKEY)

const bridge = new web3.eth.Contract(foreignBridgeAbi, FOREING_BRIDGE_ADDRESS)

const upgradeValidatorsOnForeign = async () => {
  try {
    await validatorState(web3, address)

    const validatorsAddress = await bridge.methods.validatorContract().call()

    const proxy = new web3.eth.Contract(proxyAbi, validatorsAddress)
    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()

    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    const validatorContract = new web3.eth.Contract(migrationMethodAbi, validatorsAddress)
    const upgradeData = validatorContract.methods.upgradeToV230().encodeABI()

    const data = proxy.methods.upgradeToAndCall('2', NEW_IMPLEMENTATION_ETH_VALIDATORS, upgradeData).encodeABI()

    if (ROLE === 'leader') {
      const gas = await multiSigWallet.methods
        .submitTransaction(validatorsAddress, 0, data)
        .estimateGas({ from: address })
      const receipt = await multiSigWallet.methods
        .submitTransaction(validatorsAddress, 0, data)
        .send({ from: address, gas, gasPrice: FOREIGN_GAS_PRICE })
      console.log(receipt)
    } else {
      await confirmTransaction({
        fromBlock: FOREIGN_START_BLOCK,
        contract: multiSigWallet,
        destination: validatorsAddress,
        data,
        address,
        gasPrice: FOREIGN_GAS_PRICE
      })
    }
  } catch (e) {
    console.log(e.message)
  }
}

upgradeValidatorsOnForeign()
