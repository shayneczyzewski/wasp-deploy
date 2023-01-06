import { exit } from 'process'
import { $, echo, question } from 'zx'
import { isYes } from './helpers.js'

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

export async function ensureFlyReady() {
  if (!await flyctlExists()) {
    echo`The Fly.io CLI is not available on this system.`
    echo`Please install the flyctl here: https://fly.io/docs/hands-on/install-flyctl`
    exit(1)
  }
  await ensureUserLoggedIn()
}

export async function ensureRegionIsValid(region: string) {
  try {
    const proc = await $`flyctl platform regions -j`
    const regions = JSON.parse(proc.stdout)
    if (!regions.find((r: any) => r.Code === region)) {
      echo`Invalid region ${region}. Please specify a valid 3 character region id: https://fly.io/docs/reference/regions`
      exit(1)
    }
  } catch {
    // Ignore any errors while checking. Commands requiring a valid region will still fail if invalid, just not as nicely.
    echo`Unable to validate region before calling flyctl.`
  }
}
