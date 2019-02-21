const HomeBridgeFactory = artifacts.require("HomeBridgeFactory.sol")
const HomeBridge = artifacts.require("HomeBridgeErcToErc.sol")
const BridgeValidators = artifacts.require("BridgeValidators.sol")

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
const minPerTx = quarterEther
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther

contract('HomeBridgeFactory', async (accounts) => {
  let validatorContract, homeBridgeContract, owner
  before(async () => {
    validatorContract = await BridgeValidators.new()
    homeBridgeContract = await HomeBridge.new()
    owner = accounts[0]
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      let homeBridgeFactory = await HomeBridgeFactory.new()

      false.should.be.equal(await homeBridgeFactory.isInitialized())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsImplementation())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.requiredSignatures())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.bridgeValidatorsProxyOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeErcToErcImplementation())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.requiredBlockConfirmations())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.gasPrice())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.homeDailyLimit())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.homeMaxPerTx())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.minPerTx())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.foreignDailyLimit())
      '0'.should.be.bignumber.equal(await homeBridgeFactory.foreignMaxPerTx())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeOwner())
      ZERO_ADDRESS.should.be.equal(await homeBridgeFactory.homeBridgeProxyOwner())

      await homeBridgeFactory.initialize().should.be.rejectedWith(INVALID_ARGUMENTS)
      await homeBridgeFactory.initialize(ZERO_ADDRESS, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, ZERO_ADDRESS, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, 0, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], ZERO_ADDRESS, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, ZERO_ADDRESS, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, 0, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, 0, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, 0, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, 0, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, 0, foreignDailyLimit, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, 0, foreignMaxPerTx, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignDailyLimit, owner, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, ZERO_ADDRESS, owner).should.be.rejectedWith(ERROR_MSG)
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)

      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)

      true.should.be.equal(await homeBridgeFactory.isInitialized())
      validatorContract.address.should.be.equal(await homeBridgeFactory.bridgeValidatorsImplementation())
      requiredSignatures.should.be.bignumber.equal(await homeBridgeFactory.requiredSignatures())
      owner.should.be.equal(await homeBridgeFactory.bridgeValidatorsOwner())
      owner.should.be.equal(await homeBridgeFactory.bridgeValidatorsProxyOwner())
      homeBridgeContract.address.should.be.equal(await homeBridgeFactory.homeBridgeErcToErcImplementation())
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridgeFactory.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridgeFactory.gasPrice())
      homeDailyLimit.should.be.bignumber.equal(await homeBridgeFactory.homeDailyLimit())
      homeMaxPerTx.should.be.bignumber.equal(await homeBridgeFactory.homeMaxPerTx())
      minPerTx.should.be.bignumber.equal(await homeBridgeFactory.minPerTx())
      foreignDailyLimit.should.be.bignumber.equal(await homeBridgeFactory.foreignDailyLimit())
      foreignMaxPerTx.should.be.bignumber.equal(await homeBridgeFactory.foreignMaxPerTx())
      owner.should.be.equal(await homeBridgeFactory.homeBridgeOwner())
      owner.should.be.equal(await homeBridgeFactory.homeBridgeProxyOwner())
      const [major, minor, patch] = await homeBridgeFactory.getBridgeFactoryVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })

  describe('#deployHomeBridge', async () => {
    let homeBridgeFactory
    before(async () => {
      homeBridgeFactory = await HomeBridgeFactory.new()
      await homeBridgeFactory.initialize(owner, validatorContract.address, requiredSignatures, [owner], owner, homeBridgeContract.address, requiredBlockConfirmations, gasPrice, homeDailyLimit, homeMaxPerTx, minPerTx, foreignDailyLimit, foreignMaxPerTx, owner, owner)
    })

    it('should deploy a home bridge', async () => {
      let token = { name: "Some ERC20", symbol: "SMT_1", decimals: 18 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('should deploy a second home bridge using same factory', async () => {
      let token = { name: "Another ERC20", symbol: "SMT_2", decimals: 18 }

      const {logs} = await homeBridgeFactory.deployHomeBridge(token.name, token.symbol, token.decimals)
      const {args} = getEventFromLogs(logs, 'HomeBridgeDeployed')

      ZERO_ADDRESS.should.not.be.equal(args._homeBridge)
      ZERO_ADDRESS.should.not.be.equal(args._homeValidators)
      ZERO_ADDRESS.should.not.be.equal(args._token)
      args._blockNumber.should.be.bignumber.gte(0)

      let homeBridge = await HomeBridge.at(args._homeBridge)
      true.should.be.equal(await homeBridge.isInitialized())
      args._homeValidators.should.be.equal(await homeBridge.validatorContract())
      const deployedAtBlock = await homeBridge.deployedAtBlock()
      deployedAtBlock.should.be.bignumber.above(0)
      requiredBlockConfirmations.should.be.bignumber.equal(await homeBridge.requiredBlockConfirmations())
      gasPrice.should.be.bignumber.equal(await homeBridge.gasPrice())
      const bridgeMode = '0xba4690f5' // 4 bytes of keccak256('erc-to-erc-core')
      const mode = await homeBridge.getBridgeMode()
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeBridge.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
  })
})
