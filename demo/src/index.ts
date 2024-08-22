import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import * as test from 'dg-marketplace-world-skd7-migrated'
import { ui } from './ui'

// const mockedSlot: test.Slot[] = {
// id: string;
// slotName?: string;
// position: Position;
// scale: Scale;
// rotation: Rotation;
// nftAddress: string;
// imageUrl: string;
// tokenId: string;
// resourceId: string;
// price: number;
// name: string;
// description: string;
// isDecentraland: boolean;
// isWearable: boolean;
// isIceCollection: boolean;
// followWallet?: string;
// width: number;
// height: number;
// audioUrl?: string;
// animationUrl?: string;
// youtubeUrl?: string;
// zoneId: number;
// }

export function main(): void {
  console.log('Hello world!')
  const some = new test.DgWorldMarketplace({
    network: test.Network.MATIC,
    debug: true,
    zoneId: 36
  })
  //   some.slots = [mockedSlot]

  some.on('ready', () => {
    console.log('ready')
  })
  some.on('error', (error) => {
    console.error(error)
  })
  some.on('variablesReady', () => {
    console.log('variablesReady', some.getVariables())
  })
  some.on('web3Ready', () => {
    console.log('web3Ready')
  })
  some.on('websocketsReady', () => {
    console.log('websocketsReady')
  })

  console.log(some)
  ReactEcsRenderer.setUiRenderer(() => [some.render(), ui()])
}
