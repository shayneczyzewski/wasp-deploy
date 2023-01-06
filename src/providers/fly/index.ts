import { Command, Option } from 'commander'
import { launch as launchFn } from './launch/launch.js'
import { deploy as deployFn } from './deploy/deploy.js'
import { cmd as cmdFn } from './cmd/cmd.js'
import { ensureWaspDirLooksRight } from './helpers/helpers.js'
import { ensureFlyReady } from './helpers/flyctlHelpers.js'

export function addFlyCommand(program: Command) {
  const fly = program.command('fly')
  fly.description('Deploy to Fly.io')
    .addCommand(makeFlyLaunchCommand())
    .addCommand(makeFlyDeployCommand())
    .addCommand(makeExecuteFlyCommand())

  fly.commands.forEach((cmd) => {
    cmd.requiredOption('--wasp-dir <dir>', 'path to Wasp project')
      .option('--toml-dir <dir>', 'path to where fly.toml files should live')
      .hook('preAction', ensureFlyReady)
      .hook('preAction', ensureWaspDirLooksRight)
  })
}

function makeFlyLaunchCommand(): Command {
  const launch = new Command('launch')
  launch.description('Launch a new app on Fly.io')
    .argument('<basename>', 'base app name to use on Fly.io')
    .argument('<region>', 'deployment region to use on Fly.io')
    .option('--skip-build')
    .action(launchFn)
  return launch
}

function makeFlyDeployCommand(): Command {
  const deploy = new Command('deploy')
  deploy.description('Redeploy existing app to Fly.io')
    .option('--skip-build')
    .action(deployFn)
  return deploy
}

function makeExecuteFlyCommand(): Command {
  const cmd = new Command('cmd')
  const context = new Option('--context <context>', 'client or server context')
    .choices(['server', 'client'])
    .makeOptionMandatory()
  cmd.description('Run arbitrary flyctl commands for server or client')
    .argument('<cmd...>', 'flyctl command to run in server/client context')
    .addOption(context)
    .action(cmdFn)
  return cmd
}
