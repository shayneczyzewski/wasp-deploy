import { exit } from 'process'
import { $, cd, echo } from 'zx'
import { cdToClientDir, cdToServerDir } from '../helpers/helpers.js'
import { clientTomlExists, getAppNameFromToml, getTomlFileInfo, serverTomlExists } from '../helpers/tomlFileHelpers.js'
import { IGlobalOptions } from '../IGlobalOptions.js'
import { IDeploymentInfo, DeploymentInfo } from '../DeploymentInfo.js'

export async function deploy(options: IGlobalOptions) {
  echo`Deploying your Wasp app to Fly.io!`

  cd(options.waspDir)

  // TODO: Only do this if one deploy will actually happen. Same in deploy.ts
  if (!options.skipBuild) {
    await $`wasp build`
  }

  const tomlFiles = getTomlFileInfo(options)

  if (!serverTomlExists(tomlFiles)) {
    echo`Server toml missing. Skipping server deploy. Perhaps you need to run the "setup" command first?`
  } else {
    const serverName = getAppNameFromToml(tomlFiles.serverTomlPath)
    const inferredBaseName = serverName.replace('-server', '')
    const deploymentInfo = new DeploymentInfo(inferredBaseName, undefined, options, tomlFiles)
    await deployServer(deploymentInfo)
  }

  if (!clientTomlExists(tomlFiles)) {
    echo`Client toml missing. Skipping client deploy. Perhaps you need to run the "setup" command first?`
  } else {
    const clientName = getAppNameFromToml(tomlFiles.clientTomlPath)
    const inferredBaseName = clientName.replace('-client', '')
    const deploymentInfo = new DeploymentInfo(inferredBaseName, undefined, options, tomlFiles)
    await deployClient(deploymentInfo)
  }
}

async function deployServer(deploymentInfo: IDeploymentInfo) {
  echo`Deploying your server now...`

  cdToServerDir(deploymentInfo.options.waspDir)
  await $`cp -f ${deploymentInfo.tomlFiles.serverTomlPath} fly.toml`

  // Make sure we have a DATABASE_URL present. If not, they need to create/attach their DB first.
  try {
    const proc = await $`flyctl secrets list -j`
    const secrets = JSON.parse(proc.stdout)
    if (!secrets.find((s: any) => s.Name === 'DATABASE_URL')) {
      echo`Your server app does not have a DATABASE_URL secret set. Perhaps you need to create or attach your database?`
      exit(1)
    }
  } catch {
    echo`Unable to check for DATABASE_URL secret.`
    exit(1)
  }

  await $`flyctl deploy --remote-only`

  echo`Server has been deployed!`
}

async function deployClient(deploymentInfo: IDeploymentInfo) {
  echo`Deploying your client now...`

  cdToClientDir(deploymentInfo.options.waspDir)
  await $`cp -f ${deploymentInfo.tomlFiles.clientTomlPath} fly.toml`

  echo`Building web client for production...`
  await $`npm install`
  await $`REACT_APP_API_URL=${deploymentInfo.serverUrl()} npm run build`

  // Creates the necessary Dockerfile for deploying static websites to Fly.io.
  // Adds dummy .dockerignore to supress CLI question.
  // Ref: https://fly.io/docs/languages-and-frameworks/static/
  await $`echo 'FROM pierrezemb/gostatic\nCMD [ "-fallback", "index.html" ]\nCOPY ./build/ /srv/http/' > Dockerfile`
  await $`touch .dockerignore`

  await $`flyctl deploy --remote-only`

  echo`Client has been deployed! Your Wasp app is accessible at: ${deploymentInfo.clientUrl()}`
}
