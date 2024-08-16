import { engine } from '@dcl/sdk/ecs'

const nextTickFuture: Array<() => void> = []

export async function waitNextTick(): Promise<void> {
  await new Promise<void>((resolve) => {
    nextTickFuture.push(resolve)
  })
}

engine.addSystem(function () {
  while (nextTickFuture.length > 0) {
    nextTickFuture.shift()?.()
  }
})
