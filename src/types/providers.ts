import { type createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { type RequestManager, type HTTPProvider } from 'eth-connect'

export type Provider = ReturnType<typeof createEthereumProvider>

export type Providers = {
  provider: Provider
  requestManager: RequestManager
  metaProvider: HTTPProvider
  metaRequestManager: RequestManager
  fromAddress: string
}
