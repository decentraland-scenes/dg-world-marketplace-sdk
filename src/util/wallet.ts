import { getPlayer } from '@dcl/sdk/src/players'
import { waitNextTick } from './engine'

export async function ensurePlayer(): Promise<
  Exclude<ReturnType<typeof getPlayer>, null>
> {
  let player = getPlayer()
  if (player !== null) return player

  do {
    await waitNextTick()
    player = getPlayer()
  } while (player === null)

  return player
}
export async function getUserAddress(): Promise<string> {
  const player = await ensurePlayer()
  return player.userId
}
