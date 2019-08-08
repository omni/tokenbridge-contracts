const { CoverageSubprovider, Web3ProviderEngine } = require('@0x/sol-coverage')
const { TruffleArtifactAdapter } = require('@0x/sol-trace')
const { GanacheSubprovider } = require('@0x/subproviders')

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

const projectRoot = ''
const solcVersion = '0.4.24'
const defaultFromAddress = '0x5409ed021d9299bf6814279a6a1411a7e866a631'
const isVerbose = true
const artifactAdapter = new TruffleArtifactAdapter(projectRoot, solcVersion)
const provider = new Web3ProviderEngine()
if (process.env.SOLIDITY_COVERAGE === 'true') {
  global.coverageSubprovider = new CoverageSubprovider(artifactAdapter, defaultFromAddress, {
    isVerbose,
    ignoreFilesGlobs: ['**/Migrations.sol', '**/node_modules/**', '**/mocks/**', '**/interfaces/**']
  })
  provider.addProvider(global.coverageSubprovider)
  const ganacheSubprovider = new GanacheSubprovider({
    default_balance_ether: '1000000000000000000000000',
    total_accounts: 10,
    port: 8545
  })
  provider.addProvider(ganacheSubprovider)
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
      network_id: '*'
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
