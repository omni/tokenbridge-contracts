require('dotenv').config()
const Web3 = require('web3')
const multiSigWalletAbi = require('../abi/multiSigwallet')
const proxyAbi = require('../../build/contracts/EternalStorageProxy').abi
const foreignBridgeAbi = require('../../build/contracts/ForeignBridgeErcToNative').abi
const confirmTransaction = require('./confirmTransaction')
const validatorState = require('./validatorState')

const {
  FOREIGN_PRIVKEY,
  FOREIGN_RPC_URL,
  FOREING_BRIDGE_ADDRESS,
  ROLE,
  FOREIGN_START_BLOCK,
  FOREIGN_GAS_PRICE
} = process.env

const web3 = new Web3(new Web3.providers.HttpProvider(FOREIGN_RPC_URL))
const { address } = web3.eth.accounts.wallet.add(FOREIGN_PRIVKEY)

const migrateToMCD = async () => {
  try {
    const proxy = new web3.eth.Contract(proxyAbi, FOREING_BRIDGE_ADDRESS)
    const bridge = new web3.eth.Contract(foreignBridgeAbi, FOREING_BRIDGE_ADDRESS)

    const ownerAddress = await proxy.methods.upgradeabilityOwner().call()
    const multiSigWallet = new web3.eth.Contract(multiSigWalletAbi, ownerAddress)

    await validatorState(web3, address, multiSigWallet)

    const data = bridge.methods.migrateToMCD().encodeABI()

    if (ROLE === 'leader') {
      const gas = await multiSigWallet.methods
        .submitTransaction(FOREING_BRIDGE_ADDRESS, 0, data)
        .estimateGas({ from: address })
      const receipt = await multiSigWallet.methods
        .submitTransaction(FOREING_BRIDGE_ADDRESS, 0, data)
        .send({ from: address, gas, gasPrice: FOREIGN_GAS_PRICE })
      console.log(`Submission status: ${receipt.status} - Tx Hash: ${receipt.transactionHash}`)
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

migrateToMCD()
