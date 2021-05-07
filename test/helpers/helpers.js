const { expect } = require('chai')
const { BN } = require('../setup')

// returns a Promise that resolves with a hex string that is the signature of
// `data` signed with the key of `address`
function sign(address, data) {
  return new Promise((resolve, reject) => {
    web3.eth.sign(data, address, (err, result) => {
      if (err !== null) {
        return reject(err)
      }
      return resolve(normalizeSignature(result))
      // return resolve(result);
    })
  })
}
module.exports.sign = sign

// geth && testrpc has different output of eth_sign than parity
// https://github.com/ethereumjs/testrpc/issues/243#issuecomment-326750236
function normalizeSignature(rawSignature) {
  const signature = strip0x(rawSignature)

  // increase v by 27...
  return `0x${signature.substr(0, 128)}${(parseInt(signature.substr(128), 16) + 27).toString(16)}`
}
module.exports.normalizeSignature = normalizeSignature

// strips leading "0x" if present
function strip0x(input) {
  return input.replace(/^0x/, '')
}
module.exports.strip0x = strip0x

// extracts and returns the `v`, `r` and `s` values from a `signature`.
function signatureToVRS(rawSignature) {
  assert.equal(rawSignature.length, 2 + 32 * 2 + 32 * 2 + 2)
  const signature = strip0x(rawSignature)
  const v = signature.substr(64 * 2)
  const r = signature.substr(0, 32 * 2)
  const s = signature.substr(32 * 2, 32 * 2)
  return { v, r, s }
}
module.exports.signatureToVRS = signatureToVRS

function packSignatures(array) {
  const length = strip0x(web3.utils.toHex(array.length))
  const msgLength = length.length === 1 ? `0${length}` : length
  let v = ''
  let r = ''
  let s = ''
  array.forEach(e => {
    v = v.concat(e.v)
    r = r.concat(e.r)
    s = s.concat(e.s)
  })
  return `0x${msgLength}${v}${r}${s}`
}
module.exports.packSignatures = packSignatures

// returns BigNumber `num` converted to a little endian hex string
// that is exactly 32 bytes long.
// `num` must represent an unsigned integer
function bigNumberToPaddedBytes32(num) {
  let result = strip0x(num.toString(16))
  while (result.length < 64) {
    result = `0${result}`
  }
  return `0x${result}`
}
module.exports.bigNumberToPaddedBytes32 = bigNumberToPaddedBytes32

// returns an promise that resolves to an object
// that maps `addresses` to their current balances
function getBalances(addresses) {
  return Promise.all(
    addresses.map(address => {
      return web3.eth.getBalance(address)
    })
  ).then(balancesArray => {
    const addressToBalance = {}
    addresses.forEach((address, index) => {
      addressToBalance[address] = balancesArray[index]
    })
    return addressToBalance
  })
}
module.exports.getBalances = getBalances

// returns hex string of the bytes of the message
// composed from `recipient`, `value` and `transactionHash`
// that is relayed from `foreign` to `home` on withdraw
function createMessage(rawRecipient, rawValue, rawTransactionHash, rawContractAddress) {
  const recipient = strip0x(rawRecipient)
  assert.equal(recipient.length, 20 * 2)

  const value = strip0x(bigNumberToPaddedBytes32(rawValue))
  assert.equal(value.length, 64)

  const transactionHash = strip0x(rawTransactionHash)
  assert.equal(transactionHash.length, 32 * 2)

  const contractAddress = strip0x(rawContractAddress)
  assert.equal(contractAddress.length, 20 * 2)

  const message = `0x${recipient}${value}${transactionHash}${contractAddress}`
  const expectedMessageLength = (20 + 32 + 32 + 20) * 2 + 2
  assert.equal(message.length, expectedMessageLength)
  return message
}
module.exports.createMessage = createMessage

// returns array of integers progressing from `start` up to, but not including, `end`
function range(start, end) {
  const result = []
  for (let i = start; i < end; i++) {
    result.push(i)
  }
  return result
}
module.exports.range = range

// just used to signal/document that we're explicitely ignoring/expecting an error
function ignoreExpectedError() {}
module.exports.ignoreExpectedError = ignoreExpectedError

const getEvents = (truffleInstance, filter, fromBlock = 0, toBlock = 'latest') =>
  truffleInstance.contract.getPastEvents(filter.event, { fromBlock, toBlock })

module.exports.getEvents = getEvents

function ether(n) {
  return new BN(web3.utils.toWei(n, 'ether'))
}

module.exports.ether = ether

function expectEventInLogs(logs, eventName, eventArgs = {}) {
  const events = logs.filter(e => e.event === eventName)
  expect(events.length > 0).to.equal(true, `There is no '${eventName}'`)

  const exception = []
  const event = events.find(e => {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v)
      } catch (error) {
        exception.push(error)
        return false
      }
    }
    return true
  })

  if (event === undefined) {
    throw exception[0]
  }

  return event
}

function contains(args, key, value) {
  expect(key in args).to.equal(true, `Unknown event argument '${key}'`)

  if (value === null) {
    expect(args[key]).to.equal(null)
  } else if (isBN(args[key])) {
    expect(args[key]).to.be.bignumber.equal(value)
  } else {
    expect(args[key]).to.be.equal(value)
  }
}

function isBN(object) {
  return BN.isBN(object) || object instanceof BN
}

module.exports.expectEventInLogs = expectEventInLogs

function createAccounts(web3, amount) {
  const array = []
  for (let i = 0; i < amount; i++) {
    array[i] = web3.eth.accounts.create().address
  }
  return array
}

module.exports.createAccounts = createAccounts

function createFullAccounts(web3, amount) {
  const array = []
  for (let i = 0; i < amount; i++) {
    array[i] = web3.eth.accounts.create()
  }
  return array
}

module.exports.createFullAccounts = createFullAccounts

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms))
}

module.exports.delay = delay

async function evalMetrics(target, ...metrics) {
  const before = await Promise.all(metrics.map(metric => metric()))
  await target()
  const after = await Promise.all(metrics.map(metric => metric()))
  return [...before, ...after]
}

module.exports.evalMetrics = evalMetrics

function paymasterError(reason) {
  return `paymaster rejected in local view call to 'relayCall()' : ${reason}`
}

module.exports.paymasterError = paymasterError
