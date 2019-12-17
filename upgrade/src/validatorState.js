const { toBN } = require('web3').utils

const validatorState = async (web3, address) => {
  const balance = await web3.eth.getBalance(address)
  console.log(`Validator ${address} balance is ${balance}`)
  if (toBN(balance).isZero()) {
    throw new Error(`Validator ${address} balance is zero.`)
  }
}

module.exports = validatorState
