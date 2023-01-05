import { $, cd, echo, fs, question } from 'zx'
import crypto from 'crypto'
import path from 'node:path'
import { GlobalOptions, getTomlFileInfo, serverTomlExists, clientTomlExists, getAppNameFromToml, TomlFilePaths } from './helpers.js'

// TODO: validate region using $`flyctl platform regions -j` output
export async function launch(baseName: string, region: string, options: GlobalOptions) {
  echo`Launching your Wasp app to Fly.io!`

  cd(options.waspDir)

  if (!options.skipBuild) {
    await $`wasp build`
  }

  const tomlFiles = getTomlFileInfo(options)

  if (serverTomlExists(tomlFiles)) {
    echo`Server toml exists. Skipping server launch.`
    if (clientTomlExists(tomlFiles)) {
      echo`Client toml exists. Skipping client launch.`
    } else {
      // Infer names from server fly.toml file.
      const serverName = getAppNameFromToml(tomlFiles.serverTomlPath)
      const clientName = serverName.replace('-server', '-client')
      launchClient(serverName, clientName, region, options, tomlFiles)
    }
  } else {
    await launchServer(baseName, region, options, tomlFiles)
  }
}

// TODO: make the inputs for launchServer/Client be objects with interfaces
// TODO: swap commands like rm with something from Node for improved portability.
async function launchServer(baseName: string, region: string, options: GlobalOptions, tomlFiles: TomlFilePaths) {
  cd(path.join(options.waspDir, '.wasp', 'build'))
  await $`rm -f fly.toml`

  const serverName = `${baseName}-server`
  const clientName = `${baseName}-client`
  const dbName = `${baseName}-db`
  const clientUrl = `https://${clientName}.fly.dev`

  echo`Launching server app with name ${serverName}`
  echo`NOTE: Please do not exit this terminal session until it has completed.`

  await $`flyctl launch --no-deploy --name "${serverName}" --region "${region}"`
  await $`cp -f fly.toml ${tomlFiles.serverTomlPath}`

  const randomString = crypto.randomBytes(32).toString('hex')
  await $`flyctl secrets set JWT_SECRET="${randomString}" PORT=8080 WASP_WEB_CLIENT_URL="${clientUrl}"`

  // TODO: Make postgres vm size, etc. an optional param.
  // TODO: Make org a required param.
  await $`flyctl postgres create --name "${dbName}" --region "${region}" --vm-size "shared-cpu-1x" --initial-cluster-size 1 --volume-size 1 --org "personal"`
  await $`flyctl postgres attach "${dbName}"`

  await question('Please take note of your database credentials above. Press any key to continue.')

  await $`flyctl deploy --remote-only`

  echo`Your server has been deployed! Starting on client now...`
  launchClient(serverName, clientName, region, options, tomlFiles)
}

// TODO: make input an object with interface
async function launchClient(serverName: string, clientName: string, region: string, options: GlobalOptions, tomlFiles: TomlFilePaths) {
  echo`Launching client app with name ${clientName}`

  const pwd = path.join(options.waspDir, '.wasp', 'build', 'web-app')
  cd(pwd)
  await $`rm -f fly.toml`

  const serverUrl = `https://${serverName}.fly.dev`
  const clientUrl = `https://${clientName}.fly.dev`

  echo`Building web client for production...`
  await $`npm install`
  await $`REACT_APP_API_URL="${serverUrl}" npm run build`

  // Creates the necessary Dockerfile for deploying static websites to Fly.io.
  // Adds dummy .dockerignore to supress CLI question.
  // Ref: https://fly.io/docs/languages-and-frameworks/static/
  await $`echo "FROM pierrezemb/gostatic\nCMD [ \"-fallback\", \"index.html\" ]\nCOPY ./build/ /srv/http/" > Dockerfile`
  await $`touch .dockerignore`

  await $`flyctl launch --no-deploy --name "${clientName}" --region "${region}"`

  // TODO: clean this up. Just copied from shell version.
  // goStatic listens on port 8043 by default, but the default fly.toml assumes port 8080.
  await $`cp fly.toml fly.toml.bak`
  await $`sed "s/= 8080/= 8043/1" fly.toml > fly.toml.new`
  await $`mv fly.toml.new fly.toml`

  await $`cp -f fly.toml ${tomlFiles.clientTomlPath}`

  await $`flyctl deploy --remote-only`

  echo`Congratulations! Your Wasp app is now accessible at ${clientUrl}`
}
