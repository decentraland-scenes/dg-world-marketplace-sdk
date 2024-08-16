import { executeTask, type Entity, type IEngine } from '@dcl/sdk/ecs'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

import { LoopSystem } from './loopSystem'

import { fromWei, HTTPProvider, RequestManager } from 'eth-connect'
import { config } from '../config/index'
import {
  type BackendBalance,
  type Banner,
  type JoystickBannerData,
  type JoystickSlotData,
  type LangText,
  type MarketplaceOptions,
  Network,
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
import { createStoreComponent } from './storeComponent'
import PurchaseModal from './purchaseModal'

export enum BuySelection {
  BAG,
  Coinbase,
  Binance,
  Paper
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

/**
 * @public
 * This is a public DgWorldMarketplace
 */
export default class DgWorldMarketplace extends EventEmitter {
  public slots: Slot[] = []
  private readonly engine: IEngine
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
  private readonly zoneId: number | null = null
  private readonly lang: LangText = en
  private readonly debug: boolean = false
  // private successEventPrompt: ui.OkPrompt;
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
    if (options.engine === undefined) throw new Error('Engine is required')
    this.engine = options.engine
    if (options.previewEnv != null) this.previewEnv = options.previewEnv
    if (options.network !== undefined) this.network = options.network
    if (options.lang !== undefined) this.lang = { ...en, ...options.lang }
    this.debug = options.debug ?? false

    // TODO
    // if (options.canvas) this.canvas = options.canvas;
    // else {
    //   const prompt = new ui.CustomPrompt(ui.PromptStyles.DARK, 600, 300, true);
    //   this.canvas = prompt.canvas;
    //   this.canvas.visible = false;
    // }
    // this.canvas.visible = true;

    this.purchaseModal = new PurchaseModal()
    // this.purchaseModal = new PurchaseModal({
    //   onBuyCB: this.buyModalCb.bind(this),
    //   lang: this.lang,
    //   canvas: this.canvas,
    // });
    // this.loader = new ui.LoadingIcon(undefined, 0, -80);
    // this.loader.hide();
    // this.successEventPrompt = new ui.OkPrompt(
    //   "Success - txHash: \n xxx",
    //   undefined,
    //   "Ok",
    //   true
    // );
    // this.successEventPrompt.hide();

    void this.initDGMarketplace()
  }

  private onError(err: any): void {
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
      if (this.slots.length > 0) await this.setSlots(this.slots)
      else await this.fetchSlots()
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
    try {
      // TODO
      // for (const banner of this.banners) {
      // const {
      //   position_x: px,
      //   position_y: py,
      //   position_z: pz,
      //   rotation_x,
      //   rotation_y,
      //   rotation_z,
      //   size_x,
      //   size_y,
      //   size_z,
      //   media_url: imageUrl,
      //   id: idBanner
      // } = banner
      //   const bannerEntity = new Entity();
      //   const planeShape = new PlaneShape();
      //   bannerEntity.addComponent(planeShape);
      //   if (this.getBannerType(imageUrl) === "video") {
      //     const videoMaterial = new Material();
      //     const videoBanner = new VideoClip(imageUrl);
      //     const videoTexture = new VideoTexture(videoBanner);
      //     videoMaterial.albedoTexture = videoTexture;
      //     bannerEntity.addComponent(videoMaterial);
      //     videoTexture.playing = true;
      //     videoTexture.play();
      //     videoTexture.loop = true;
      //     videoTexture.volume = 0;
      //     engine.addEntity(bannerEntity);
      //   } else {
      //     const planeMaterial = new BasicMaterial();
      //     //Logica de banner que es imagen
      //     const imageTexture = new Texture(imageUrl, {
      //       wrap: 1,
      //       samplingMode: 0,
      //     });
      //     planeMaterial.texture = imageTexture;
      //     planeShape.withCollisions = true;
      //     bannerEntity.addComponent(planeMaterial);
      //   }
      //   bannerEntity.addComponent(
      //     new Transform({
      //       position: new Vector3(+px, +py, +pz),
      //       scale: new Vector3(+size_x, +size_y, +size_z),
      //       rotation: Quaternion.Euler(+rotation_x, +rotation_y, +rotation_z),
      //     })
      //   );
      //   this.inViewBanners[idBanner] = { entity: bannerEntity };
      //   this.engine.addEntity(bannerEntity);
      // }
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
      this.debug && console.log('fetchSlots err', err)
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
          return x.data !== undefined
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
      // TODO
      // for (const slot of slots) {
      //   const {
      //     position,
      //     scale,
      //     rotation,
      //     nftAddress,
      //     tokenId,
      //     price,
      //     resourceId,
      //     imageUrl,
      //     id: idSlot,
      //     name,
      //     height,
      //     width,
      //     audioUrl,
      //     animationUrl,
      //     youtubeUrl,
      //   } = slot;
      //   const planeShapeData: any = { ...slot };
      //   const { x: px, y: py, z: pz } = position;
      //   const entityScale: { x: number; y: number; z: number } = {
      //     x: 1,
      //     y: 1,
      //     z: 1,
      //   };
      //   planeShapeData["entityScale"] = entityScale;
      //   let entityRotation: any = null;
      //   if (!!scale.all) {
      //     entityScale.x = scale.all;
      //     entityScale.y = scale.all;
      //     entityScale.z = scale.all; // new Vector3().setAll(scale.all)
      //   } else if (!!scale.x && !!scale.y && !!scale.z) {
      //     entityScale.x = scale.x;
      //     entityScale.y = scale.y;
      //     entityScale.z = scale.z;
      //   }
      //   const { x: rx = 0, y: ry = 0, z: rz = 0 } = rotation;
      //   entityRotation = Quaternion.fromEulerDegrees(rx, ry, rz);
      //   planeShapeData["entityRotation"] = entityRotation;
      //   if (slot.isWearable) {
      //     let nftData: any;
      //     try {
      //       nftData = (await this.fetchNftData({
      //         nftAddress,
      //         tokenId,
      //       })) as any;
      //     } catch (error) {
      //       console.log(error);
      //       await this.setPlaneShape(planeShapeData);
      //     }
      //     if (!nftData) continue;
      //     // const imageUrl: string = nftData?.data[0]?.nft?.image
      //     const title: string = nftData?.data[0]?.nft?.name;
      //     const urn = await this.generateNftUrn({
      //       nftAddress,
      //       tokenId,
      //       itemId: nftData.data[0].nft.itemId,
      //     });
      //     if (!urn) throw new Error("Could not generate urn for nft");
      //     const wearable = await this.fetchWearables(urn);
      //     if (!wearable?.length) {
      //       void this.setPlaneShape(planeShapeData);
      //       continue;
      //     }
      //     const {
      //       id,
      //       name,
      //       data: { representations },
      //     } = wearable[0];
      //     const avatarShape = new AvatarShape();
      //     const nftEntity = new Entity();
      //     avatarShape.name = name;
      //     avatarShape.bodyShape = representations[0].bodyShapes[0];
      //     avatarShape.wearables = [id];
      //     const red = 0.843;
      //     const green = 0.333;
      //     const blue = 0.4;
      //     avatarShape.skinColor = new Color4(red, green, blue, 0.5);
      //     nftEntity.addComponent(
      //       new Transform({
      //         position: new Vector3(+px, +py, +pz),
      //         scale: new Vector3(entityScale.x, entityScale.y, entityScale.z),
      //         rotation: entityRotation,
      //       })
      //     );
      //     nftEntity.addComponent(avatarShape);
      //     const nftWrapper = new Entity();
      //     // nftWrapper.setParent(nftEntity)
      //     const avatarShapeContainer = new CylinderShape();
      //     avatarShapeContainer.radiusTop = 0.5;
      //     avatarShapeContainer.radiusBottom = 0.5;
      //     avatarShapeContainer.withCollisions = false;
      //     avatarShapeContainer.segmentsHeight = 3;
      //     nftWrapper.addComponent(avatarShapeContainer);
      //     const posYFix = +py + +entityScale.y;
      //     nftWrapper.addComponent(
      //       new Transform({
      //         // position: new Vector3(+px, posYFix, +pz),
      //         position: new Vector3(+px, posYFix, +pz),
      //         scale: new Vector3(
      //           entityScale.x * 1.1,
      //           entityScale.y * 1.1,
      //           entityScale.z * 1.1
      //         ),
      //       })
      //     );
      //     nftWrapper.addComponent(
      //       new OnPointerDown(
      //         async (evt) => {
      //           if (evt.buttonId === 1 || evt.buttonId === 2) return;
      //           await this.buy({
      //             nftAddress,
      //             tokenId,
      //             price,
      //             imageUrl,
      //             title,
      //             resourceId,
      //             width,
      //             height,
      //             audioUrl,
      //             animationUrl,
      //             youtubeUrl,
      //           });
      //         },
      //         {
      //           hoverText: `${this.lang.buyFor} ${price} BAG`,
      //           // hoverText: `${this.lang.buyFor} ${fromWei(price, 'ether')} BAG`,
      //           showFeedback: true,
      //         }
      //       )
      //     );
      //     const avatarShapeContainerMaterial = new Material();
      //     avatarShapeContainerMaterial.albedoColor = new Color4(
      //       0.5,
      //       0.4,
      //       0.6,
      //       this.debug ? 0.65 : 0
      //     );
      //     this.inViewEntity[idSlot] = { entity: nftEntity, nftWrapper };
      //     nftWrapper.addComponent(avatarShapeContainerMaterial);
      //     this.engine.addEntity(nftEntity);
      //     this.engine.addEntity(nftWrapper);
      //   } else {
      //     void this.setPlaneShape(planeShapeData);
      //   }
      // }
    } catch (err) {
      console.log('setSlots::error', err)
      this.onError(err)
    }
  }

  private async setPlaneShape(planeShapeData: any): Promise<void> {
    // TODO
    // const planeEntity = new Entity();
    // const dummyEntity = new Entity();
    // const {
    //   position,
    //   entityScale,
    //   entityRotation,
    //   nftAddress,
    //   tokenId,
    //   price,
    //   imageUrl,
    //   resourceId,
    //   height,
    //   width,
    //   audioUrl,
    //   animationUrl,
    //   youtubeUrl,
    //   name,
    //   id: idSlot,
    // } = planeShapeData;
    // planeEntity.addComponent(
    //   new Transform({
    //     position: new Vector3(position.x, position.y, position.z),
    //     scale: new Vector3(entityScale.x, entityScale.y, entityScale.z),
    //     rotation: entityRotation,
    //   })
    // );
    // const planeShape = new PlaneShape();
    // planeEntity.addComponent(planeShape);
    // // planeShape.height = 100
    // // planeShape.width = 100
    // planeShape.withCollisions = true;
    // // const imageTexture = new Texture(imageUrl)
    // // const planeMaterial = new Material()
    // // planeMaterial.albedoTexture = imageTexture
    // planeEntity.getComponentOrCreate(Material).albedoTexture = new Texture(
    //   imageUrl
    // );
    // // planeEntity.addComponent(planeMaterial)
    // planeEntity.addComponent(
    //   new OnPointerDown(
    //     async (evt) => {
    //       if (evt.buttonId === 1 || evt.buttonId === 2) return;
    //       await this.buy({
    //         nftAddress,
    //         tokenId,
    //         price,
    //         imageUrl,
    //         title: name,
    //         resourceId,
    //         height,
    //         width,
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
    //   )
    // );
    // this.inViewEntity[idSlot] = {
    //   entity: planeEntity,
    //   nftWrapper: dummyEntity,
    // };
    // this.engine.addEntity(planeEntity);
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
    } catch (error) {
      // TODO
      // this.onError('Not a wearable, will try as a plane shape: ' + error)
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
    // TODO
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
      // this.toggleLoader()
      if (this.mana == null) return
      const balance = fromWei(await this.mana.balance(), 'ether')
      if (
        selectedBuyType !== BuySelection.BAG &&
        selectedBuyType !== BuySelection.Paper
      ) {
        const validateBackendWallet = await this.validateBackendWallet(price)
        if (validateBackendWallet) {
          // TODO
          // this.purchaseModal.notificationContainer.visible = false;
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
    // TODO
    // this.purchaseModal.notification(this.lang.buyWithBag, text);
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
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBag,
      //   this.lang.purchaseFailed
      // );
      return
    }

    if (!(await this.isNftAvailable())) {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBag,
      //   this.lang.nftNotAvailable
      // );
      return
    }
    try {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBag,
      //   this.lang.buyingNFT
      // );
      await this.store.buy(nftAddress, [tokenId], tokenPrice, (text) => {
        void this.buyNotidicationCb(text)
      })
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBag,
      //   this.lang.purchaseFailed
      // );
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
      // TODO
      // this.purchaseModal.resetModal();
      // this.purchaseModal.notification(this.lang.buyWithBag, message);
      // custom.show()
      this.onError(err)
      this.debug && console.log(err)
    }
  }

  private async buyWithBinance(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBinance,
      //   this.lang.nftNotAvailable
      // );
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    // TODO
    // this.purchaseModal.notification(
    //   this.lang.buyWithBinance,
    //   this.lang.generatingPaymentLinkAndQR
    // );
    const binanceRes: any = await this.get(`/binance/payment-link` + params)

    if (binanceRes?.status === 200) {
      // TODO
      // this.purchaseModal.toggleModals();
      // const qrJpg = binanceRes.data.qrcodeLink
      // const paymentLink = binanceRes.data.checkoutUrl
      // TODO
      // this.purchaseModal.showQrAndUrl(qrJpg, paymentLink);
    } else {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithBinance,
      //   this.lang.genericError
      // );
    }
  }

  private async buyWithCoinbase(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithCoinbase,
      //   this.lang.nftNotAvailable
      // );
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    // TODO
    // this.purchaseModal.notification(
    //   this.lang.buyWithCoinbase,
    //   this.lang.generatingPaymentLink
    // );
    const coinbaseRes: any = await this.get(`/coinbase/payment-link` + params)
    if (coinbaseRes?.status === 200) {
      // TODO
      // this.purchaseModal.toggleModals();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hosted_url: paymentLink, code } = coinbaseRes.data
      // TODO
      // this.purchaseModal.showQrAndUrl(undefined, paymentLink);
      const intervalId = code
      this.intervals[intervalId] = new LoopSystem(15, () => {
        executeTask(async () => {
          const paymentResult: any = await this.get(
            `/coinbase/payment-status?code=` + code
          )
          console.log('paymentResult: ', paymentResult)
          if (paymentResult.data.payments.length) {
            const paymentConfirmed = paymentResult.data.payments.find(
              (x: any) => x.status === 'CONFIRMED'
            )
            if (paymentConfirmed) {
              // TODO
              // engine.removeSystem(this.intervals[intervalId]);
              delete this.intervals[intervalId]
              // TODO
              // this.purchaseModal.notification(
              //   this.lang.buyWithCoinbase,
              //   this.lang.coinbasePaymentConfirmed
              // );
            }
          }
        })
      })
      // TODO
      // engine.addSystem(this.intervals[intervalId]);
    } else {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithCoinbase,
      //   this.lang.genericError
      // );
    }
  }

  private async buyWithPaper(
    nftAddress: string,
    tokenId: string,
    resourceId: string
  ): Promise<void> {
    if (!(await this.isNftAvailable())) {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithPaper,
      //   this.lang.nftNotAvailable
      // );
      return
    }
    const params = `?nftAddress=${nftAddress}&tokenId=${tokenId}&resourceId=${resourceId}&buyerAddress=${this.fromAddress}&currency=USDT`
    // TODO
    // this.purchaseModal.notification(
    //   this.lang.buyWithPaper,
    //   this.lang.generatingPaymentLink
    // );
    const paperRes: any = await this.get(`/paper/payment-link` + params)
    // TODO
    // this.toggleLoader(false)
    if (paperRes?.status === 200) {
      // TODO
      // this.purchaseModal.toggleModals();
      // const paymentLink = paperRes.data
      // TODO
      // this.purchaseModal.showQrAndUrl(undefined, paymentLink);
    } else {
      // TODO
      // this.purchaseModal.notification(
      //   this.lang.buyWithPaper,
      //   this.lang.genericError
      // );
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
        // this.handleJoystickData(data)
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
      // case 'joystick':
      //   void this.handleJoystickData(payload as JoystickData)
      //   break
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
      // posX,
      // posY,
      // posZ,
      // scaleX,
      // scaleY,
      // scaleZ,
      // rotX,
      // rotY,
      // rotZ,
      bannerId
    } = payload
    if (this.inViewBanners[bannerId] !== undefined) {
      // TODO
      // this.inViewBanners[bannerId].entity.components["engine.transform"] =
      //   new Transform({
      //     position: new Vector3(+posX, +posY, +posZ),
      //     scale: new Vector3(scaleX, scaleY, scaleZ),
      //     rotation: Quaternion.Euler(rotX, rotY, rotZ),
      //   });
    }
  }

  private onEvent(ev: any): void {
    // TODO
    // if (this.purchaseModal.notifyOnEvent) {
    //   const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
    //   const { address, status, type, transactionHash, message } = data;
    //   if (type === "buy") {
    //     if (status === "refund")
    //       this.purchaseModal.notification(
    //         this.lang.purchaseRefunded,
    //         message + " txHash: " + transactionHash
    //       );
    //     // else this.purchaseModal.notification('', this.lang.purchaseSucceed + ' txHash: ' + transactionHash)
    //     else this.purchaseModal.notification("", this.lang.purchaseSucceed);
    //   } else if (type === "cancel") {
    //     this.purchaseModal.notification(
    //       this.lang.listingCanceled,
    //       "txHash: " + transactionHash
    //     );
    //   }
    // }
  }

  private toggleLoader(show: boolean = true): void {
    // TODO
    // if (this.loader) show ? this.loader.show() : this.loader.hide();
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
    await new Promise((resolve) => {
      // TODO
      // const ent = new Entity();
      // engine.addEntity(ent);
      // ent.addComponent(
      //   new ecs.Delay(ms, () => {
      //     resolve();
      //     engine.removeEntity(ent);
      //   })
      // );
    })
  }

  public getVariables(): Variable[] {
    return this.variables
  }
}
