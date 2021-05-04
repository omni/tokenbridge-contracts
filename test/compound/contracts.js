const Comptroller = artifacts.require('IHarnessComptroller')
const ERC20Mock = artifacts.require('ERC20Mock')
const ICToken = artifacts.require('ICToken')

async function getCompoundContracts() {
  const comptroller = await Comptroller.at('0x85e855b22F01BdD33eE194490c7eB16b7EdaC019')
  const dai = await ERC20Mock.at('0x0a4dBaF9656Fd88A32D087101Ee8bf399f4bd55f')
  const cDai = await ICToken.at('0x615cba17EE82De39162BB87dBA9BcfD6E8BcF298')
  const comp = await ERC20Mock.at('0x6f51036Ec66B08cBFdb7Bd7Fb7F40b184482d724')
  return { comptroller, dai, cDai, comp }
}

module.exports = getCompoundContracts
