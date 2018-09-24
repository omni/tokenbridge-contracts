const env = require('./src/loadEnv')

const deployToken = require('./src/testenv/token')

async function main() {
  //If other components of testing env needs to be initialized
  //the script must be modified to handle the corresponding
  //component through 'switch-case'
  const token = await deployToken()
}

main().catch(e => console.log('Error:', e))
