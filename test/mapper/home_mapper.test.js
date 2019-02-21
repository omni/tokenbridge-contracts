const BridgeMapper = artifacts.require("BridgeMapper.sol")
const ForeignBridgeFactory = artifacts.require("ForeignBridgeFactory.sol")
const HomeBridgeFactory = artifacts.require("HomeBridgeFactory.sol")
const ForeignBridge = artifacts.require("ForeignBridgeErcToErc.sol")
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")
const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol")

const {ERROR_MSG, ZERO_ADDRESS, INVALID_ARGUMENTS} = require('../setup')
const {getEventFromLogs} = require('../helpers/helpers')
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"))
const quarterEther = web3.toBigNumber(web3.toWei(0.25, "ether"))
const requiredSignatures = 1
const requiredBlockConfirmations = 8
const gasPrice = web3.toWei('1', 'gwei')
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"))
const homeDailyLimit = oneEther
const homeMaxPerTx = halfEther
const maxPerTx = halfEther
const minPerTx = quarterEther
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther

contract('BridgeMapper', async (accounts) => {
  let validatorContract, owner, foreignBridgeContract, homeBridgeContract, homeBridgeFactory, foreignBridgeFactory
  before(async () => {
    owner = accounts[0]

    validatorContract = await BridgeValidators.new()
    foreignBridgeContract = await ForeignBridge.new()
    homeBridgeContract = await HomeBridge.new()
    foreignBridgeFactory = await ForeignBridgeFactory.new()
    homeBridgeFactory = await HomeBridgeFactory.new()

    await foreignBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, foreignBridgeContract.address, requiredBlockConfirmations, gasPrice, maxPerTx, homeDailyLimit, homeMaxPerTx, owner, owner)
    await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let bridgeMapper = await BridgeMapper.new()

      false.should.be.equal(await bridgeMapper.isInitialized())
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.owner())

      await bridgeMapper.initialize().should.be.rejectedWith(INVALID_ARGUMENTS)

      await bridgeMapper.initialize(owner)

      true.should.be.equal(await bridgeMapper.isInitialized())
      owner.should.be.equal(await bridgeMapper.owner())
    })
  })

  describe('#addBridgeMapping', async () => {
    let bridgeMapper
    before(async () => {
      bridgeMapper = await BridgeMapper.new()
      await bridgeMapper.initialize(owner)
    })

    it('should not add mapping if params are wrong/missng', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      await bridgeMapper.addBridgeMapping().should.be.rejectedWith(INVALID_ARGUMENTS)
      await bridgeMapper.addBridgeMapping(ZERO_ADDRESS, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(foreignToken.address, ZERO_ADDRESS, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, ZERO_ADDRESS, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, ZERO_ADDRESS, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, 0, homeBridgeDeployedArgs._blockNumber).should.be.rejectedWith(ERROR_MSG)
      await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, 0).should.be.rejectedWith(ERROR_MSG)
    })

    it('should add a bridge mapping', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT_1", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT_1", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      let {logs} = await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByForeignToken(foreignToken.address))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByForeignToken(foreignToken.address))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByForeignToken(foreignToken.address))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByForeignToken(foreignToken.address))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByForeignToken(foreignToken.address))
    })

    it('should add a second bridge mapping using same mapper', async () => {
      let foreignToken = await ERC677BridgeToken.new("Another Foreign ERC20", "FSMT_2", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Another Home ERC20", symbol: "HSMT_2", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      let {logs} = await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      foreignToken.address.should.be.equal(args.foreignToken)
      homeBridgeDeployedArgs._token.should.be.equal(args.homeToken)
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(args.foreignBridge)
      homeBridgeDeployedArgs._homeBridge.should.be.equal(args.homeBridge)
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.foreignStartBlock)
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(args.homeStartBlock)

      homeBridgeDeployedArgs._token.should.be.equal(await bridgeMapper.homeTokenByForeignToken(foreignToken.address))
      foreignBridgeDeployedArgs._foreignBridge.should.be.equal(await bridgeMapper.foreignBridgeByForeignToken(foreignToken.address))
      homeBridgeDeployedArgs._homeBridge.should.be.equal(await bridgeMapper.homeBridgeByForeignToken(foreignToken.address))
      foreignBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByForeignToken(foreignToken.address))
      homeBridgeDeployedArgs._blockNumber.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByForeignToken(foreignToken.address))
    })
  })

  describe('#removeBridgeMapping', async () => {
    let bridgeMapper
    before(async () => {
      bridgeMapper = await BridgeMapper.new()
      await bridgeMapper.initialize(owner)
    })

    it('should remove a bridge mapping', async () => {
      let foreignToken = await ERC677BridgeToken.new("Foreign ERC20", "FSMT", 18)
      let foreignBridgeDeployedArgs = getEventFromLogs((await foreignBridgeFactory.deployForeignBridge(foreignToken.address)).logs, 'ForeignBridgeDeployed').args

      let homeToken = { name: "Home ERC20", symbol: "HSMT", decimals: 18 }
      let homeBridgeDeployedArgs = getEventFromLogs((await homeBridgeFactory.deployHomeBridge(homeToken.name, homeToken.symbol, homeToken.decimals)).logs, 'HomeBridgeDeployed').args

      await bridgeMapper.addBridgeMapping(foreignToken.address, homeBridgeDeployedArgs._token, foreignBridgeDeployedArgs._foreignBridge, homeBridgeDeployedArgs._homeBridge, foreignBridgeDeployedArgs._blockNumber, homeBridgeDeployedArgs._blockNumber)

      let {logs} = await bridgeMapper.removeBridgeMapping(foreignToken.address)
      let {args} = getEventFromLogs(logs, 'BridgeMappingUpdated')

      foreignToken.address.should.be.equal(args.foreignToken)
      ZERO_ADDRESS.should.be.equal(args.homeToken)
      ZERO_ADDRESS.should.be.equal(args.foreignBridge)
      ZERO_ADDRESS.should.be.equal(args.homeBridge)
      '0'.should.be.bignumber.equal(args.foreignStartBlock)
      '0'.should.be.bignumber.equal(args.homeStartBlock)

      ZERO_ADDRESS.should.be.equal(await bridgeMapper.homeBridgeByForeignToken(foreignToken.address))
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.foreignBridgeByForeignToken(foreignToken.address))
      ZERO_ADDRESS.should.be.equal(await bridgeMapper.homeTokenByForeignToken(foreignToken.address))
      '0'.should.be.bignumber.equal(await bridgeMapper.homeStartBlockByForeignToken(foreignToken.address))
      '0'.should.be.bignumber.equal(await bridgeMapper.foreignStartBlockByForeignToken(foreignToken.address))
    })
  })
})
