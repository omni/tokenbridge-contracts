var BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

exports.ERROR_MSG = 'VM Exception while processing transaction: revert';
exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
