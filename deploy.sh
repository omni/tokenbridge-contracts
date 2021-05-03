#!/bin/bash

if [ -f /.dockerenv ]; then
  # the script is run within the container
  cd deploy

  if [ "$1" == "token" ]; then
    echo "Deployment of token for testing environment started"
    node testenv-deploy.js token
  else
    echo "Bridge contract deployment started"
    npm run deploy
    if [ -f bridgeDeploymentResults.json ]; then
      cat bridgeDeploymentResults.json
      echo
    fi
  fi
  exit 0
fi

which docker-compose > /dev/null
if [ "$?" == "1" ]; then
  echo "docker-compose is needed to use this type of deployment"
  exit 1
fi

if [ ! -f ./deploy/.env ]; then
  echo "The .env file not found in the 'deploy' directory"
  exit 3
fi

docker-compose images bridge-contracts >/dev/null 2>/dev/null
if [ "$?" == "1" ]; then
  echo "Docker image 'bridge-contracts' not found"
  exit 2
fi

docker-compose run bridge-contracts deploy.sh "$@"
