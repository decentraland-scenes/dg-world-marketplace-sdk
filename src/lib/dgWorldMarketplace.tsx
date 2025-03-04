import {
  AvatarShape,
  engine,
  executeTask,
  Material,
  MeshCollider,
  MeshRenderer,
  pointerEventsSystem,
  Transform,
  VideoPlayer,
  type Entity
} from '@dcl/sdk/ecs'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { LoopSystem } from './loopSystem'

import { fromWei, HTTPProvider, RequestManager } from 'eth-connect'
import { config } from '../config/index'
import {
  Network,
  type BackendBalance,
  type Banner,
  type JoystickBannerData,
  type JoystickSlotData,
  type LangText,
  type MarketplaceOptions,
  type NftData,
  type NftDataOptions,
  type NftWearableOptions,
  type ReplaceNftData,
  type ReplaceNftDataPayload,
  type Slot,
  type Variable
} from '../interfaces/index'
import { en } from '../lang/en'
import { type Provider } from '../types'
import { getUserAddress } from '../util/wallet'
import contractConfig from './contractConfig'
import { EventEmitter } from './eventEmitter'
import { createMANAComponent } from './manaComponent'
import PurchaseModal from './purchaseModal'
import { createStoreComponent } from './storeComponent'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import Canvas from '../util/canvas/Canvas'
import { waitNextTick } from '../util/engine'

export enum BuySelection {
  BAG,
  Coinbase,
  Binance,
  Paper
}

type PlaneShapeData = Slot & {
  entityScale: { x: number; y: number; z: number }
  entityRotation: Quaternion
}

type IMANAComponent = {
  balance: () => Promise<any>
  isApproved: (spenderAddress: string) => Promise<number>
  approve: (spenderAddress: string, amount?: number) => Promise<string>
}

type IStoreComponent = {
  buy: (
    collectionId: string,
    blockchainIds: string[],
    tokenPrice: number,
    notificationCB: (text: string) => void
  ) => Promise<string>
}

type IDashboardSlot = {
  id: string
  id_user: string
  id_zone: string
  name: string
  reference_img: string
  texture_1: string
  texture_2: string
  texture_3: string
  status: string
  group_id: string
  slot: string
  pos_x: string
  pos_y: string
  pos_z: string
  size_x: string
  size_y: string
  size_z: string
  scale: string
  rot_x: string
  rot_y: string
  rot_z: string
  nft_address: string
  token_id: string
  id_resource_group: string
  nft_type: string
  wallet: string
}

type DgWorldMarketplaceEvents = {
  error: unknown
  web3Ready: unknown
  websocketsReady: unknown
  variablesReady: unknown
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  ready: void
}

/**
 * @public
 * This is a public DgWorldMarketplace
 */
export default class DgWorldMarketplace extends EventEmitter<DgWorldMarketplaceEvents> {
  public slots: Slot[] = []
  private readonly previewEnv: string = 'dev'
  private readonly network: string = 'MATIC'
  private provider: Provider | null = null
  private requestManager: RequestManager | null = null
  private metaProvider: HTTPProvider | null = null
  private fromAddress: string = ''
  private metaRequestManager: RequestManager | null = null
  private readonly currentPrompt: // | ui.OptionPrompt
  // | ui.OkPrompt
  // | ui.CustomPrompt
  null = null

  private mana: IMANAComponent | null = null
  private store: IStoreComponent | null = null
  private wsEvents: WebSocket | null = null
  private wsUser: WebSocket | null = null
  private wsJoystick: WebSocket | null = null
  private readonly inViewEntity: Record<
    string,
    { entity: Entity; nftWrapper: Entity }
  > = {}

  // public canvas: UICanvas | null = null;
  private readonly purchaseModal: PurchaseModal
  private selectedNftAddress: string = ''
  private selectedTokenId: string = ''
  private selectedResourceId: string = ''
  // private loader: ui.LoadingIcon | null = null;
  private readonly zoneId: number = 0
  private readonly lang: LangText = en
  private readonly DEBUG_MODE: boolean = false
  private banners: Banner[] = []
  private variables: Variable[] = []
  private readonly inViewBanners: Record<string, { entity: Entity }> = {}
  private validateNftData: {
    nftAddress: string | null
    tokenId: string | null
    resourceId: string | null
    price: number | null
    sellerAddress: string | undefined
  } = {
    nftAddress: null,
    tokenId: null,
    resourceId: null,
    price: null,
    sellerAddress: undefined
  }

  private paymentMethod: string = 'BAG'
  private intervals: Record<string, LoopSystem> = {}

  constructor(options: MarketplaceOptions) {
    super()
    console.log('my test id is 383')
    if (
      options.slots !== undefined &&
      options.slots?.length > 0 &&
      options.zoneId === undefined
    ) {
      throw new Error('Slots or zoneId are required')
    }
    if (
      options.slots !== undefined &&
      options.slots?.length > 0 &&
      options.zoneId !== undefined
    ) {
      throw new Error('Must specify either slots or zoneId, not both')
    }
    if (options.zoneId !== undefined) this.zoneId = options.zoneId
    // https://business.dglive.org/api/getAllMarketSlots/54
    if (options.previewEnv != null) this.previewEnv = options.previewEnv
    if (options.network !== undefined) this.network = options.network
    if (options.lang !== undefined) this.lang = { ...en, ...options.lang }
    this.DEBUG_MODE = options.debug ?? false
    this.purchaseModal = new PurchaseModal({
      onBuyCB: this.buyModalCb.bind(this),
      lang: this.lang
    })

    void this.initDGMarketplace()
  }

  render(): ReactEcs.JSX.Element {
    return (
      <UiEntity>
        <Canvas
          uiTransform={{
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <UiEntity uiText={{ value: 'Hello dg library!', fontSize: 24 }} />
        </Canvas>

        {this.purchaseModal.render()}
      </UiEntity>
    )
  }

  private onError(err: any): void {
    console.error(err)
    this.emit('error', err)
  }

  private async initDGMarketplace(): Promise<void> {
    try {
      await this.initWeb3()
      this.emit('web3Ready')
      await this.initWebsockets()
      this.emit('websocketsReady')
      await this.getBannersData()
      this.emit('variablesReady')
      await this.setBanners()
      if (this.slots.length > 0) {
        await this.setSlots(this.slots)
      } else {
        await this.fetchSlots()
      }
      await this.checkAllowance()
      this.emit('ready')
    } catch (err) {
      this.onError(err)
    }
  }

  private getBannerType(url: string): 'image' | 'video' | 'neither' {
    const imageRegex = /\.(png|jpg|jpeg|gif)$/i
    const videoRegex = /\.(mp4|webm|ogg|mov)$/i

    if (imageRegex.test(url)) {
      return 'image'
    } else if (videoRegex.test(url)) {
      return 'video'
    } else {
      return 'neither'
    }
  }

  private async setBanners(): Promise<void> {
    console.log('setBanners::this.banners', this.banners)
    try {
      for (const [, banner] of this.banners.entries()) {
        const {
          position_x: px,
          position_y: py,
          position_z: pz,
          rotation_x: rx,
          rotation_y: ry,
          rotation_z: rz,
          size_x: sx,
          size_y: sy,
          size_z: sz,
          media_url: imageUrl,
          id: idBanner
        } = banner

        const bannerEntity = engine.addEntity()
        MeshRenderer.setPlane(bannerEntity)
        MeshCollider.setPlane(bannerEntity)

        if (this.getBannerType(imageUrl) === 'video') {
          const bannerVideoEntity = engine.addEntity()
          VideoPlayer.create(bannerVideoEntity, {
            src: imageUrl,
            playing: true,
            volume: 0,
            loop: true
          })
          Material.setPbrMaterial(bannerEntity, {
            texture: Material.Texture.Video({
              videoPlayerEntity: bannerVideoEntity
            })
          })
        } else {
          Material.setPbrMaterial(bannerEntity, {
            texture: Material.Texture.Common({
              src: imageUrl
            })
          })
        }

        Transform.create(bannerEntity, {
          position: Vector3.create(+px, +py, +pz),
          scale: Vector3.create(+sx, +sy, +sz),
          rotation: Quaternion.fromEulerDegrees(+rx, +ry, +rz)
        })

        this.inViewBanners[idBanner] = { entity: bannerEntity }
      }
    } catch (err) {
      console.log('setBanners err', err)
      this.onError(err)
      throw err
    }
  }

  private async getBannersData(): Promise<void> {
    try {
      const res = await fetch(`${config.dashboardUrl}/getZone/${this.zoneId}`)
      const dashboardData: {
        banners: Banner[]
        variables: Variable[]
      } = await res.json()
      this.banners = dashboardData.banners.filter(
        (b: Banner) => b.enabled === '1'
      )
      this.variables = dashboardData.variables
    } catch (err) {
      this.onError(err)
      throw err
    }
  }

  private async fetchSlots(): Promise<void> {
    try {
      const res = await fetch(
        `${config.dashboardUrl}/getSlotsByZone/${this.zoneId}`
      )
      const slots: IDashboardSlot[] = await res.json()
      if (slots.length > 0) {
        await this.fetchSlotsData(slots)
      }
    } catch (err) {
      this.DEBUG_MODE && console.log('fetchSlots err', err)
      throw err
    }
  }

  private async fetchSlotsData(slots: IDashboardSlot[]): Promise<void> {
    const badDataNfts: IDashboardSlot[] = []
    const slotPromises: Array<Promise<number | Response>> = []
    const filtredDashboardSlotslots: IDashboardSlot[] = []
    try {
      slots.forEach((slot: IDashboardSlot) => {
        if (
          slot.id_resource_group === undefined ||
          slot.token_id === undefined ||
          slot.nft_address === undefined
        ) {
          badDataNfts.push(slot)
        } else {
          filtredDashboardSlotslots.push(slot)
          slotPromises.push(
            fetch(
              `${config.backendUrl}/marketplace/nft/${slot.id_resource_group}/${slot.token_id}`
            )
          )
        }
      })
      const slotResponses = await Promise.all(slotPromises)
      const slotRawData = await Promise.all(
        slotResponses.map((res: any) => res.json())
      )
      const slotData = slotRawData
        .filter((x) => {
          return x.data !== undefined && x.data !== null
        })
        .map((item: any) => item.data)
      const res: Slot[] = []
      filtredDashboardSlotslots.forEach((s) => {
        for (let index = 0; index < slotData.length; index++) {
          const element = slotData[index]
          if (res.length === 0) {
            if (
              element.nftAddress.toLowerCase() ===
                s.nft_address.toLowerCase() &&
              element.tokenId === s.token_id
            ) {
              res.push({
                ...element,
                imageUrl:
                  element.imageUrl.indexOf('ipfs://') > -1
                    ? `https://${element.imageUrl.replace(
                        'ipfs://',
                        'ipfs.io/'
                      )}`
                    : element.imageUrl,
                id: s.id,
                slotName: s.name,
                idUserDashboard: s.id_user,
                idZoneDashboard: s.id_zone,
                position: { x: s.pos_x, y: s.pos_y, z: s.pos_z },
                scale: {
                  x: s.size_x,
                  y: s.size_y,
                  z: s.size_z,
                  all: s.scale
                },
                rotation: { x: s.rot_x, y: s.rot_y, z: s.rot_z },
                followWallet: s.wallet
              })
              slotData.splice(index, 1)
              break
            }
          } else {
            let slotFound = false
            for (let j = 0; j < res.length; j++) {
              if (res[j].id === s.id) {
                slotFound = true
                break
              }
            }
            if (!slotFound) {
              res.push({
                ...element,
                imageUrl:
                  element.imageUrl.indexOf('ipfs://') > -1
                    ? `https://${element.imageUrl.replace(
                        'ipfs://',
                        'ipfs.io/'
                      )}`
                    : element.imageUrl,
                id: s.id,
                slotName: s.name,
                idUserDashboard: s.id_user,
                idZoneDashboard: s.id_zone,
                position: { x: s.pos_x, y: s.pos_y, z: s.pos_z },
                scale: {
                  x: s.size_x,
                  y: s.size_y,
                  z: s.size_z,
                  all: s.scale
                },
                rotation: { x: s.rot_x, y: s.rot_y, z: s.rot_z },
                followWallet: s.wallet
              })
              slotData.splice(index, 1)
              break
            }
          }
        }
      })
      this.slots = res
      await this.setSlots(this.slots)
      if (badDataNfts.length > 0)
        this.onError({
          message: 'Bad data in nfts',
          data: badDataNfts
        })
    } catch (err) {
      console.log('fetchSlotsData error', err)
      this.onError(err)
    }
  }

  async setSlots(slots: Slot[]): Promise<void> {
    try {
      console.log('setSlots::slots', slots)
      for (const slot of slots) {
        const {
          position,
          scale,
          rotation,
          nftAddress,
          tokenId,
          price,
          resourceId,
          imageUrl,
          id: idSlot,
          // name,
          height,
          width,
          audioUrl,
          animationUrl,
          youtubeUrl
        } = slot
        const { x: rx = 0, y: ry = 0, z: rz = 0 } = rotation
        const { x: px, y: py, z: pz } = position
        const planeShapeData: PlaneShapeData = {
          ...slot,
          entityScale:
            scale.all !== undefined
              ? { x: scale.all, y: scale.all, z: scale.all }
              : { x: scale.x ?? 1, y: scale.y ?? 1, z: scale.z ?? 1 },
          entityRotation: Quaternion.fromEulerDegrees(rx, ry, rz)
        }

        if (slot.isWearable) {
          let nftData: any
          try {
            nftData = (await this.fetchNftData({
              nftAddress,
              tokenId
            })) as any
          } catch (error) {
            console.log(error)
            this.setPlaneShape(planeShapeData)
          }
          if (nftData === undefined || nftData === null) continue

          const title: string = nftData?.data[0]?.nft?.name
          const urn = await this.generateNftUrn({
            nftAddress,
            tokenId,
            itemId: nftData.data[0].nft.itemId
          })
          if (urn === undefined || urn === null)
            throw new Error('Could not generate urn for nft')

          const wearable = await this.fetchWearables(urn)
          if (wearable == null || wearable.length < 1) {
            this.setPlaneShape(planeShapeData)
            continue
          }

          const {
            id,
            name,
            data: { representations }
          } = wearable[0]

          const nftEntity = engine.addEntity()

          AvatarShape.create(nftEntity, {
            id,
            name,
            bodyShape: representations[0].bodyShapes[0],
            skinColor: Color3.create(0.843, 0.333, 0.4),
            wearables: [id],
            emotes: []
          })

          Transform.create(nftEntity, {
            position: Vector3.create(+px, +py, +pz),
            scale: planeShapeData.entityScale,
            rotation: planeShapeData.entityRotation
          })

          const nftWrapperEntity = engine.addEntity()
          MeshRenderer.setCylinder(nftWrapperEntity, 0.5, 0.5)
          MeshCollider.setCylinder(nftWrapperEntity, 0.5, 0.5)

          const posYFix = +py + +planeShapeData.entityScale.y
          Transform.create(nftWrapperEntity, {
            position: Vector3.create(+px, posYFix, +pz),
            scale: Vector3.create(
              planeShapeData.entityScale.x * 1.1,
              planeShapeData.entityScale.y * 1.1,
              planeShapeData.entityScale.z * 1.1
            )
          })

          pointerEventsSystem.onPointerDown(
            {
              entity: nftWrapperEntity,
              opts: {
                hoverText: `${this.lang.buyFor} ${price} BAG`,
                showFeedback: true
              }
            },
            () => {
              executeTask(async () => {
                // TODO
                // if (evt.buttonId === 1 || evt.buttonId === 2) return;
                await this.buy({
                  nftAddress,
                  tokenId,
                  price,
                  imageUrl,
                  title,
                  resourceId,
                  width,
                  height,
                  audioUrl,
                  animationUrl,
                  youtubeUrl
                })
              })
            }
          )

          this.DEBUG_MODE &&
            Material.setBasicMaterial(nftWrapperEntity, {
              diffuseColor: Color4.create(0.5, 0.4, 0.6, 1.0)
            })

          this.inViewEntity[idSlot] = {
            entity: nftEntity,
            nftWrapper: nftWrapperEntity
          }
        } else {
          this.setPlaneShape(planeShapeData)
        }
      }
    } catch (err) {
      console.log('setSlots::error', err)
      this.onError(err)
    }
  }

  private setPlaneShape(planeShapeData: PlaneShapeData): void {
    const planeEntity = engine.addEntity()
    const dummyEntity = engine.addEntity()
    const {
      position,
      entityScale,
      entityRotation,
      nftAddress,
      tokenId,
      price,
      imageUrl,
      resourceId,
      height,
      width,
      audioUrl,
      animationUrl,
      youtubeUrl,
      name,
      id: idSlot
    } = planeShapeData

    Transform.createOrReplace(planeEntity, {
      position: Vector3.create(position.x, position.y, position.z),
      scale: Vector3.create(entityScale.x, entityScale.y, entityScale.z),
      rotation: entityRotation
    })

    MeshCollider.setPlane(planeEntity)
    MeshRenderer.setPlane(planeEntity)
    Material.setBasicMaterial(planeEntity, {
      texture: Material.Texture.Common({ src: imageUrl })
    })

    pointerEventsSystem.onPointerDown(
      {
        entity: planeEntity,
        opts: {
          hoverText: `${this.lang.buyFor} ${price} BAG`,
          showFeedback: true
        }
      },
      (event) => {
        // TODO THIS CHECK
        // if (evt.buttonId === 1 || evt.buttonId === 2) return;

        executeTask(async () => {
          await this.buy({
            nftAddress,
            tokenId,
            price,
            imageUrl,
            title: name,
            resourceId,
            height,
            width,
            audioUrl,
            animationUrl,
            youtubeUrl
          })
        })
      }
    )

    this.inViewEntity[idSlot] = {
      entity: planeEntity,
      nftWrapper: dummyEntity
    }
  }

  private async generateNftUrn(options: NftWearableOptions): Promise<string> {
    const { nftAddress, itemId, tokenId } = options
    if (tokenId === undefined && itemId === undefined)
      throw new Error(`You need to provide an itemId or a tokenId`)
    const network = this.network
    let urn: string = ''
    try {
      if (itemId !== undefined) {
        urn = `urn:decentraland:${network}:collections-v2:${nftAddress}:${itemId}`
      } else if (tokenId !== undefined) {
        const nftData = await this.fetchNftData({ nftAddress, tokenId })
        const { nft } = nftData.ntfs[0]
        urn =
          network !== Network.ETHEREUM
            ? `urn:decentraland:${network}:collections-v2:${nftAddress}:${nft.itemId}`
            : nft.image.split('contents/')[1].split('/thumbnail')[0]
      }
      return urn
    } catch (err) {
      console.log(err)
      this.onError(err)
      throw err
    }
  }

  private async fetchNftData(options: NftDataOptions): Promise<NftData> {
    const { nftAddress, tokenId } = options
    const res = await fetch(
      `https://nft-api.decentraland.org/v1/nfts?contractAddress=${nftAddress}&tokenId=${tokenId}`
    )
    const nftDataRes: any = await res.json()
    const { data } = nftDataRes
    console.log('nftDataRes: ', data)
    if (nftDataRes.data.length === 0) {
      throw new Error(
        `NFT not found for contractAddress="${nftAddress}" tokenId="${tokenId}"`
      )
    }
    return nftDataRes
  }

  private async fetchWearables(urn: string): Promise<any> {
    try {
      const res = await fetch(
        `https://peer.decentraland.org/lambdas/collections/wearables?wearableId=${urn}`
      )
      const { wearables } = await res.json()
      if (wearables.length === 0) {
        throw new Error(`Wearables not found for urn="${urn}"`)
      }
      return wearables
    } catch (error: any) {
      this.onError('Not a wearable, will try as a plane shape: ' + error)
      return null
    }
  }

  private async checkAllowance(): Promise<void> {
    try {
      if (this.mana == null)
        throw new Error("MANA component wasn't initialized")
      const contractAddress =
        contractConfig.getContractConfigByName('marketplace').address

      const allowance = await this.mana.isApproved(contractAddress)
      if (allowance > 0) {
        return
      }

      console.log('TODO')
      // TODO
      // this.currentPrompt = new ui.OptionPrompt(
      //   this.lang.approveBagTitle,
      //   this.lang.approveBagDesc,
      //   async () => {
      //     const url = `https://api.dglive.org/allowance?spender=${contractAddress}`;
      //     // openExternalUrl(url);
      //   },
      //   async () => {
      //     await this.delay(200);
      //     // this.currentPrompt = new ui.OkPrompt(
      //     //   this.lang.approveBagRejected,
      //     //   undefined,
      //     //   undefined,
      //     //   true
      //     // );
      //   },
      //   this.lang.authorize,
      //   this.lang.reject,
      //   true
      // );
    } catch (err: any) {
      if (Object.keys(err).length === 0) {
        throw new Error('Could not check allowance')
      }
      throw err
    }
  }

  private async initWeb3(): Promise<void> {
    try {
      this.provider = createEthereumProvider()
      if (this.provider == null) {
        throw new Error('Could not get provider')
      }
      this.requestManager = new RequestManager(this.provider)
      this.metaProvider = new HTTPProvider('https://rpc.blast.io')
      this.fromAddress = await getUserAddress()
      this.metaRequestManager = new RequestManager(this.metaProvider)
      const providers = {
        provider: this.provider,
        requestManager: this.requestManager,
        metaProvider: this.metaProvider,
        metaRequestManager: this.metaRequestManager,
        fromAddress: this.fromAddress
      }
      this.mana = createMANAComponent(providers)
      this.store = createStoreComponent({ providers, lang: this.lang })
    } catch (err: any) {
      if (Object.keys(err).length === 0) {
        throw new Error('Could not initialize web3')
      }
      throw err
    }
  }

  public async buy({
    nftAddress,
    tokenId,
    price,
    imageUrl,
    title,
    resourceId,
    width,
    height,
    description,
    audioUrl,
    animationUrl,
    youtubeUrl
  }: {
    nftAddress: string
    tokenId: string
    price: number
    imageUrl: string
    title: string
    resourceId: string
    height: number
    width: number
    description?: string
    audioUrl?: string
    animationUrl?: string
    youtubeUrl?: string
  }): Promise<any> {
    // TODO
    // if (this.currentPrompt) this.currentPrompt.hide();

    if (this.mana == null) return
    const balance = await this.mana.balance()

    const bagContractAddress =
      contractConfig.getContractConfigByName('bag').address

    const allowance = await this.mana.isApproved(bagContractAddress)

    this.selectedNftAddress = nftAddress
    this.selectedTokenId = tokenId
    this.selectedResourceId = resourceId
    this.purchaseModal.openModal({
      nftImagePath: imageUrl,
      nftTitle: title,
      nftDesc: description ?? '',
      // nftPrice: fromWei(price, 'ether')
      nftPrice: price,
      width,
      height,
      audioUrl,
      animationUrl,
      youtubeUrl,
      paymentMethod: this.paymentMethod,
      balance
    })
    return {
      balance: fromWei(balance, 'ether'),
      allowance: fromWei(allowance, 'ether')
    }
  }

  private async validateBackendWallet(price: number): Promise<boolean> {
    try {
      const backendBalanceRaw = await fetch(
        `${config.backendUrl}/backend-wallet/balance`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      const backendBalance: BackendBalance = await backendBalanceRaw.json()
      return (
        +price > +backendBalance.data.iceBalance ||
        +backendBalance.data.maticBalance < 2
      )
    } catch (error) {
      this.onError(error)
    }
    return false
  }

  private async buyModalCb(selectedBuyType: BuySelection): Promise<any> {
    console.log(this.validateNftData)
    const foundNft = this.slots.filter((nft) => {
      return (
        nft.nftAddress === this.selectedNftAddress &&
        nft.tokenId === this.selectedTokenId
      )
    })
    if (foundNft.length > 0) {
      const {
        nftAddress,
        tokenId,
        resourceId,
        price,
        followWallet: sellerAddress
      } = foundNft[0]
      this.validateNftData = {
        nftAddress,
        tokenId,
        resourceId,
        price,
        sellerAddress
      }
      if (this.mana == null) return
      const balance = fromWei(await this.mana.balance(), 'ether')
      if (
        selectedBuyType !== BuySelection.BAG &&
        selectedBuyType !== BuySelection.Paper
      ) {
        const validateBackendWallet = await this.validateBackendWallet(price)
        if (validateBackendWallet) {
          this.purchaseModal.hideNotifications()
          // TODO
          // const paymentMethodNotAvailable = new ui.CustomPrompt(
          //   "dark",
          //   undefined,
          //   100
          // );
          // paymentMethodNotAvailable.addText(
          //   "Sorry, payment method not available",
          //   0,
          //   0,
          //   undefined,
          //   20
          // );
          return
        }
      }
      switch (selectedBuyType) {
        case BuySelection.BAG:
          {
            const contractAddress =
              contractConfig.getContractConfigByName('marketplace').address

            const allowance = await this.mana.isApproved(contractAddress)
            if (+price > 0 && +price > +allowance) {
              // TODO
              // this.currentPrompt = new ui.OptionPrompt(
              //   this.lang.approveBagTitle,
              //   this.lang.approveBagDesc,
              //   async () => {
              //     const url = `https://api.dglive.org/allowance?spender=${contractAddress}`;
              //     openExternalUrl({ url } );
              //   },
              //   async () => {
              //     await this.delay(200);
              //     this.currentPrompt = new ui.OkPrompt(
              //       this.lang.approveBagRejected,
              //       undefined,
              //       undefined,
              //       true
              //     );
              //   },
              //   this.lang.authorize,
              //   this.lang.reject,
              //   true
              // );
            } else if (+price > +balance) {
              // TODO
              // const noBagDialog = new ui.CustomPrompt("dark", undefined, 100);
              // return noBagDialog.addText(
              //   this.lang.noFundsDesc,
              //   0,
              //   0,
              //   undefined,
              //   20
              // );
            } else {
              void this.buyWithBag(
                this.selectedNftAddress,
                this.selectedTokenId,
                price
              )
              this.paymentMethod = 'BAG'
            }
          }
          break
        case BuySelection.Coinbase:
          void this.buyWithCoinbase(
            this.selectedNftAddress,
            this.selectedTokenId,
            this.selectedResourceId
          )
          this.paymentMethod = 'Coinbase'
          break
        case BuySelection.Binance:
          void this.buyWithBinance(
            this.selectedNftAddress,
            this.selectedTokenId,
            this.selectedResourceId
          )
          this.paymentMethod = 'Binance'
          break
        case BuySelection.Paper:
          void this.buyWithPaper(
            this.selectedNftAddress,
            this.selectedTokenId,
            this.selectedResourceId
          )
          this.paymentMethod = 'Paper'
          break
        default:
          break
      }
    }
  }

  private readonly buyNotidicationCb = async (text: string): Promise<void> => {
    this.purchaseModal.notification(this.lang.buyWithBag, text)
  }

  private readonly buyWithBag = async (
    nftAddress: string,
    tokenId: string,
    tokenPrice: number
  ): Promise<void> => {
    // TODO
    // const custom = new ui.CustomPrompt("dark", undefined, 200, true);
    // this.currentPrompt = custom;

    if (this.store == null) {
      this.purchaseModal.notification(
        this.lang.buyWithBag,
        this.lang.purchaseFailed
      )
      return
    }

    if (!(await this.isNftAvailable())) {
      this.purchaseModal.notification(
        this.lang.buyWithBag,
        this.lang.nftNotAvailable
      )
      return
    }
    try {
      this.purchaseModal.notification(this.lang.buyWithBag, this.lang.buyingNFT)
      await this.store.buy(nftAddress, [tokenId], tokenPrice, (text) => {
        void this.buyNotidicationCb(text)
      })
      this.purchaseModal.notification(
        this.lang.buyWithBag,
        this.lang.purchaseFailed
      )
    } catch (err: any) {
      let message = ''
      if (err?.message !== undefined) {
        if (
          (err.message as string).includes('User denied message signature.')
        ) {
          message = this.lang.buyCanceled // this.lang.purchaseRejected
        } else {
          message = err.message.toString()
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        message = this.lang.genericError
      }
      this.purchaseModal.resetModal()
      this.purchaseModal.notification(this.lang.buyWithBag, message)
      this.onError(err)
      this.DEBUG_MODE && console.log(err)
    }
  }

  private async buyWithBinance(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      this.purchaseModal.notification(
        this.lang.buyWithBinance,
        this.lang.nftNotAvailable
      )
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    this.purchaseModal.notification(
      this.lang.buyWithBinance,
      this.lang.generatingPaymentLinkAndQR
    )
    const binanceRes: any = await this.get(`/binance/payment-link` + params)

    if (binanceRes?.status === 200) {
      this.purchaseModal.toggleModals()
      const qrJpg = binanceRes.data.qrcodeLink
      const paymentLink = binanceRes.data.checkoutUrl
      this.purchaseModal.showQrAndUrl(qrJpg, paymentLink)
    } else {
      this.purchaseModal.notification(
        this.lang.buyWithBinance,
        this.lang.genericError
      )
    }
  }

  private async buyWithCoinbase(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      this.purchaseModal.notification(
        this.lang.buyWithCoinbase,
        this.lang.nftNotAvailable
      )
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    this.purchaseModal.notification(
      this.lang.buyWithCoinbase,
      this.lang.generatingPaymentLink
    )
    const coinbaseRes: any = await this.get(`/coinbase/payment-link` + params)
    if (coinbaseRes?.status === 200) {
      this.purchaseModal.toggleModals()
      const { hosted_url: paymentLink, code } = coinbaseRes.data
      this.purchaseModal.showQrAndUrl(undefined, paymentLink)
      const intervalId = code
      this.intervals[intervalId] = new LoopSystem(15, () => {
        executeTask(async () => {
          const paymentResult: any = await this.get(
            `/coinbase/payment-status?code=` + code
          )
          console.log('paymentResult: ', paymentResult)
          if (paymentResult.data?.payments?.length > 0) {
            const paymentConfirmed = paymentResult.data.payments.find(
              (x: any) => x.status === 'CONFIRMED'
            )
            if (paymentConfirmed != null) {
              engine.removeSystem(
                this.intervals[intervalId].cb.bind(this.intervals[intervalId])
              )

              // This intervalId is already in the scope
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete this.intervals[intervalId]

              this.purchaseModal.notification(
                this.lang.buyWithCoinbase,
                this.lang.coinbasePaymentConfirmed
              )
            }
          }
        })
      })
      engine.addSystem(
        this.intervals[intervalId].cb.bind(this.intervals[intervalId])
      )
    } else {
      this.purchaseModal.notification(
        this.lang.buyWithCoinbase,
        this.lang.genericError
      )
    }
  }

  private async buyWithPaper(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      this.purchaseModal.notification(
        this.lang.buyWithPaper,
        this.lang.nftNotAvailable
      )
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    this.purchaseModal.notification(
      this.lang.buyWithPaper,
      this.lang.generatingPaymentLink
    )
    const paperRes: any = await this.get(`/paper/payment-link` + params)
    if (paperRes?.status === 200) {
      this.purchaseModal.toggleModals()
      const paymentLink = paperRes.data
      this.purchaseModal.showQrAndUrl(undefined, paymentLink)
    } else {
      this.purchaseModal.notification(
        this.lang.buyWithPaper,
        this.lang.genericError
      )
    }
  }

  private readonly isNftAvailable = async (): Promise<boolean> => {
    const isNftAvailableRaw = await fetch(
      `${config.backendUrl}/marketplace/listings/valiadate-published-nft`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.validateNftData)
      }
    )
    const isNftAvailable = await isNftAvailableRaw.json()
    if (
      isNftAvailable.data?.isValid !== true &&
      isNftAvailable.data?.tokenId !== undefined
    ) {
      return false
    }
    return true
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(`${config.backendUrl}${url}`)
    const data = await res.json()
    return data
  }

  private async initWebsockets(): Promise<void> {
    try {
      const address = await getUserAddress()

      this.wsEvents = new WebSocket(`${config.wsUrl}?isMarketplace=true`)
      this.wsUser = new WebSocket(
        `${config.wsUrl}?address=${address}&isWorld=true`
      )
      this.wsJoystick = new WebSocket(
        `${config.wsUrl}?isWorld=true&zoneId=${this.zoneId}`
      )
      this.wsEvents.onopen = () => {
        console.log(`Connected to DG-Marketplace-WS-Events`)
      }
      this.wsUser.onopen = () => {
        console.log(`Connected to DG-Marketplace-WS-User`)
      }
      this.wsJoystick.onopen = () => {
        console.log(`Connected to DG-Marketplace-WS-Joystick`)
      }
      this.wsEvents.onmessage = (evt) => {
        this.onMessage(evt)
      }
      this.wsEvents.onclose = () => {
        console.log(`Disconnected from DG-Marketplace-WS-Events`)
      }
      this.wsEvents.onerror = (err) => {
        console.log(
          `Error on DG-Marketplace-WS-Events: ${(err as any).toString()}`
        )
        this.emit('error', err)
      }
      this.wsUser.onerror = (err) => {
        console.log(
          `Error on DG-Marketplace-WS-User: ${(err as any).toString()}`
        )
        this.emit('error', err)
      }
      this.wsUser.onclose = () => {
        console.log(`Disconnected from DG-Marketplace-WS-User`)
      }
      this.wsUser.onmessage = (evt) => {
        this.onEvent(evt)
      }

      this.wsJoystick.onmessage = (evt) => {
        const data: JoystickSlotData | JoystickBannerData =
          typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data
        data.type === 'slot'
          ? this.handleJoystickSlotData(data)
          : this.handleJoystickBannerData(data)
      }

      this.wsJoystick.onerror = (err) => {
        console.log(
          `Error on DG-Marketplace-WS-Joystick: ${(err as any).toString()}`
        )
        this.emit('error', err)
      }
      this.wsJoystick.onclose = () => {
        console.log(`Disconnected from DG-Marketplace-WS-Joystick`)
      }
    } catch (err: any) {
      console.log('initWS:err', err)
      this.onError(err)
      throw err
    }
  }

  private onMessage(ev: any): void {
    const data: ReplaceNftData =
      typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
    const { type, payload } = data
    switch (type) {
      case 'buy':
        void this.replaceNft(payload)
        break
      case 'cancel':
        void this.cancelNft(payload.resourceId)
        break
      case 'sell':
        void this.replaceNft(payload)
        break
      default:
        break
    }
  }

  private handleJoystickSlotData(payload: JoystickSlotData): void {
    if (payload === undefined) return
    const {
      resourceId,
      tokenId,
      // posX,
      // posY,
      // posZ,
      // scaleX,
      // scaleY,
      // scaleZ,
      // rotX,
      // rotY,
      // rotZ,
      // zoneId,
      slotId
    } = payload
    const foundSlots = this.slots.filter((x) => {
      return (
        x.resourceId === resourceId && x.tokenId === tokenId && x.id === slotId
      )
    })
    foundSlots.forEach((slot) => {
      if (this.inViewEntity[slot.id] !== undefined) {
        // TODO
        // this.inViewEntity[slot.id].entity.components["engine.transform"] =
        //   new Transform({
        //     position: new Vector3(+posX, +posY, +posZ),
        //     scale: new Vector3(scaleX, scaleY, scaleZ),
        //     rotation: Quaternion.Euler(rotX, rotY, rotZ),
        //   });
        // if (slot.isWearable) {
        //   const posYFix = +posY + +scaleY;
        //   this.inViewEntity[slot.id].nftWrapper.components["engine.transform"] =
        //     new Transform({
        //       position: new Vector3(+posX, +posYFix, +posZ),
        //       scale: new Vector3(scaleX * 1.1, scaleY * 1.1, scaleZ * 1.1),
        //     });
        //   // this.inViewEntity[slot.id].entity.getComponent(Transform).position.y = +posY + 0.1
        // }
      }
    })
  }

  private handleJoystickBannerData(payload: JoystickBannerData): void {
    if (!(payload !== undefined)) return
    const {
      posX,
      posY,
      posZ,
      scaleX,
      scaleY,
      scaleZ,
      rotX,
      rotY,
      rotZ,
      bannerId
    } = payload
    if (this.inViewBanners[bannerId] !== undefined) {
      Transform.createOrReplace(this.inViewBanners[bannerId].entity, {
        position: Vector3.create(+posX, +posY, +posZ),
        scale: Vector3.create(scaleX, scaleY, scaleZ),
        rotation: Quaternion.fromEulerDegrees(rotX, rotY, rotZ)
      })
    }
  }

  private onEvent(ev: any): void {
    if (this.purchaseModal.notifyOnEvent) {
      const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
      const { status, type, transactionHash, message } = data
      if (type === 'buy') {
        if (status === 'refund')
          this.purchaseModal.notification(
            this.lang.purchaseRefunded,
            message + ' txHash: ' + transactionHash
          )
        else this.purchaseModal.notification('', this.lang.purchaseSucceed)
      } else if (type === 'cancel') {
        this.purchaseModal.notification(
          this.lang.listingCanceled,
          'txHash: ' + transactionHash
        )
      }
    }
  }

  public async cancelNft(resourceId: string): Promise<void> {
    // const slotsToHide = this.slots.filter(
    //   (slot) => slot.resourceId === resourceId
    // )
    // for (const slot of slotsToHide) {
    // TODO
    // this.inViewEntity[slot.id].entity.components[
    //   "engine.avatarShape"
    // ].visible = false;
    // // this.inViewEntity[slot.id].nftWrapper.components['engine.avatarShape'].visible = false
    // }
  }

  public async replaceNft(payload: ReplaceNftDataPayload): Promise<void> {
    const slotsToReplace = []
    if (!(payload !== undefined)) {
      console.log('no payload')
      return
    }
    const { nextMarketplaceNft, nextSellerNft, resourceId } = payload
    if (nextMarketplaceNft === undefined) {
      console.log('>>No more NFTs to replace<<')
      // const slotsToHide = this.slots.filter(
      //   (slot) => slot.resourceId === resourceId
      // )
      // for (const slot of slotsToHide) {
      // TODO
      // this.inViewEntity[slot.id].entity.components[
      //   "engine.avatarShape"
      // ].visible = false;
      // }
      return
    }
    for (const slot of this.slots) {
      if (slot.resourceId.toLowerCase() === resourceId.toLowerCase()) {
        if (slot.followWallet !== undefined) {
          if (
            nextSellerNft !== undefined &&
            slot.followWallet.toLowerCase() ===
              nextSellerNft.sellerAddress.toLowerCase()
          ) {
            slot.tokenId = nextSellerNft.tokenId
            slot.price = nextSellerNft.price
            slotsToReplace.push({
              ...slot,
              price: nextSellerNft.price,
              tokenId: nextSellerNft.tokenId
            })
          }
        } else {
          slot.tokenId = nextMarketplaceNft.tokenId
          slot.price = nextMarketplaceNft.price
          slotsToReplace.push({
            ...slot,
            price: nextMarketplaceNft.price,
            tokenId: nextMarketplaceNft.tokenId
          })
        }
      } else {
        // No slot match
      }
    }
    console.log(slotsToReplace)
    slotsToReplace.forEach((slot: Slot) => {
      const {
        nftAddress,
        tokenId,
        price,
        imageUrl,
        name,
        description
        // width,
        // height,
        // audioUrl,
        // animationUrl,
        // youtubeUrl,
        // resourceId
      } = slot
      slot.description = description
      slot.name = name
      slot.imageUrl = imageUrl
      slot.price = price
      slot.tokenId = tokenId
      slot.nftAddress = nftAddress

      // TODO
      // this.inViewEntity[slot.id].entity.components["engine.pointerDown"] =
      //   new OnPointerDown(
      //     async (evt) => {
      //       if (evt.buttonId === 1 || evt.buttonId === 2) return;
      //       await this.buy({
      //         nftAddress,
      //         tokenId,
      //         price,
      //         imageUrl,
      //         resourceId,
      //         title: name,
      //         description,
      //         width,
      //         height,
      //         audioUrl,
      //         animationUrl,
      //         youtubeUrl,
      //       });
      //     },
      //     {
      //       hoverText: `${this.lang.buyFor} ${price} BAG`,
      //       // hoverText: `${this.lang.buyFor} ${fromWei(price, 'ether')} BAG`,
      //       showFeedback: true,
      //     }
      //   );
    })
  }

  private readonly delay = async (ms: number): Promise<void> => {
    const now = Date.now()
    while (ms > 0) {
      ms -= Date.now() - now
      await waitNextTick()
    }
  }

  public getVariables(): Variable[] {
    return this.variables
  }
}
