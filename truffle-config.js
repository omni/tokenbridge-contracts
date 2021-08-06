const contractsBuildDirectory = './build/contracts'
const evmVersion = 'byzantium'
const mochaOptions =
  process.env.GASREPORT === 'true'
    ? {
        reporter: 'eth-gas-reporter',
        reporterOptions: {
          currency: 'USD',
          gasPrice: 1
        }
      }
    : {}

module.exports = {
  contracts_build_directory: contractsBuildDirectory,
  networks: {
    development: {
      network_id: '*',
      gas: 10000000,
      disableConfirmationListener: true
    },
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '1337', // eslint-disable-line camelcase
      gasPrice: 100000000000,
      gas: 10000000,
      disableConfirmationListener: true
    }
  },
  compilers: {
    solc: {
      version: '0.4.24',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion
      }
    }
  },
  mocha: mochaOptions,
  plugins: ['solidity-coverage']
}
