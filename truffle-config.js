const { CoverageSubprovider, Web3ProviderEngine } = require('@0x/sol-coverage')
const { TruffleArtifactAdapter } = require('@0x/sol-trace')
const RPCSubprovider = require('web3-provider-engine/subproviders/rpc')

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

const projectRoot = ''
const solcVersion = '0.4.24+commit.e67f0147'
const defaultFromAddress = '0x5409ed021d9299bf6814279a6a1411a7e866a631'
const isVerbose = true
const artifactAdapter = new TruffleArtifactAdapter(projectRoot, solcVersion)
const provider = new Web3ProviderEngine()
if (process.env.SOLIDITY_COVERAGE === 'true') {
  global.coverageSubprovider = new CoverageSubprovider(artifactAdapter, defaultFromAddress, {
    isVerbose,
    ignoreFilesGlobs: ['**/Migrations.sol', '**/node_modules/**', '**/mocks/**', '**/interfaces/**', '**/helpers/**']
  })
  provider.addProvider(global.coverageSubprovider)
  provider.addProvider(new RPCSubprovider({ rpcUrl: 'http://localhost:8545' }))
  provider.start(err => {
    if (err !== undefined) {
      process.exit(1)
    }
  })
  provider.send = provider.sendAsync.bind(provider)
}

module.exports = {
  contracts_build_directory: contractsBuildDirectory,
  networks: {
    development: {
      provider,
      network_id: '*',
      gas: 10000000,
      disableConfirmationListener: true
    },
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
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
  mocha: mochaOptions
}
