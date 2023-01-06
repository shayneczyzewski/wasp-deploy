import { Command } from 'commander'
import { $, echo } from 'zx'
import { cdToClientDir, cdToServerDir } from '../helpers/helpers.js'
import { clientTomlExists, getTomlFileInfo, ITomlFilePaths, localTomlExists, serverTomlExists } from '../helpers/tomlFileHelpers.js'
import { ICmdOptions, SERVER_CONTEXT_OPTION } from './ICmdOptions.js'

// Runs a command by copying down the toml files, executing it, and copying it back up (just in case).
// If the toml file does not exist, some commands will not run with additional args.
export async function cmd(cmdArgs: [string], options: ICmdOptions, command: any) {
  const tomlFiles = getTomlFileInfo(options)
  let cdFn: (waspDir: string) => void
  let tomlExistsFn: (tomlFiles: ITomlFilePaths) => boolean
  let tomlPath: string

  if (options.context === SERVER_CONTEXT_OPTION) {
    cdFn = cdToServerDir
    tomlExistsFn = serverTomlExists
    tomlPath = tomlFiles.serverTomlPath
  } else {
    cdFn = cdToClientDir
    tomlExistsFn = clientTomlExists
    tomlPath = tomlFiles.clientTomlPath
  }

  echo`Running ${options.context} command: flyctl ${cmdArgs.join(' ')}`

  cdFn(options.waspDir)
  await $`rm -f fly.toml`
  if (tomlExistsFn(tomlFiles)) {
    await $`cp ${tomlPath} fly.toml`
  }

  try {
    await $`flyctl ${cmdArgs}`
  } catch {
    await echo`Error running command. Note: many commands require a toml file or a -a option specifying the app name.`
    await echo`If you already have an app, consider running "config save -- -a <app-name>".`
    console.log(Object.getOwnPropertyNames(command))
    console.log(command.rawArgs)
  }

  if (localTomlExists()) {
    await $`cp -f fly.toml ${tomlPath}`
  }
}
