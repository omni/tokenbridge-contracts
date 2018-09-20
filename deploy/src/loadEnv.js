const fs = require('fs')
const path = require('path')
const envalid = require('envalid')

const dotenvPath = path.join(__dirname, '.env')
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({
    path: dotenvPath
  })
}

const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC']
const env = envalid.cleanEnv(process.env, {
  BRIDGE_MODE: envalid.str(validBridgeModes)
})

module.exports = env
