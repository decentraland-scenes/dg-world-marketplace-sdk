import { type IEngine } from '@dcl/sdk/ecs'
import * as components from '@dcl/sdk/ecs'

import DgWorldMarketplace from './lib/dgWorldMarketplace'

export function initLibrary(engine: IEngine) {
  console.log('asdikaosmdoia')
  components.MeshRenderer.create(engine.addEntity())
}
export * from './interfaces/index'

export { DgWorldMarketplace }
