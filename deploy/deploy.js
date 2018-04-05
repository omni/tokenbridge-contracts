require('dotenv').config();
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const HOME_PROXY_OWNER = process.env.HOME_PROXY_OWNER;
const HOME_REQUIRED_NUMBER_OF_VALIDATORS = process.env.HOME_REQUIRED_NUMBER_OF_VALIDATORS;
const HOME_VALIDATORS = process.env.HOME_VALIDATORS.split(" ")
const HOME_DAILY_LIMIT = process.env.HOME_DAILY_LIMIT || '1000000000000000000' // 1 ether
const HOME_MAX_AMOUNT_PER_TX = process.env.HOME_MAX_AMOUNT_PER_TX || '100000000000000000' // 0.1 ether

const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const FOREIGN_PROXY_OWNER = process.env.FOREIGN_PROXY_OWNER;
const FOREIGN_REQUIRED_NUMBER_OF_VALIDATORS = process.env.FOREIGN_REQUIRED_NUMBER_OF_VALIDATORS;
const FOREIGN_VALIDATORS = process.env.FOREIGN_VALIDATORS.split(" ")
const FOREIGN_DAILY_LIMIT = process.env.FOREIGN_DAILY_LIMIT || '1000000000000000000' // 1 ether
const FOREIGN_MAX_AMOUNT_PER_TX = process.env.FOREIGN_MAX_AMOUNT_PER_TX || '100000000000000000' // 0.1 ether


const POA20 = require('../build/contracts/POA20.json');
const EternalStorageProxy = require('../build/contracts/EternalStorageProxy.json');
const BridgeValidators = require('../build/contracts/BridgeValidators.json')
const HomeBridge = require('../build/contracts/HomeBridge.json')
const ForeignBridge = require('../build/contracts/ForeignBridge.json')

const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const GAS_PRICE = Web3Utils.toWei(process.env.GAS_PRICE, 'gwei');
const GAS_LIMIT = '6700000';

async function deployHome() {
  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {from: HOME_PROXY_OWNER})
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)

  console.log('\ndeploying implementation for home validators')
  let bridgeValidatorsHome = await deployContract(BridgeValidators, [], {from: HOME_PROXY_OWNER})
  console.log('[Home] BridgeValidators Implementation: ', bridgeValidatorsHome.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  const txUpgradeToBridgeVHome = await storageValidatorsHome.methods.upgradeTo('0', bridgeValidatorsHome.options.address)
    .send({from: HOME_PROXY_OWNER});
  console.log('[Home] TxHash: ' , txUpgradeToBridgeVHome.transactionHash)

  console.log('\ninitializing Home Bridge Validators with following parameters:')
  console.log(`\tHOME_REQUIRED_NUMBER_OF_VALIDATORS: ${HOME_REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${HOME_VALIDATORS}`)
  bridgeValidatorsHome.options.address = storageValidatorsHome.options.address
  const txInitialize = await bridgeValidatorsHome.methods.initialize(
    HOME_REQUIRED_NUMBER_OF_VALIDATORS, HOME_VALIDATORS, HOME_PROXY_OWNER
  ).send({from: HOME_PROXY_OWNER})
  console.log('[Home] TxHash: ',txInitialize.transactionHash)

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {from: HOME_PROXY_OWNER})
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {from: HOME_PROXY_OWNER})
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const txUpgradeToHomeBridge = await homeBridgeStorage.methods.upgradeTo('0', homeBridgeImplementation.options.address)
    .send({from: HOME_PROXY_OWNER});
  console.log('[Home] TxHash: ' , txUpgradeToHomeBridge.transactionHash)

  console.log('\ninitializing Home Bridge with following parameters:')
  console.log(`\t Home Validators: ${storageValidatorsHome.options.address}, HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth, HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth`)
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  const txInitializeHomeBridge = await homeBridgeImplementation.methods.initialize(
    storageValidatorsHome.options.address, HOME_DAILY_LIMIT, HOME_MAX_AMOUNT_PER_TX
  ).send({from: HOME_PROXY_OWNER})
  console.log('[Home] TxHash: ',txInitializeHomeBridge.transactionHash)

  console.log('\nHome Deployment Bridge is complete\n')
  return homeBridgeStorage.options.address

}

async function deployForeign() {
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('\n[Foreign] deploying POA20 token')
  const poa20foreign = await deployContract(POA20, ["POA ERC20 on Foundation", "POA20", 18], {from: FOREIGN_PROXY_OWNER, network: 'foreign'})
  console.log('[Foreign] POA20: ', poa20foreign.options.address)


  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign'})
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  let bridgeValidatorsForeign = await deployContract(BridgeValidators, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign'})
  console.log('[Foreign] BridgeValidators Implementation: ', bridgeValidatorsForeign.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  const txUpgradeToBridgeVForeign = await storageValidatorsForeign.methods.upgradeTo('0', bridgeValidatorsForeign.options.address)
    .send({from: FOREIGN_PROXY_OWNER});
  console.log('[Foreign] TxHash: ' , txUpgradeToBridgeVForeign.transactionHash)

  console.log('\ninitializing Foreign Bridge Validators with following parameters:')
  console.log(`\tFOREIGN_REQUIRED_NUMBER_OF_VALIDATORS: ${FOREIGN_REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${FOREIGN_VALIDATORS}`)
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  const txInitializeForeign = await bridgeValidatorsForeign.methods.initialize(
    FOREIGN_REQUIRED_NUMBER_OF_VALIDATORS, FOREIGN_VALIDATORS, FOREIGN_PROXY_OWNER
  ).send({from: FOREIGN_PROXY_OWNER})
  console.log('[Foreign] TxHash: ',txInitializeForeign.transactionHash)


  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign'})
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {from: FOREIGN_PROXY_OWNER, network: 'foreign'})
  console.log('[Foreign] ForeignBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  const txUpgradeToForeignBridge = await foreignBridgeStorage.methods.upgradeTo('0', foreignBridgeImplementation.options.address)
    .send({from: FOREIGN_PROXY_OWNER});
  console.log('[Foreign] TxHash: ' , txUpgradeToForeignBridge.transactionHash)

  console.log('\ninitializing Foreign Bridge with following parameters:')
  console.log(`\t Foreign Validators: ${storageValidatorsForeign.options.address}, FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth, FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(FOREIGN_MAX_AMOUNT_PER_TX)} in eth`)
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  const txInitializeBridge = await foreignBridgeImplementation.methods.initialize(
    storageValidatorsForeign.options.address, poa20foreign.options.address, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX
  ).send({from: FOREIGN_PROXY_OWNER})
  console.log('[Foreign] TxHash: ',txInitializeBridge.transactionHash)

  console.log('transferring ownership of POA20 token to foreignBridge contract')
  const txOwnership = await poa20foreign.methods.transferOwnership(foreignBridgeStorage.options.address)
          .send({from: FOREIGN_PROXY_OWNER})
  console.log('[Foreign] TxHash: ', txOwnership.transactionHash)
  return {
    foreignBridgeStorageAddress: foreignBridgeStorage.options.address,
    poa20foreignAddress: poa20foreign.options.address
  }
}

async function main() {
  const homeBridgeStorageAddress = await deployHome()
  const {foreignBridgeStorageAddress, poa20foreignAddress} = await deployForeign()
  console.log("\nDeployment has been completed.\n\n")
  console.log('[   Home  ] HomeBridge: ', homeBridgeStorageAddress)
  console.log('[ Foreign ] ForeignBridge: ', foreignBridgeStorageAddress)
  console.log('[ Foreign ] POA20: ', poa20foreignAddress)
}


async function deployContract(contractJson, args, {from, network}) {
  const web3 = network === 'foreign' ? web3Foreign: web3Home;
  const options = {
    from,
    gasPrice: GAS_PRICE,
    gas: GAS_LIMIT
  };
  let instance = new web3.eth.Contract(contractJson.abi, options);
  const result = await instance.deploy({
    data: contractJson.bytecode,
    arguments: args
  }).send()
  instance.options = result.options
  return result
}
main()
