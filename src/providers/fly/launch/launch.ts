import { $, cd, echo, question } from 'zx'
import crypto from 'crypto'
import { exit } from 'process'
import { getTomlFileInfo, serverTomlExists, clientTomlExists, getAppNameFromToml } from '../helpers/tomlFileHelpers.js'
import { LaunchInfo, ILaunchInfo } from './LaunchInfo.js'
import { IGlobalOptions } from '../IGlobalOptions.js'
import { cdToClientDir, cdToServerDir } from '../helpers/helpers.js'

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
  } else {
    await launchServer(launchInfo)
  }

  if (clientTomlExists(tomlFiles)) {
    echo`Client toml exists. Skipping client launch.`
  } else {
    // This case should only happen if the program dies/quits after the server
    // is deployed, but before the client finishes.

    // Infer base name from server fly.toml file.
    const serverName = getAppNameFromToml(tomlFiles.serverTomlPath)
    const inferredBaseName = serverName.replace('-server', '')

    if (baseName !== inferredBaseName) {
      echo`The base name supplied by the CLI command ${baseName} does not match the base name in your server toml file ${inferredBaseName}!`
      exit(1)
    }

    await launchClient(launchInfo)
  }
}

// TODO: Swap commands like `rm` with something from Node for improved portability.
async function launchServer(launchInfo: ILaunchInfo) {
  cdToServerDir(launchInfo.options.waspDir)
  await $`rm -f fly.toml`

  echo`Launching server app with name ${launchInfo.serverName()}`
  echo`NOTE: Please do not exit this terminal session until it has completed.`

  // This creates the fly.toml file, but does not attempt to deploy. We want
  // the DB up first, link it to the app, then deploy the app.
  await $`flyctl launch --no-deploy --name ${launchInfo.serverName()} --region ${launchInfo.region}`
  await $`cp -f fly.toml ${launchInfo.tomlFiles.serverTomlPath}`

  const randomString = crypto.randomBytes(32).toString('hex')
  await $`flyctl secrets set JWT_SECRET=${randomString} PORT=8080 WASP_WEB_CLIENT_URL=${launchInfo.clientUrl()}`

  // TODO: Make postgres vm size, etc. an optional param.
  // Creates a DB, waits for it to come up, then links it to the app.
  // The attachment process shares the DATABASE_URL secret.
  await $`flyctl postgres create --name ${launchInfo.dbName()} --region ${launchInfo.region} --vm-size ${'shared-cpu-1x'} --initial-cluster-size 1 --volume-size 1`
  await $`flyctl postgres attach ${launchInfo.dbName()}`

  await question('Please take note of your database credentials above. Press any key to continue.')

  // DB is up, app is linked and ready to deploy. Deploy remotely so it builds
  // on Fly.io and does not require a local Docker daemon running.
  await $`flyctl deploy --remote-only`

  echo`Your server has been deployed!`
}

// TODO: Clean this up. Just copied from shell version.
async function launchClient(launchInfo: ILaunchInfo) {
  echo`Launching client app with name ${launchInfo.clientName()}`

  cdToClientDir(launchInfo.options.waspDir)
  await $`rm -f fly.toml`

  echo`Building web client for production...`
  await $`npm install`
  await $`REACT_APP_API_URL=${launchInfo.serverUrl()} npm run build`

  // Creates the necessary Dockerfile for deploying static websites to Fly.io.
  // Adds dummy .dockerignore to supress CLI question.
  // Ref: https://fly.io/docs/languages-and-frameworks/static/
  await $`echo 'FROM pierrezemb/gostatic\nCMD [ "-fallback", "index.html" ]\nCOPY ./build/ /srv/http/' > Dockerfile`
  await $`touch .dockerignore`

  // Creates a fly.toml but does not deploy. We need to patch up that file a bit first.
  await $`flyctl launch --no-deploy --name ${launchInfo.clientName()} --region ${launchInfo.region}`

  // goStatic listens on port 8043 by default, but the default fly.toml assumes port 8080.
  await $`cp fly.toml fly.toml.bak`
  await $`sed "s/= 8080/= 8043/1" fly.toml > fly.toml.new`
  await $`mv fly.toml.new fly.toml`

  await $`cp -f fly.toml ${launchInfo.tomlFiles.clientTomlPath}`

  await $`flyctl deploy --remote-only`

  echo`Congratulations! Your Wasp app is now accessible at ${launchInfo.clientUrl()}`
}
