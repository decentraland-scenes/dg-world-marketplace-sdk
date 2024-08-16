/**
 * @internal
 * This is a private interface
 */
type Position = {
  x: number
  y: number
  z: number
}

/**
 * @internal
 * This is a private interface
 */
type Scale = {
  x?: number
  y?: number
  z?: number
  all?: number
}

/**
 * @internal
 * This is a private interface
 */
type Rotation = {
  x?: number
  y?: number
  z?: number
}

/**
 * @public
 * This is a public interface
 */
export type Slot = {
  id: string
  slotName?: string
  position: Position
  scale: Scale
  rotation: Rotation
  nftAddress: string
  imageUrl: string
  tokenId: string
  resourceId: string
  price: number
  name: string
  description: string
  isDecentraland: boolean
  isWearable: boolean
  isIceCollection: boolean
  followWallet?: string
  width: number
  height: number
  audioUrl?: string
  animationUrl?: string
  youtubeUrl?: string
  zoneId: number
}
