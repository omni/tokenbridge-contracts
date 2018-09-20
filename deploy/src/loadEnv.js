const path = require('path')
const envalid = require('envalid')
require('dotenv').config({
  path: path.join(__dirname, '', '.env')
})

const validBridgeModes = ['NATIVE_TO_ERC', 'ERC_TO_ERC']
const env = envalid.cleanEnv(process.env, {
  BRIDGE_MODE: envalid.str(validBridgeModes)
})

module.exports = env
