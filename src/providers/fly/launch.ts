import { $, cd, echo, fs, question } from 'zx'
import crypto from 'crypto'
import path from 'node:path'
import { exit } from 'process'
import { getTomlFileInfo, serverTomlExists, clientTomlExists, getAppNameFromToml } from './tomlFileHelpers.js'
import { LaunchInfo, ILaunchInfo } from './LaunchInfo.js'
import { IGlobalOptions } from './IGlobalOptions.js'

// TODO: validate region using $`flyctl platform regions -j` output
export async function launch(baseName: string, region: string, options: IGlobalOptions) {
  echo`Launching your Wasp app to Fly.io!`

  cd(options.waspDir)

  if (!options.skipBuild) {
    await $`wasp build`
  }

  const tomlFiles = getTomlFileInfo(options)
  const launchInfo = new LaunchInfo(baseName, region, options, tomlFiles)

  if (serverTomlExists(tomlFiles)) {
    echo`Server toml exists. Skipping server launch.`
    if (clientTomlExists(tomlFiles)) {
      echo`Client toml exists. Skipping client launch.`
    } else {
      // Infer base name from server fly.toml file.
      const serverName = getAppNameFromToml(tomlFiles.serverTomlPath)
      const inferredBaseName = serverName.replace('-server', '')

      if (baseName !== inferredBaseName) {
        echo`The base name supplied by the CLI command ${baseName} does not match the base name in your server toml file ${inferredBaseName}!`
        exit(1)
      }

      await launchClient(launchInfo)
    }
  } else {
    await launchServer(launchInfo)
  }
}

// TODO: swap commands like `rm` with something from Node for improved portability.
async function launchServer(launchInfo: ILaunchInfo) {
  cd(path.join(launchInfo.options.waspDir, '.wasp', 'build'))
  await $`rm -f fly.toml`

  echo`Launching server app with name ${launchInfo.serverName()}`
  echo`NOTE: Please do not exit this terminal session until it has completed.`

  await $`flyctl launch --no-deploy --name ${launchInfo.serverName()} --region ${launchInfo.region}`
  await $`cp -f fly.toml ${launchInfo.tomlFiles.serverTomlPath}`

  const randomString = crypto.randomBytes(32).toString('hex')
  await $`flyctl secrets set JWT_SECRET=${randomString} PORT=8080 WASP_WEB_CLIENT_URL=${launchInfo.clientUrl()}`

  // TODO: Make postgres vm size, etc. an optional param.
  await $`flyctl postgres create --name ${launchInfo.dbName()} --region ${launchInfo.region} --vm-size ${"shared-cpu-1x"} --initial-cluster-size 1 --volume-size 1`
  await $`flyctl postgres attach ${launchInfo.dbName()}`

  await question('Please take note of your database credentials above. Press any key to continue.')

  await $`flyctl deploy --remote-only`

  echo`Your server has been deployed! Starting on client now...`
  launchClient(launchInfo)
}

async function launchClient(launchInfo: ILaunchInfo) {
  echo`Launching client app with name ${launchInfo.clientName()}`

  const pwd = path.join(launchInfo.options.waspDir, '.wasp', 'build', 'web-app')
  cd(pwd)
  await $`rm -f fly.toml`

  echo`Building web client for production...`
  await $`npm install`
  await $`REACT_APP_API_URL=${launchInfo.serverUrl()} npm run build`

  // Creates the necessary Dockerfile for deploying static websites to Fly.io.
  // Adds dummy .dockerignore to supress CLI question.
  // Ref: https://fly.io/docs/languages-and-frameworks/static/
  await $`echo 'FROM pierrezemb/gostatic\nCMD [ "-fallback", "index.html" ]\nCOPY ./build/ /srv/http/' > Dockerfile`
  await $`touch .dockerignore`

  await $`flyctl launch --no-deploy --name ${launchInfo.clientName()} --region ${launchInfo.region}`

  // TODO: clean this up. Just copied from shell version.
  // goStatic listens on port 8043 by default, but the default fly.toml assumes port 8080.
  await $`cp fly.toml fly.toml.bak`
  await $`sed "s/= 8080/= 8043/1" fly.toml > fly.toml.new`
  await $`mv fly.toml.new fly.toml`

  await $`cp -f fly.toml ${launchInfo.tomlFiles.clientTomlPath}`

  await $`flyctl deploy --remote-only`

  echo`Congratulations! Your Wasp app is now accessible at ${launchInfo.clientUrl()}`
}
