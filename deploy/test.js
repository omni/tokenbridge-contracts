const Web3 = require('web3')

const web3 = new Web3('http://localhost:8545')
web3.extend({
  property: 'evm',
  methods: [{ name: 'mine', call: 'evm_mine' }]
})

const abi = [
  ...require('../build/contracts/EternalStorageProxy.json').abi,
  ...require('../build/contracts/ForeignBridgeErcToNative.json').abi
]

const { bytecode: implBytecode } = require('../build/contracts/ForeignBridgeErcToNative.json')
const { bytecode: interestReceiverBytecode } = require('../build/contracts/InterestReceiverStakeBuyback.json')
const { abi: tokenAbi } = require('../build/contracts/ERC20.json')
const { abi: routerAbi } = require('../build/contracts/IUniswapRouterV2.json')

const bridgeAddress = '0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016'
const sender = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const stakeTokenAddress = '0x0Ae055097C6d159879521C384F1D2123D1f195e6'
const wethTokenAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const daiTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const usdtTokenAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const compTokenAddress = '0xc00e94Cb662C3520282E6f5717214004A7f26888'
const burnAddress = '0x000000000000000000000000000000000000dead'

const bridge = new web3.eth.Contract(abi, bridgeAddress)

async function main() {
  console.log('Starting test case...')
  console.log('Get owner addresses')
  const upgradeabilityOwner = await bridge.methods.upgradeabilityOwner().call()
  const owner = await bridge.methods.owner().call()
  console.log(upgradeabilityOwner, owner)
  console.log('Get proxy version')
  const version = parseInt(await bridge.methods.version().call(), 10)

  console.log('Deploy new implementation')
  const { contractAddress: bridgeImpl } = await web3.eth.sendTransaction({
    from: sender,
    data: implBytecode,
    gas: 12500000
  })
  console.log('Deploy new interest receiver')
  const { contractAddress: interestReceiverAddr } = await web3.eth.sendTransaction({
    from: sender,
    data: interestReceiverBytecode,
    gas: 12500000
  })
  console.log('Call upgradeTo')
  await bridge.methods.upgradeTo(version + 1, bridgeImpl).send({ from: upgradeabilityOwner })
  console.log('Call initializeInterest for DAI')
  await bridge.methods.initializeInterest(
    daiTokenAddress,
    web3.utils.toWei('1000000'),
    web3.utils.toWei('1000'),
    web3.utils.toWei('1000000000'),
    interestReceiverAddr
  ).send({ from: owner, gas: 500000 })
  console.log('Call setPaidInterestLimits for COMP')
  await bridge.methods.setPaidInterestLimits(
    compTokenAddress,
    web3.utils.toWei('1'),
    web3.utils.toWei('1000000000')
  ).send({ from: owner, gas: 500000 })
  console.log('Call setInterestReceiver for COMP')
  await bridge.methods.setInterestReceiver(
    compTokenAddress,
    interestReceiverAddr
  ).send({ from: owner, gas: 500000 })

  console.log('Call invest for DAI')
  await bridge.methods.invest(daiTokenAddress).send({ from: sender, gas: 500000 })

  const stake = new web3.eth.Contract(tokenAbi, stakeTokenAddress)
  const router = new web3.eth.Contract(routerAbi, routerAddress)
  const getExchangeRate = async (path, unit = 'ether') =>
    router.methods
      .getAmountsOut(web3.utils.toWei('1000'), path)
      .call()
      .then(x => web3.utils.fromWei(x[x.length - 1], unit))
  const pathDai = [stakeTokenAddress, wethTokenAddress, daiTokenAddress]
  const pathUsdt = [stakeTokenAddress, wethTokenAddress, usdtTokenAddress]
  const printRates = async (title) => {
    console.log(title)
    console.log(`Interest amount: ${web3.utils.fromWei(await bridge.methods.interestAmount(daiTokenAddress).call())} DAI`)
    console.log(`Burned STAKE: ${web3.utils.fromWei(await stake.methods.balanceOf(burnAddress).call())} STAKE`)
    console.log(`Exchange rate: ${await getExchangeRate(pathDai)} DAI per STAKE`)
    console.log(`Exchange rate: ${await getExchangeRate(pathUsdt, 'mwei')} USDT per STAKE`)
    console.log(`Balance of Interest Receiver: ${web3.utils.fromWei(await web3.eth.getBalance(interestReceiverAddr))} ETH`)
  }
  await printRates('Check params before')

  console.log('Mine 6646 blocks ~ 1 day in Mainnet')
  for (let i = 0; i < (24 * 60 * 60) / 13; i++) {
    await web3.evm.mine()
  }
  await printRates('Check params after some time')

  console.log('Call payInterest')
  const { gasUsed } = await bridge.methods.payInterest(daiTokenAddress).send({ from: sender, gas: 5000000 })
  console.log(`Used gas: ${gasUsed}`)
  const gasPrice = web3.utils.toWei('100', 'gwei')
  const costUSD = 2000 * web3.utils.fromWei(web3.utils.toBN(gasPrice).muln(gasUsed))
  console.log(`Estimate cost of calling payInterest: ${costUSD} USD`)

  await printRates('Check params after STAKE buyback')

  console.log('Call claimCompAndPay')
  const { gasUsed: gasUsed2 } = await bridge.methods.claimCompAndPay().send({ from: sender, gas: 5000000 })
  console.log(`Used gas: ${gasUsed2}`)
  const costUSD2 = 2000 * web3.utils.fromWei(web3.utils.toBN(gasPrice).muln(gasUsed2))
  console.log(`Estimate cost of calling payInterest: ${costUSD2} USD`)

  await printRates('Check params after second STAKE buyback')

  console.log('Mine 6646 blocks ~ 1 day in Mainnet')
  for (let i = 0; i < (24 * 60 * 60) / 13; i++) {
    await web3.evm.mine()
  }

  console.log('Call disableInterest')
  const { gasUsed: gasUsed3 } = await bridge.methods.disableInterest(daiTokenAddress).send({ from: owner, gas: 5000000 })
  console.log(`Used gas: ${gasUsed3}`)

  await printRates('Check params disableInterest')

  console.log('Call claimCompAndPay')
  const { gasUsed: gasUsed4 } = await bridge.methods.claimCompAndPay().send({ from: sender, gas: 5000000 })
  console.log(`Used gas: ${gasUsed4}`)
  const costUSD3 = 2000 * web3.utils.fromWei(web3.utils.toBN(gasPrice).muln(gasUsed4))
  console.log(`Estimate cost of calling payInterest: ${costUSD3} USD`)

  await printRates('Check params after second claimCompAndPay')
}

main()
