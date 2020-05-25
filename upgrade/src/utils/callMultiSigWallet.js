const { toBN } = require('web3').utils

const confirmTransaction = async ({ contract, fromBlock = 0, destination, data, address, gasPrice }) => {
  const submissions = await contract.getPastEvents('Submission', { fromBlock, toBlock: 'latest' })

  if (!submissions.length) {
    throw new Error('No submissions found.')
  }
  const filteredSubmission = []
  await Promise.all(
    submissions.map(async s => {
      const { transactionId } = s.returnValues
      const transaction = await contract.methods.transactions(transactionId).call()
      if (transaction.destination === destination && transaction.data === data) {
        if (!transaction.executed) {
          console.log(
            `Found a transaction to confirm. Id: ${transactionId}, Block: ${s.blockNumber}, Data: ${transaction.data}`
          )
          filteredSubmission.push(s)
          return
        }
        console.log(
          `Found a transaction that was already executed. Id: ${transactionId}, Block: ${s.blockNumber}, Data: ${transaction.data}`
        )
      }
    })
  )

  if (filteredSubmission.length > 1) {
    throw new Error('More than one transaction found.')
  } else if (filteredSubmission.length === 0) {
    throw new Error('No transaction to confirm.')
  }
  const { transactionId } = filteredSubmission[0].returnValues
  const estimatedGas = await contract.methods.confirmTransaction(transactionId).estimateGas({ from: address })
  const gas = addExtraGas(estimatedGas)

  const receipt = await contract.methods.confirmTransaction(transactionId).send({ from: address, gas, gasPrice })
  console.log(`Confirmation status: ${receipt.status} - Tx Hash: ${receipt.transactionHash}`)
}

function addExtraGas(initialGas) {
  const gas = toBN(initialGas)
  const extraPercentage = toBN(4)

  return gas.mul(extraPercentage)
}

const callMultiSigWallet = async ({ role, contract, destination, fromBlock, gasPrice, address, data }) => {
  if (role === 'leader') {
    const gas = await contract.methods.submitTransaction(destination, 0, data).estimateGas({ from: address })
    const receipt = await contract.methods
      .submitTransaction(destination, 0, data)
      .send({ from: address, gas: addExtraGas(gas), gasPrice })
    console.log(`Submission status: ${receipt.status} - Tx Hash: ${receipt.transactionHash}`)
  } else {
    await confirmTransaction({
      fromBlock,
      contract,
      destination,
      data,
      address,
      gasPrice
    })
  }
}

module.exports = callMultiSigWallet
