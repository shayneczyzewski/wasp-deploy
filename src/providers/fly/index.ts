import { Command, Option } from 'commander';
import { launch as launchFn } from './launch.js';
import { deploy as deployFn } from './deploy.js';
import { cmd as cmdFn } from './cmd.js';

export function addFlyCommand(program: Command) {
  const fly = program.command('fly');
  fly.description('Deploy to Fly.io')
    .addCommand(makeFlyLaunchCommand())
    .addCommand(makeFlyDeployCommand())
    .addCommand(makeExecuteFlyCommand())
    .requiredOption('--wasp-dir <dir>', 'path to Wasp project')
    .option('--toml-dir <dir>', 'path to where fly.toml files should live');
}

function makeFlyLaunchCommand(): Command {
  const launch = new Command('launch');
  launch.description('Launch a new app on Fly.io')
    .argument('<name>', 'app name to use on Fly.io')
    .argument('<region>', 'deployment region to use on Fly.io')
    .action(launchFn);
  return launch;
}

function makeFlyDeployCommand(): Command {
  const deploy = new Command('deploy');
  deploy.description('Redeploy existing app to Fly.io')
    .action(deployFn);
  return deploy;
}

function makeExecuteFlyCommand(): Command {
  const cmd = new Command('cmd');
  const context = new Option('--context <context>', 'client or server context')
    .choices(['server', 'client'])
    .makeOptionMandatory();
  cmd.description('Run arbitrary flyctl commands for server or client')
    .argument('<cmd...>', 'flyctl command to run in server/client context')
    .addOption(context)
    .action(cmdFn);
  return cmd;
}
