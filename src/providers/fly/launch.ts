import { $ } from 'zx'

export async function launch(name: string, region: string) {
  await $`ls -la`
  console.log("launch", name, region);
}
