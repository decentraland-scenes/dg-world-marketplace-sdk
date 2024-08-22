import type * as ISlot from './Slot.interface'

/**
 * @public
 * PreviewEnv options
 */
export enum PreviewEnv {
  PROD = 'prod',
  DEV = 'dev'
}

/**
 * @public
 * Network options
 */
export enum Network {
  ETHEREUM = 'ETHEREUM',
  MATIC = 'MATIC'
}

/**
 * @public
 * LangText options for the language of the marketplace
 */
export type LangText = {
  noFundsTitle: string
  noFundsDesc: string
  noFundsButton: string
  noBag: string
  noBagDesc: string
  approveBagTitle: string
  approveBagDesc: string
  approveBagWait: string
  approveBagRejected: string
  buyFor: string
  authorize: string
  reject: string
  transactionProccessing: string
  purchaseSucceed: string
  purchaseFailed: string
  wait: string
  buy: string
  openPaymentLink: string
  nftNotAvailable: string
  waitingServerResponse: string
  buyWithBag: string
  buyingNFT: string
  buyCanceled: string
  buyWithBinance: string
  buyWithCoinbase: string
  buyWithPaper: string
  genericError: string
  generatingPaymentLink: string
  generatingPaymentLinkAndQR: string
  listingCanceled: string
  purchaseRefunded: string
  waitingCoinbase: string
  coinbasePaymentConfirmed: string
}

/**
 * @public
 * MarketplaceOptions options for the marketplace creation
 */
export type MarketplaceOptions = {
  slots?: ISlot.Slot[]
  previewEnv?: PreviewEnv
  network: Network
  zoneId?: number
  debug?: boolean
  lang?: {
    noFundsTitle?: string
    noFundsDesc?: string
    noFundsButton?: string
    noBag?: string
    noBagDesc?: string
    approveBagTitle?: string
    approveBagDesc?: string
    approveBagWait?: string
    approveBagRejected?: string
    buyFor?: string
    authorize?: string
    reject?: string
    transactionProccessing?: string
    purchaseSucceed?: string
    purchaseFailed?: string
    wait?: string
    buy?: string
    openPaymentLink?: string
    nftNotAvailable?: string
    waitingServerResponse?: string
    buyWithBag?: string
    buyingNFT?: string
    buyCanceled?: string
    buyWithBinance?: string
    buyWithCoinbase?: string
    buyWithPaper?: string
    genericError?: string
    generatingPaymentLink?: string
    generatingPaymentLinkAndQR?: string
    listingCanceled?: string
    purchaseRefunded?: string
    waitingCoinbase?: string
    coinbasePaymentConfirmed?: string
  }
}
