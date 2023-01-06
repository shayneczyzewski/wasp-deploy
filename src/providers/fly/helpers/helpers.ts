import { exit } from 'process'
import { echo, cd } from 'zx'
import fs from 'fs'
import path from 'node:path'

export function isYes(str: string): boolean {
  return str.trim().toLowerCase().startsWith('y')
}

export function ensureWaspDirLooksRight(thisCommand: any) {
  if (!fs.existsSync(path.join(thisCommand.opts().waspDir, '.wasproot'))) {
    echo`The supplied Wasp directory does not appear to be a valid Wasp project.`
    echo`Please double check your path.`
    exit(1)
  }
}

export function cdToServerDir(waspDir: string) {
  cd(path.join(waspDir, '.wasp', 'build'))
}

export function cdToClientDir(waspDir: string) {
  cd(path.join(waspDir, '.wasp', 'build', 'web-app'))
}
