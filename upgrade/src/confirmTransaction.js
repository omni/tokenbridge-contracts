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

  const gas = await contract.methods.confirmTransaction(transactionId).estimateGas({ from: address })
  const receipt = await contract.methods.confirmTransaction(transactionId).send({ from: address, gas, gasPrice })
  console.log(`Confirmation status: ${receipt.status} - Tx Hash: ${receipt.transactionHash}`)
}

module.exports = confirmTransaction
