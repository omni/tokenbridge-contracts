const { toBN } = require('web3').utils

const validatorState = async (web3, address, multiSigWallet) => {
  const balance = await web3.eth.getBalance(address)
  console.log(`Validator ${address} balance is ${balance}`)
  if (toBN(balance).isZero()) {
    throw new Error(`Balance is zero.`)
  }

  const isOwner = await multiSigWallet.methods.isOwner(address).call()

  if (!isOwner) {
    throw new Error(`The validator is not part of the multisig wallet.`)
  }
}

module.exports = validatorState
