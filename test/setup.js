var BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

exports.ERROR_MSG = 'VM Exception while processing transaction: revert';
exports.ERROR_MSG_OPCODE = 'VM Exception while processing transaction: invalid opcode';
exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
exports.INVALID_ARGUMENTS = 'Invalid number of arguments to Solidity function'
