const axios = require('axios')
const querystring = require('querystring')
const fs = require('fs')
const path = require('path')
const promiseRetry = require('promise-retry')
const { EXPLORER_TYPES, REQUEST_STATUS } = require('../constants')

const basePath = path.join(__dirname, '..', '..', '..', 'flats')

const isBridgeToken = name => name === 'ERC677BridgeToken.sol' || name === 'ERC677BridgeTokenRewardable.sol' || name === 'PermittableToken.sol'
const isValidators = name => name === 'BridgeValidators.sol' || name === 'RewardableValidators.sol'
const isInterestReceiver = name => name === 'InterestReceiver.sol'

const flat = async contractPath => {
  const pathArray = contractPath.split('/')
  const name = pathArray[pathArray.length - 1]
  let module = pathArray[pathArray.length - 2]

  if (isBridgeToken(name)) {
    module = ''
  } else if (isValidators(name)) {
    module = 'validators'
  } else if (isInterestReceiver(name)) {
    module = ''
  }

  const flatName = name.replace('.sol', '_flat.sol')

  const filePath = path.join(basePath, module, flatName)

  return fs.readFileSync(filePath).toString()
}

const sendRequest = (url, queries) => axios.post(url, querystring.stringify(queries))

const sendVerifyRequestEtherscan = async (contractPath, options) => {
  const contract = await flat(contractPath)
  const postQueries = {
    apikey: options.apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: options.address,
    sourceCode: contract,
    codeformat: 'solidity-single-file',
    contractname: options.contractName,
    compilerversion: options.compiler,
    optimizationUsed: options.optimizationUsed ? 1 : 0,
    runs: options.runs,
    constructorArguements: options.constructorArguments,
    evmversion: options.evmVersion
  }

  return sendRequest(options.apiUrl, postQueries)
}

const sendVerifyRequestBlockscout = async (contractPath, options) => {
  const contract = await flat(contractPath)
  const postQueries = {
    module: 'contract',
    action: 'verify',
    addressHash: options.address,
    contractSourceCode: contract,
    name: options.contractName,
    compilerVersion: options.compiler,
    optimization: options.optimizationUsed,
    optimizationRuns: options.runs,
    constructorArguments: options.constructorArguments,
    evmVersion: options.evmVersion
  }

  return sendRequest(options.apiUrl, postQueries)
}

const getExplorerType = apiUrl =>
  apiUrl && apiUrl.includes('etherscan') ? EXPLORER_TYPES.ETHERSCAN : EXPLORER_TYPES.BLOCKSCOUT

const verifyContract = async (contract, params, type) => {
  try {
    let result
    if (type === EXPLORER_TYPES.ETHERSCAN) {
      result = await sendVerifyRequestEtherscan(contract, params)
    } else {
      result = await sendVerifyRequestBlockscout(contract, params)
    }
    if (result.data.message === REQUEST_STATUS.OK) {
      console.log(`${params.address} verified in ${type}`)
      return true
    }
  } catch (e) {
    return false
  }
  return false
}

const verifier = async ({ artifact, address, constructorArguments, apiUrl, apiKey }) => {
  const type = getExplorerType(apiUrl)

  let metadata
  try {
    metadata = JSON.parse(artifact.metadata)
  } catch (e) {
    console.log('Error on decoding values from artifact')
  }

  const contract = artifact.sourcePath
  const params = {
    address,
    contractName: artifact.contractName,
    constructorArguments,
    compiler: `v${artifact.compiler.version.replace('.Emscripten.clang', '')}`,
    optimizationUsed: metadata.settings.optimizer.enabled,
    runs: metadata.settings.optimizer.runs,
    evmVersion: metadata.settings.evmVersion,
    apiUrl,
    apiKey
  }

  try {
    await promiseRetry(async retry => {
      const verified = await verifyContract(contract, params, type)
      if (!verified) {
        retry()
      }
    })
  } catch (e) {
    console.log(`It was not possible to verify ${address} in ${type}`)
  }
}

module.exports = verifier
