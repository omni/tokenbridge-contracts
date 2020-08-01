const { CoverageSubprovider, Web3ProviderEngine } = require('@0x/sol-coverage')
const { TruffleArtifactAdapter } = require('@0x/sol-trace')
const { GanacheSubprovider } = require('@0x/subproviders')

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
    ignoreFilesGlobs: ['**/Migrations.sol', '**/node_modules/**', '**/mocks/**', '**/interfaces/**']
  })
  provider.addProvider(global.coverageSubprovider)
  const ganacheSubprovider = new GanacheSubprovider({
    accounts: [
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209',
        balance: '1000000000000000000000000'
      },
      {
        secretKey: '0x19fba401d77e4113b15095e9aa7117bcd25adcfac7f6111f8298894eef443600',
        balance: '1000000000000000000000000'
      }
    ],
    port: 8545,
    gasLimit: 10000000
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
      network_id: '*',
      gas: 10000000
    },
    ganache: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gasPrice: 100000000000,
      gas: 10000000
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
