import { exit } from 'process'
import { echo } from 'zx'
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
