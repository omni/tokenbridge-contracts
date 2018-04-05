#!/bin/bash
rm -rf build/*
mkdir -p build/tmp_build
npm install
cp node_modules/sha3/build/Release/sha3.node node_modules/scrypt/build/Release/scrypt.node node_modules/websocket/build/Release/bufferutil.node node_modules/websocket/build/Release/validation.node build/tmp_build/.
npm run compile


zip -rj build/mac.zip build/tmp_build/sha3.node build/tmp_build/scrypt.node build/tmp_build/validation.node build/tmp_build/bufferutil.node build/tmp_build/deploy-macos
zip -rj build/linux.zip build/tmp_build/sha3.node build/tmp_build/scrypt.node build/tmp_build/validation.node build/tmp_build/bufferutil.node build/tmp_build/deploy-linux
tar czf build/linux.tar.gz build/tmp_build/sha3.node build/tmp_build/scrypt.node build/tmp_build/validation.node build/tmp_build/bufferutil.node build/tmp_build/deploy-linux
zip -rj build/windows.zip build/tmp_build/sha3.node build/tmp_build/scrypt.node build/tmp_build/validation.node build/tmp_build/bufferutil.node build/tmp_build/deploy-win.exe
rm -rf build/tmp_build

