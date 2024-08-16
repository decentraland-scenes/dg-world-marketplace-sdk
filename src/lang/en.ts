import { type LangText } from '../interfaces/index'

const en: LangText = {
  noFundsTitle: 'No Funds',
  noFundsDesc: 'Sorry, you do not have enough BAG',
  noFundsButton: 'No Funds',
  noBag: 'No BAG',
  noBagDesc: 'Sorry, you do not have BAG to make any purchase',
  approveBagTitle: 'Approve BAG',
  approveBagDesc:
    'Authorize the Store contract to operate BAG on your behalf. We will open the allowance form in a new tab for you to approve.',
  approveBagWait: 'Please wait. The transaction is being processed',
  approveBagRejected:
    'You need to authorize the Store contract to be able to buy this item',
  buyFor: 'Buy for:',
  authorize: 'Authorize',
  reject: 'Reject',
  transactionProccessing: 'Please wait. The transaction is being processed',
  purchaseSucceed:
    'Purchased succeed! You will need to refresh the page to see the wearable in your backpack.',
  purchaseFailed: 'Purchased failed. Please try again.',
  wait: 'Wait',
  buy: 'Buy',
  openPaymentLink: 'Open Payment Link',
  nftNotAvailable: 'NFT not available',
  waitingServerResponse: 'Waiting server response',
  buyingNFT: 'Buying NFT...',
  buyCanceled: 'Buy canceled',
  buyWithBag: 'Buy with BAG',
  buyWithBinance: 'Buy with Binance',
  buyWithCoinbase: 'Buy with Coinbase',
  buyWithPaper: 'Buy with Paper',
  genericError: 'An error has occurred',
  generatingPaymentLink: 'Generating payment link...',
  generatingPaymentLinkAndQR: 'Generating payment link and QR...',
  listingCanceled: 'Listing canceled',
  purchaseRefunded: 'Purchase refunded',
  waitingCoinbase:
    'Waiting for Coinbase payment confirmation. This can take up to 1 hour.',
  coinbasePaymentConfirmed: 'Coinbase payment confirmed'
}

Object.freeze(en)

export { en }
