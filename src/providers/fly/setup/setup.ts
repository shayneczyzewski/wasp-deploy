import { $, cd, echo } from 'zx'
import { exit } from 'process'
import crypto from 'crypto'
import { getTomlFileInfo, serverTomlExists, clientTomlExists, getAppNameFromToml } from '../helpers/tomlFileHelpers.js'
import { DeploymentInfo, IDeploymentInfo } from '../DeploymentInfo.js'
import { IGlobalOptions } from '../IGlobalOptions.js'
import { cdToClientDir, cdToServerDir } from '../helpers/helpers.js'

// TODO: validate region using $`flyctl platform regions -j` output
export async function setup(baseName: string, region: string, options: IGlobalOptions) {
  echo`Setting up your Wasp app to Fly.io!`

  cd(options.waspDir)

  if (!options.skipBuild) {
    await $`wasp build`
  }

  const tomlFiles = getTomlFileInfo(options)
  const deploymentInfo = new DeploymentInfo(baseName, region, options, tomlFiles)

  if (serverTomlExists(tomlFiles)) {
    echo`Server toml exists. Skipping server setup.`
  } else {
    await setupServer(deploymentInfo)
  }

  if (clientTomlExists(tomlFiles)) {
    echo`Client toml exists. Skipping client setup.`
  } else {
    // This case should only happen if the program dies/quits after the server
    // is setup, but before the client finishes. This should be very rare.

    // Infer base name from server fly.toml file.
    const serverName = getAppNameFromToml(tomlFiles.serverTomlPath)
    const inferredBaseName = serverName.replace('-server', '')

    if (baseName !== inferredBaseName) {
      echo`The base name supplied by the CLI command ${baseName} does not match the base name in your server toml file ${inferredBaseName}!`
      exit(1)
    }

    await setupClient(deploymentInfo)
  }
}

// TODO: Swap commands like `rm` with something from Node for improved portability.
async function setupServer(deploymentInfo: IDeploymentInfo) {
  echo`Setting up server app with name ${deploymentInfo.serverName()}`

  cdToServerDir(deploymentInfo.options.waspDir)
  await $`rm -f fly.toml`

  // This creates the fly.toml file, but does not attempt to deploy.
  await $`flyctl launch --no-deploy --name ${deploymentInfo.serverName()} --region ${deploymentInfo.region}`
  await $`cp -f fly.toml ${deploymentInfo.tomlFiles.serverTomlPath}`

  const randomString = crypto.randomBytes(32).toString('hex')
  await $`flyctl secrets set JWT_SECRET=${randomString} PORT=8080 WASP_WEB_CLIENT_URL=${deploymentInfo.clientUrl()}`

  echo`Server setup complete!`
  echo`Don't forget to create your database by running the "create-db" command.`
}

// TODO: Clean this up. Just copied from shell version.
async function setupClient(deploymentInfo: IDeploymentInfo) {
  echo`Setting up client app with name ${deploymentInfo.clientName()}`

  cdToClientDir(deploymentInfo.options.waspDir)
  await $`rm -f fly.toml`

  // This creates the fly.toml file, but does not attempt to deploy.
  await $`flyctl launch --no-deploy --name ${deploymentInfo.clientName()} --region ${deploymentInfo.region}`

  // goStatic listens on port 8043 by default, but the default fly.toml assumes port 8080.
  await $`cp fly.toml fly.toml.bak`
  await $`sed "s/= 8080/= 8043/1" fly.toml > fly.toml.new`
  await $`mv fly.toml.new fly.toml`

  await $`cp -f fly.toml ${deploymentInfo.tomlFiles.clientTomlPath}`

  echo`Client setup complete!`
}
