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
    return await new Promise(async (resolve, reject) => {
      const fromAddress = await getUserAddress()
      const provider = createEthereumProvider()
      const metamaskRM = new eth.RequestManager(provider)
      const contractAddress =
        ContractConfig.getContractConfigByName('marketplace').address

      await getContract(contractAddress, providers.metaRequestManager).then(
        async ({ contract }) => {
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

          metamaskRM.provider.sendAsync(
            {
              method: 'eth_signTypedData_v4',
              params: [fromAddress, dataToSign],
              jsonrpc: '2.0',
              id: 999999999999
            } as RPCSendableMessage,
            async (err: any, result: any) => {
              if (err) {
                reject(err)
                return
              }
              if (result) notificationCB(lang.waitingServerResponse)
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
  domainData: domainDataType,
  domainType: Array<{ name: string; type: string }>
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
  domain: return [domainData, domainType]
}

/**
 * Return Contract, Provider and RequestManager
 *
 * @param contractAddress Smartcontract ETH address
 */
export async function getContract(
  contractAddress: eth.Address,
  requestManager?: eth.RequestManager
) {
  if (!requestManager) {
    const provider = createEthereumProvider()
    requestManager = new eth.RequestManager(provider)
  }
  const dgMarketAbi = ContractConfig.getContractConfigByName('marketplace').abi
  const factory = new eth.ContractFactory(requestManager, dgMarketAbi)
  const contract = (await factory.at(contractAddress)) as any
  return { contract, requestManager }
}
