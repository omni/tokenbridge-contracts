const deployToken = require('./src/utils/deployERC20Token')
const deployInterestReceiver = require('./src/utils/deployInterestReceiver')

const mode = process.argv[2]

async function main() {
  switch (mode) {
    case 'token':
      await deployToken()
      break
    case 'interestReceiver':
      await deployInterestReceiver()
      break
    case 'block-reward':
      console.log('The mode "block-reward" is not implemented yet.')
      break
    default:
      console.log('Use either "token" / "interestReceiver" or "block-reward" as the parameter')
  }
}

main().catch(e => console.log('Error:', e))
