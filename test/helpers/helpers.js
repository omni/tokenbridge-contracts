const { BN } = require('../setup');
const { expect } = require('chai');

// returns a Promise that resolves with a hex string that is the signature of
// `data` signed with the key of `address`
function sign(address, data) {
  return new Promise(function(resolve, reject) {
    web3.eth.sign(data, address, function(err, result) {
      if (err !== null) {
        return reject(err);
      } else {
        return resolve(normalizeSignature(result));
        //return resolve(result);
      }
    })
  })
}
module.exports.sign = sign;

// geth && testrpc has different output of eth_sign than parity
// https://github.com/ethereumjs/testrpc/issues/243#issuecomment-326750236
function normalizeSignature(signature) {
  signature = strip0x(signature);

  // increase v by 27...
  return "0x" + signature.substr(0, 128) + (parseInt(signature.substr(128), 16) + 27).toString(16);
}
module.exports.normalizeSignature = normalizeSignature;

// strips leading "0x" if present
function strip0x(input) {
  return input.replace(/^0x/, "");
}
module.exports.strip0x = strip0x;

// extracts and returns the `v`, `r` and `s` values from a `signature`.
// all inputs and outputs are hex strings with leading '0x'.
function signatureToVRS(signature) {
  assert.equal(signature.length, 2 + 32 * 2 + 32 * 2 + 2);
  signature = strip0x(signature);
  var v = parseInt(signature.substr(64 * 2), 16);
  var r = "0x" + signature.substr(0, 32 * 2);
  var s = "0x" + signature.substr(32 * 2, 32 * 2);
  return {v: v, r: r, s: s};
}
module.exports.signatureToVRS = signatureToVRS;

// returns BigNumber `num` converted to a little endian hex string
// that is exactly 32 bytes long.
// `num` must represent an unsigned integer
function bigNumberToPaddedBytes32(num) {
  var result = strip0x(num.toString(16));
  while (result.length < 64) {
    result = "0" + result;
  }
  return "0x" + result;
}
module.exports.bigNumberToPaddedBytes32 = bigNumberToPaddedBytes32;

// returns an promise that resolves to an object
// that maps `addresses` to their current balances
function getBalances(addresses) {
  return Promise.all(addresses.map(function(address) {
    return web3.eth.getBalance(address);
  })).then(function(balancesArray) {
    let addressToBalance = {};
    addresses.forEach(function(address, index) {
      addressToBalance[address] = balancesArray[index];
    });
    return addressToBalance;
  })
}
module.exports.getBalances = getBalances;


// returns hex string of the bytes of the message
// composed from `recipient`, `value` and `transactionHash`
// that is relayed from `foreign` to `home` on withdraw
function createMessage(recipient, value, transactionHash, contractAddress) {
  recipient = strip0x(recipient);
  assert.equal(recipient.length, 20 * 2);

  var value = strip0x(bigNumberToPaddedBytes32(value));
  assert.equal(value.length, 64);

  transactionHash = strip0x(transactionHash);
  assert.equal(transactionHash.length, 32 * 2);

  contractAddress = strip0x(contractAddress);
  assert.equal(contractAddress.length, 20 * 2);

  var message = "0x" + recipient + value + transactionHash + contractAddress;
  var expectedMessageLength = (20 + 32 + 32 + 20) * 2 + 2;
  assert.equal(message.length, expectedMessageLength);
  return message;
}
module.exports.createMessage = createMessage;

// returns array of integers progressing from `start` up to, but not including, `end`
function range(start, end) {
  var result = [];
  for (var i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}
module.exports.range = range;

// just used to signal/document that we're explicitely ignoring/expecting an error
function ignoreExpectedError() {
}
module.exports.ignoreExpectedError = ignoreExpectedError;

const getEvents = (truffleInstance, filter, fromBlock = 0, toBlock = 'latest') => truffleInstance.contract.getPastEvents(filter.event, { fromBlock, toBlock })

module.exports.getEvents = getEvents;

function ether (n) {
  return new BN(web3.utils.toWei(n, 'ether'));
}

module.exports.ether = ether;

function expectEventInLogs (logs, eventName, eventArgs = {}) {
  const events = logs.filter(e => e.event === eventName);
  expect(events.length > 0).to.equal(true, `There is no '${eventName}'`);

  const exception = [];
  const event = events.find(function (e) {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v);
      } catch (error) {
        exception.push(error);
        return false;
      }
    }
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}

function contains (args, key, value) {
  expect(key in args).to.equal(true, `Unknown event argument '${key}'`);

  if (value === null) {
    expect(args[key]).to.equal(null);
  } else if (isBN(args[key])) {
    expect(args[key]).to.be.bignumber.equal(value);
  } else {
    expect(args[key]).to.be.equal(value);
  }
}

function isBN (object) {
  return BN.isBN(object) || object instanceof BN;
}

module.exports.expectEventInLogs = expectEventInLogs;
