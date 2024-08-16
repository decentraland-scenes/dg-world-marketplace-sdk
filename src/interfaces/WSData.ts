type InftData = {
  id: number
  tokenId: string
  price: number
  hashDescription: string
  idDescription: number
  description: string
  idResourceGroup: number
  imageUrl: string
  idNftAddress: number
  nftAddress: string
  name: string
  symbol: string
  isWearable: boolean
  isIceCollection: boolean
  isDecentraland: boolean
  active: boolean
  resourceId: string
  idAnimation: number
  animationUrl: string
  idUri: number
  uriUrl: string
  idYoutube: number
  youtubeUrl: string
  idSeller: number
  sellerAddress: string
  isVerifyedCreator: boolean
  width: number
  height: number
}

export type JoystickBaseData = {
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
  key: string
  zoneId: number
  save: boolean
  // type: 'slot' | 'banner'
}

export type JoystickSlotData = {
  type: 'slot'
  resourceId: string
  tokenId: string
  slotId: string
} & JoystickBaseData

export type JoystickBannerData = {
  type: 'banner'
  bannerId: string
} & JoystickBaseData

export type ReplaceNftDataPayload = {
  resourceId: string
  tokenId: string
  nextSellerNft?: InftData
  nextMarketplaceNft?: InftData
  newMarketplaceNft?: InftData
  joystickData?: JoystickBannerData | JoystickSlotData
}

export type ReplaceNftData = {
  status: 'success'
  type: 'buy' | 'sell' | 'cancel' | 'joystick'
  payload: ReplaceNftDataPayload
}
