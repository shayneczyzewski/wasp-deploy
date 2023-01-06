import toml from 'toml'
import fs from 'fs'
import path from 'node:path'
import { IGlobalOptions } from './IGlobalOptions.js'

export interface ITomlFilePaths {
  serverTomlPath: string
  clientTomlPath: string
}

export function getTomlFileInfo(options: IGlobalOptions): ITomlFilePaths {
  const baseDir = options.tomlDir || options.waspDir
  return {
    serverTomlPath: path.join(baseDir, 'fly-server.toml'),
    clientTomlPath: path.join(baseDir, 'fly-client.toml')
  }
}

export function serverTomlExists(paths: ITomlFilePaths): boolean {
  return fs.existsSync(paths.serverTomlPath)
}

export function clientTomlExists(paths: ITomlFilePaths): boolean {
  return fs.existsSync(paths.clientTomlPath)
}

export function getAppNameFromToml(path: string): string {
  const content = fs.readFileSync(path, 'utf8')
  const data = toml.parse(content)
  return data.app
}
