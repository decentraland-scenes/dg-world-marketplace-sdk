import {
  RequestManager,
  ContractFactory,
  type Address,
  fromWei
} from 'eth-connect'

import { type Providers } from '../types/index'
import { getExecuteMetaTransactionData } from '../util/index'
import ContractConfig from './contractConfig'
import { getUserAddress } from '../util/wallet'
import {
  createEthereumProvider,
  type RPCSendableMessage
} from '@dcl/sdk/ethereum-provider'

export const createMANAComponent = ({
  requestManager,
  metaRequestManager,
  fromAddress
}: Providers): {
  balance: () => Promise<string>
  isApproved: (spenderAddress: string) => Promise<number>
  approve: (spenderAddress: string, amount?: number) => Promise<string>
} => {
  const balance = async (): Promise<string> => {
    try {
      const bagContractAddress =
        ContractConfig.getContractConfigByName('bag').address
      const fromAddress = await getUserAddress()
      const { contract } = await getContract(
        bagContractAddress,
        metaRequestManager
      )
      const balance = await contract.balanceOf(fromAddress)
      return balance.toString()
    } catch (err) {
      console.log('Error getting balance: ', err)

      throw err
    }
  }

  const isApproved = async (spender: string): Promise<any> => {
    const fromAddress = await getUserAddress()

    const bagContractAddress =
      ContractConfig.getContractConfigByName('bag').address
    const { contract } = await getContract(
      bagContractAddress,
      metaRequestManager
    )
    const balance = await contract.allowance(fromAddress, spender)

    return +fromWei(balance.toString(), 'ether')
  }

  const approve = async (spender: string): Promise<string> => {
    const fromAddress = await getUserAddress()
    const provider = createEthereumProvider()
    const metamaskRM = new RequestManager(provider)
    const bagContractAddress =
      ContractConfig.getContractConfigByName('bag').address
    const { contract } = await getContract(
      bagContractAddress,
      metaRequestManager
    )
    const approveHex = await contract.approve.toPayload(
      spender,
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
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

    return await new Promise((resolve, reject) => {
      metamaskRM.provider.sendAsync(
        {
          method: 'eth_signTypedData_v4',
          // method: 'signTypedData',
          params: [fromAddress, dataToSign],
          jsonrpc: '2.0',
          id: 999999999999
        } satisfies RPCSendableMessage,
        async (err: any, result: any) => {
          if (err !== undefined) {
            console.log(err)

            reject(err)
            return
          }
          const bagContractAddress =
            ContractConfig.getContractConfigByName('bag').address

          console.log(
            JSON.stringify(
              {
                transactionData: {
                  from: fromAddress,
                  params: [
                    bagContractAddress,
                    getExecuteMetaTransactionData(
                      fromAddress,
                      result.result,
                      approveHex.data
                    )
                  ]
                }
              },
              null,
              2
            )
          )

          const res: Response = await fetch(
            `https://meta-tx-server.dglive.org/v1/transactions`,
            {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionData: {
                  from: fromAddress,
                  params: [
                    bagContractAddress,
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
            reject(res.statusText)
            return
          }
          const { txHash } = (await res.json()) as { txHash: string }
          resolve(txHash)
        }
      )
    })
  }

  return {
    balance,
    isApproved,
    approve
  }
}

/**
 * Return Contract, Provider and RequestManager
 *
 * @param contractAddress Smartcontract ETH address
 * @param requestManager RequestManager
 */
export const getContract = async (
  contractAddress: Address,
  requestManager: RequestManager
): Promise<{
  contract: any
  requestManager: RequestManager
}> => {
  const bagAbi = ContractConfig.getContractConfigByName('bag').abi
  const factory = new ContractFactory(requestManager, bagAbi)
  const contract = await factory.at(contractAddress)
  return { contract, requestManager }
}

/**
 * Return DomainData
 */
export function getDomainData(): [any, any] {
  const domainType = ContractConfig.getContractConfigByName('bag').domainType
  const domainData = ContractConfig.getContractConfigByName('bag').domain
  return [domainData, domainType]
}
