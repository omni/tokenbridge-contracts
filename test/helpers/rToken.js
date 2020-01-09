const truffleContract = require('@truffle/contract')
const RToken = truffleContract(require('@rtoken/contracts/build/contracts/RToken.json'))
const ComptrollerMock = truffleContract(require('@rtoken/contracts/build/contracts/ComptrollerMock.json'))
const CErc20 = truffleContract(require('@rtoken/contracts/build/contracts/CErc20.json'))
const InterestRateModelMock = truffleContract(require('@rtoken/contracts/build/contracts/InterestRateModelMock.json'))
const CompoundAllocationStrategy = truffleContract(
  require('@rtoken/contracts/build/contracts/CompoundAllocationStrategy.json')
)

const { ether } = require('../helpers/helpers')

RToken.setProvider(web3.currentProvider)
ComptrollerMock.setProvider(web3.currentProvider)
CErc20.setProvider(web3.currentProvider)
InterestRateModelMock.setProvider(web3.currentProvider)
CompoundAllocationStrategy.setProvider(web3.currentProvider)

async function createRToken(token, owner) {
  const comptroller = await ComptrollerMock.new({ from: owner })
  const interestRateModel = await InterestRateModelMock.new({ from: owner })
  const cToken = await CErc20.new(
    token.address,
    comptroller.address,
    interestRateModel.address,
    ether('1'), // 1 cToken == cTokenExchangeRate * token
    'Compound token',
    'cToken',
    18,
    { from: owner }
  )
  const compoundAS = await CompoundAllocationStrategy.new(cToken.address, { from: owner })
  const rToken = await RToken.new({ from: owner })
  await compoundAS.transferOwnership(rToken.address, { from: owner })
  await rToken.initialize(compoundAS.address, 'RToken Test', 'RTOKEN', 18, { from: owner })
  return rToken
}

module.exports.createRToken = createRToken
