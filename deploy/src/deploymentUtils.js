const Web3 = require('web3')
const Tx = require('ethereumjs-tx')
const Web3Utils = require('web3-utils')
const fetch = require('node-fetch')
const assert = require('assert')
const promiseRetry = require('promise-retry')
const {
  web3Home,
  web3Foreign,
  deploymentPrivateKey,
  FOREIGN_RPC_URL,
  HOME_RPC_URL,
  GAS_LIMIT,
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
  if (Web3Utils.hexToNumber(tx.status) !== 1 && !tx.contractAddress) {
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
    const rawTx = {
      nonce,
      gasPrice: Web3Utils.toHex(gasPrice),
      gasLimit: Web3Utils.toHex(GAS_LIMIT),
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
    return await getReceipt(txHash, url)
  } catch (e) {
    console.error(e)
  }
}

async function sendNodeRequest(url, method, signedData) {
  const request = await fetch(url, {
    headers: {
      'Content-type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: [signedData],
      id: 1
    })
  })
  const json = await request.json()
  if (method === 'eth_sendRawTransaction') {
    assert.strictEqual(json.result.length, 66, `Tx wasn't sent ${json}`)
  }
  return json.result
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

function logValidatorsAndRewardAccounts(validators, rewards) {
  console.log(`VALIDATORS\n==========`)
  validators.forEach((validator, index) => {
    console.log(`${index + 1}: ${validator}, reward address ${rewards[index]}`)
  })
}

async function upgradeProxy({ proxy, implementationAddress, version, nonce, url }) {
  const data = await proxy.methods.upgradeTo(version, implementationAddress).encodeABI()
  const result = await sendRawTxHome({
    data,
    nonce,
    to: proxy.options.address,
    privateKey: deploymentPrivateKey,
    url
  })
  if (result.status) {
    assert.strictEqual(Web3Utils.hexToNumber(result.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(proxy.methods.implementation().call, implementationAddress)
  }
}

async function transferProxyOwnership({ proxy, newOwner, nonce, url }) {
  const data = await proxy.methods.transferProxyOwnership(newOwner).encodeABI()
  const result = await sendRawTxHome({
    data,
    nonce,
    to: proxy.options.address,
    privateKey: deploymentPrivateKey,
    url
  })
  if (result.status) {
    assert.strictEqual(Web3Utils.hexToNumber(result.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(proxy.methods.proxyOwner().call, newOwner)
  }
}

async function transferOwnership({ contract, newOwner, nonce, url }) {
  const data = await contract.methods.transferOwnership(newOwner).encodeABI()
  const result = await sendRawTxForeign({
    data,
    nonce,
    to: contract.options.address,
    privateKey: deploymentPrivateKey,
    url
  })
  if (result.status) {
    assert.strictEqual(Web3Utils.hexToNumber(result.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.owner().call, newOwner)
  }
}

async function setBridgeContract({ contract, bridgeAddress, nonce, url }) {
  const data = await contract.methods.setBridgeContract(bridgeAddress).encodeABI()
  const result = await sendRawTxForeign({
    data,
    nonce,
    to: contract.options.address,
    privateKey: deploymentPrivateKey,
    url
  })
  if (result.status) {
    assert.strictEqual(Web3Utils.hexToNumber(result.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.bridgeContract().call, bridgeAddress)
  }
}

async function initializeValidators({
  contract,
  isRewardableBridge,
  requiredNumber,
  validators,
  rewardAccounts,
  owner,
  nonce,
  url
}) {
  let data

  if (isRewardableBridge) {
    console.log(`REQUIRED_NUMBER_OF_VALIDATORS: ${requiredNumber}, HOME_VALIDATORS_OWNER: ${owner}`)
    logValidatorsAndRewardAccounts(validators, rewardAccounts)
    data = await contract.methods
      .initialize(requiredNumber, validators, rewardAccounts, owner)
      .encodeABI()
  } else {
    console.log(
      `REQUIRED_NUMBER_OF_VALIDATORS: ${requiredNumber}, VALIDATORS: ${validators}, HOME_VALIDATORS_OWNER: ${owner}`
    )
    data = await contract.methods.initialize(requiredNumber, validators, owner).encodeABI()
  }

  const result = await sendRawTxHome({
    data,
    nonce,
    to: contract.options.address,
    privateKey: deploymentPrivateKey,
    url
  })
  if (result.status) {
    assert.strictEqual(Web3Utils.hexToNumber(result.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
}

async function assertStateWithRetry(fn, expected) {
  return promiseRetry(async retry => {
    const value = await fn()
    if (value !== expected) {
      retry(`Transaction Failed. Expected: ${expected} Actual: ${value}`)
    }
  })
}

module.exports = {
  deployContract,
  sendRawTxHome,
  sendRawTxForeign,
  privateKeyToAddress,
  logValidatorsAndRewardAccounts,
  upgradeProxy,
  initializeValidators,
  transferProxyOwnership,
  transferOwnership,
  setBridgeContract,
  assertStateWithRetry
}
