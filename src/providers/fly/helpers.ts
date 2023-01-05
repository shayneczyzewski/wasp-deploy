import { exit } from 'process'
import { $, echo, question } from 'zx'
import toml from 'toml'
import fs from 'fs'
import path from 'node:path'

export async function flyctlExists(): Promise<boolean> {
  try {
    await $`command -v flyctl`
    return true
  } catch {
    return false
  }
}

export async function isUserLoggedIn(): Promise<boolean> {
  try {
    await $`flyctl auth whoami`
    return true
  } catch {
    return false
  }
}

export async function ensureUserLoggedIn() {
  const userLoggedIn = await isUserLoggedIn()
  if (!userLoggedIn) {
    let answer = await question('flyctl is not logged into Fly.io. Would you like to log in now? ')
    if (isYes(answer)) {
      try {
        await $`flyctl auth login`
      } catch {
        echo`It seems there was a problem logging in. Please run "flyctl auth login" and try again.`
        exit(1)
      }
    } else {
      echo`Ok, exiting.`
      exit(1)
    }
  }
}

function isYes(str: string): boolean {
  return str.trim().toLowerCase().startsWith('y')
}

export async function ensureFlyReady() {
  if (!await flyctlExists()) {
    echo`The Fly.io CLI is not available on this system.`
    echo`Please install the flyctl here: https://fly.io/docs/hands-on/install-flyctl`
    exit(1)
  }
  await ensureUserLoggedIn()
}

export interface GlobalOptions {
  waspDir: string
  tomlDir?: string
  skipBuild?: boolean
}

export interface TomlFilePaths {
  serverTomlPath: string
  clientTomlPath: string
}

export function getTomlFileInfo(options: GlobalOptions): TomlFilePaths {
  const baseDir = options.tomlDir || options.waspDir
  return {
    serverTomlPath: path.join(baseDir, 'fly-server.toml'),
    clientTomlPath: path.join(baseDir, 'fly-client.toml')
  }
}

export function serverTomlExists(paths: TomlFilePaths): boolean {
  return fs.existsSync(paths.serverTomlPath)
}

export function clientTomlExists(paths: TomlFilePaths): boolean {
  return fs.existsSync(paths.clientTomlPath)
}

export function getAppNameFromToml(path: string): string {
  const content = fs.readFileSync(path, 'utf8')
  const data = toml.parse(content)
  return data.app
}

export function ensureWaspDirLooksRight(thisCommand: any) {
  if (!fs.existsSync(path.join(thisCommand.opts().waspDir, '.wasproot'))) {
    echo`The supplied Wasp directory does not appear to be a valid Wasp project.`
    echo`Please double check your path.`
    exit(1)
  }
}
