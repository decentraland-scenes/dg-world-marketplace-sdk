export type Wearable = {
  bodyShapes: string[]
  category: string
  description: string
  rarity: string
  isSmart: boolean
}

export type Data = {
  wearable: Wearable
}

export type Nft = {
  id: string
  tokenId: string
  contractAddress: string
  category: string
  activeOrderId?: any
  owner: string
  name: string
  image: string
  url: string
  data: Data
  issuedId: string
  itemId: string
  network: string
  chainId: number
  createdAt: number
  updatedAt: number
  soldAt: number
}

export type Ntfs = {
  nft: Nft
  order?: any
}

export type NftData = {
  ntfs: Ntfs[]
  total: number
}
