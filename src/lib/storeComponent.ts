import * as eth from 'eth-connect'
import { getExecuteMetaTransactionData } from '../util/index'
import { type Providers } from '../types/index'
import { type LangText } from '../interfaces/index'
import ContractConfig from './contractConfig'
import { getUserAddress } from '../util/wallet'
import {
  createEthereumProvider,
  type RPCSendableMessage
} from '@dcl/sdk/ethereum-provider'
export const createStoreComponent = ({
  providers,
  lang
}: {
  providers: Providers
  lang: LangText
}): {
  buy: (
    collectionId: string,
    blockchainIds: string[],
    tokenPrice: number,
    notificationCB: (text: string) => void
  ) => Promise<string>
} => {
  async function buy(
    collectionId: string,
    blockchainIds: string[],
    tokenPrice: number,
    notificationCB = (text: string) => {}
  ): Promise<string> {
    const fromAddress = await getUserAddress()
    const provider = createEthereumProvider()
    const metamaskRM = new eth.RequestManager(provider)
    const contractAddress =
      ContractConfig.getContractConfigByName('marketplace').address
    const { contract } = await getContract(
      contractAddress,
      providers.metaRequestManager
    )

    const approveHex = await contract.buy.toPayload(
      collectionId,
      blockchainIds,
      [eth.toWei(tokenPrice.toString(), 'ether')]
    )
    const [domainData, domainType] = getDomainData()
    const metaTransactionType = [
      { name: 'nonce', type: 'uint256' },
      { name: 'from', type: 'address' },
      { name: 'functionSignature', type: 'bytes' }
    ]

    const nonce = await contract.getNonce(fromAddress)

    const message = {
      nonce: nonce.toString(),
      from: fromAddress,
      functionSignature: approveHex.data
    }
    const dataToSign = JSON.stringify({
      types: {
        EIP712Domain: domainType,
        MetaTransaction: metaTransactionType
      },
      domain: domainData,
      primaryType: 'MetaTransaction',
      message
    })

    return await new Promise<string>((resolve, reject) => {
      metamaskRM.provider.sendAsync(
        {
          method: 'eth_signTypedData_v4',
          params: [fromAddress, dataToSign],
          jsonrpc: '2.0',
          id: 999999999999
        } satisfies RPCSendableMessage,
        async (err: any, result: any) => {
          if (err !== undefined) {
            reject(err)
            return
          }
          if (result !== undefined) notificationCB(lang.waitingServerResponse)
          const contractAddress =
            ContractConfig.getContractConfigByName('marketplace').address

          const res: Response = await fetch(
            `https://meta-tx-server.dglive.org/v1/transactions`,
            {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionData: {
                  from: fromAddress,
                  params: [
                    contractAddress,
                    getExecuteMetaTransactionData(
                      fromAddress,
                      result.result,
                      approveHex.data
                    )
                  ]
                }
              }),
              method: 'POST'
            }
          )
          if (!res.ok) {
            throw new Error(res.statusText)
          }
          const parsedResponse = await res.json()
          const { txHash } = parsedResponse as { txHash: string }
          resolve(txHash)
        }
      )
    })
  }

  return { buy }
}

type domainDataType = {
  name: string
  version: string
  salt: string
  verifyingContract: string
}
export const getDomainData = (): [
  domainDataType,
  Array<{ name: string; type: string }>
] => {
  const domainData =
    ContractConfig.getContractConfigByName('marketplace').domain
  const domainType =
    ContractConfig.getContractConfigByName('marketplace').domainType

  // const domainData: domainDataType = {
  //   name: 'DGMarketplace',
  //   version: 'v1.0',
  //   verifyingContract: config.contractAddress,
  //   chainId: 1
  // }

  // const domainType = [
  //   { name: 'name', type: 'string' },
  //   { name: 'version', type: 'string' },
  //   { name: 'chainId', type: 'uint256' },
  //   { name: 'verifyingContract', type: 'address' }
  // ]
  return [domainData, domainType]
}

/**
 * Return Contract, Provider and RequestManager
 *
 * @param contractAddress Smartcontract ETH address
 */
export async function getContract(
  contractAddress: eth.Address,
  requestManager?: eth.RequestManager
): Promise<{
  contract: any
  requestManager: eth.RequestManager
}> {
  if (requestManager === undefined) {
    const provider = createEthereumProvider()
    requestManager = new eth.RequestManager(provider)
  }
  const dgMarketAbi = ContractConfig.getContractConfigByName('marketplace').abi
  const factory = new eth.ContractFactory(requestManager, dgMarketAbi)
  const contract = (await factory.at(contractAddress)) as any
  return { contract, requestManager }
}
