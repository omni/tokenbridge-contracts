const BigNumber = require('bignumber.js')
const Web3 = require('web3')
const Tx = require('ethereumjs-tx')
const Web3Utils = require('web3-utils')
const fetch = require('node-fetch')
const assert = require('assert')
const {
  web3Home,
  web3Foreign,
  deploymentPrivateKey,
  FOREIGN_RPC_URL,
  HOME_RPC_URL,
  GAS_LIMIT_EXTRA,
  HOME_DEPLOYMENT_GAS_PRICE,
  FOREIGN_DEPLOYMENT_GAS_PRICE,
  GET_RECEIPT_INTERVAL_IN_MILLISECONDS
} = require('./web3')

async function deployContract(contractJson, args, { from, network, nonce }) {
  let web3
  let url
  let gasPrice
  if (network === 'foreign') {
    web3 = web3Foreign
    url = FOREIGN_RPC_URL
    gasPrice = FOREIGN_DEPLOYMENT_GAS_PRICE
  } else {
    web3 = web3Home
    url = HOME_RPC_URL
    gasPrice = HOME_DEPLOYMENT_GAS_PRICE
  }
  const options = {
    from
  }
  const instance = new web3.eth.Contract(contractJson.abi, options)
  const result = await instance
    .deploy({
      data: contractJson.bytecode,
      arguments: args
    })
    .encodeABI()
  const tx = await sendRawTx({
    data: result,
    nonce: Web3Utils.toHex(nonce),
    to: null,
    privateKey: deploymentPrivateKey,
    url,
    gasPrice
  })
  if (Web3Utils.hexToNumber(tx.status) !== 1) {
    throw new Error('Tx failed')
  }
  instance.options.address = tx.contractAddress
  instance.deployedBlockNumber = tx.blockNumber
  return instance
}

async function sendRawTxHome(options) {
  return sendRawTx({
    ...options,
    gasPrice: HOME_DEPLOYMENT_GAS_PRICE
  })
}

async function sendRawTxForeign(options) {
  return sendRawTx({
    ...options,
    gasPrice: FOREIGN_DEPLOYMENT_GAS_PRICE
  })
}

async function sendRawTx({ data, nonce, to, privateKey, url, gasPrice, value }) {
  try {
    const  txToEstimateGas = {
        from: privateKeyToAddress(Web3Utils.bytesToHex(privateKey)),
        value: value,
        to,
        data
    }
    const estimatedGas = BigNumber(await sendNodeRequest(url, 'eth_estimateGas', txToEstimateGas))
    
    const blockData = await sendNodeRequest(url, 'eth_getBlockByNumber', ["latest", false])
    const blockGasLimit = BigNumber(blockData.gasLimit)
    if (estimatedGas.isGreaterThan(blockGasLimit)) {
      throw new Error(`estimated gas greater (${estimatedGas.toString()}) than the block gas limit (${blockGasLimit.toString()})`)
    }
    let gas = estimatedGas.multipliedBy(BigNumber(1 + GAS_LIMIT_EXTRA))
    if (gas.isGreaterThan(blockGasLimit)) {
      gas = blockGasLimit
    } else {
      gas = gas.toFixed(0)
    }

    const rawTx = {
      nonce,
      gasPrice: Web3Utils.toHex(gasPrice),
      gasLimit: Web3Utils.toHex(gas),
      to,
      data,
      value
    }

    const tx = new Tx(rawTx)
    tx.sign(privateKey)
    const serializedTx = tx.serialize()
    const txHash = await sendNodeRequest(
      url,
      'eth_sendRawTransaction',
      `0x${serializedTx.toString('hex')}`
    )
    console.log('pending txHash', txHash)
    const receipt = await getReceipt(txHash, url)
    return receipt
  } catch (e) {
    console.error(e)
  }
}

async function sendNodeRequest(url, method, signedData) {
  if (! Array.isArray(signedData)) {
    signedData = [signedData]
  }
  const request = await fetch(url, {
    headers: {
      'Content-type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: signedData,
      id: 1
    })
  })
  const json = await request.json()
  if (typeof json.error === 'undefined' || json.error === null) {
  if (method === 'eth_sendRawTransaction') {
    assert.strictEqual(json.result.length, 66, `Tx wasn't sent ${json}`)
  }
  return json.result
  } else {
    throw new Error(`web3 RPC failed: ${JSON.stringify(json.error)}`)
  }
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getReceipt(txHash, url) {
  await timeout(GET_RECEIPT_INTERVAL_IN_MILLISECONDS)
  let receipt = await sendNodeRequest(url, 'eth_getTransactionReceipt', txHash)
  if (receipt === null || receipt.blockNumber === null) {
    receipt = await getReceipt(txHash, url)
  }
  return receipt
}

function add0xPrefix(s) {
  if (s.indexOf('0x') === 0) {
    return s
  }

  return `0x${s}`
}

function privateKeyToAddress(privateKey) {
  return new Web3().eth.accounts.privateKeyToAccount(add0xPrefix(privateKey)).address
}

module.exports = {
  deployContract,
  sendNodeRequest,
  getReceipt,
  sendRawTx,
  sendRawTxHome,
  sendRawTxForeign,
  privateKeyToAddress
}
