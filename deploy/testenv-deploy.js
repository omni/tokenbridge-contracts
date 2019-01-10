const deployToken = require('./src/utils/deployERC20Token')

const mode = process.argv[2]

async function main() {
  switch (mode) {
    case 'token':
      await deployToken()
      break
    case 'block-reward':
      console.log('The mode "block-reward" is not implemented yet.')
      break
    default:
      console.log('Use either "token" or "block-reward" as the parameter')
  }
}

main().catch(e => console.log('Error:', e))
