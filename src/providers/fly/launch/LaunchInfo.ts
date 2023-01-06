import { ITomlFilePaths } from '../helpers/tomlFileHelpers.js'
import { IGlobalOptions } from '../IGlobalOptions.js'

export interface ILaunchInfo {
  readonly baseName: string
  readonly region: string
  readonly options: IGlobalOptions
  readonly tomlFiles: ITomlFilePaths

  clientName(): string
  clientUrl(): string
  serverName(): string
  serverUrl(): string
  dbName(): string
}

export class LaunchInfo implements ILaunchInfo {
  baseName: string
  region: string
  options: IGlobalOptions
  tomlFiles: ITomlFilePaths

  constructor(baseName: string, region: string, options: IGlobalOptions, tomlFiles: ITomlFilePaths) {
    this.baseName = baseName
    this.region = region
    this.options = options
    this.tomlFiles = tomlFiles
  }

  clientName(): string {
    return `${this.baseName}-client`
  }

  clientUrl(): string {
    return `https://${this.clientName()}.fly.dev`
  }

  serverName(): string {
    return `${this.baseName}-server`
  }

  serverUrl(): string {
    return `https://${this.serverName()}.fly.dev`
  }

  dbName(): string {
    return `${this.baseName}-db`
  }
}
