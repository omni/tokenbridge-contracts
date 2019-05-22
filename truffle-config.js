const spuriousDragonVersion = process.argv[3] === 'spuriousDragon'
const contractsBuildDirectory = spuriousDragonVersion ? './build/spuriousDragon' : './build/contracts'
const evmVersion = spuriousDragonVersion ? 'spuriousDragon' : 'byzantium'
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
    coverage: {
      host: 'localhost',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gasPrice: 100000000000
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
  mocha: mochaOptions
}
