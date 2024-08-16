// import * as ui from "@dcl/ui-scene-utils";
// import { LangText } from "../interfaces/index";
// import { config } from "../config/index";
// const { backendUrlPublic } = config;
// enum BuySelection {
//   BAG,
//   Coinbase,
//   Binance,
//   Paper,
// }

// export default class PurchaseModal {
//   private onBuyCB: (selectedBuyType: number) => void;
//   private sansSerifBold = new Font(Fonts.SansSerif_Bold);
//   private liberationSans = new Font(Fonts.LiberationSans);
//   private nftImage: UIImage | null = null;
//   private paymentIconsContainer: UIContainerRect | null = null;
//   private payWithBagContainer: UIContainerRect | null = null;
//   private payWithCoinbaseContainer: UIContainerRect | null = null;
//   private payWithBinanceContainer: UIContainerRect | null = null;
//   // private payWithCreditCardContainer: UIContainerRect | null = null
//   private nftTitle: UIText | null = null;
//   private notificationTitle: UIText | null = null;
//   private nftDescription: UIText | null = null;
//   public notificationText: UIText | null = null;
//   private nftPrice: UIText | null = null;
//   private buyText: UIText | null = null;
//   private buyButton: UIImage | null = null;
//   private playPauseIcon: UIImage | null = null;
//   private copyTxHashTexture: UIImage | null = null;
//   private streamSource: Entity = new Entity();
//   private transparentColor = new Color4(0, 0, 0, 0);
//   private isBuying: boolean = false;
//   private interval: number = 10;
//   private waitUp: boolean = true;
//   private lang: LangText;
//   private buyButtonTexture: Texture;
//   private buyButtonDisabledTexture: Texture;
//   private transparentTexture: Texture;
//   private playIconTexture: Texture;
//   public selectedBuyType: number = BuySelection.BAG;
//   public UIContainer: UIContainerRect;
//   public notificationContainer: UIContainerRect;
//   public canvas: UICanvas;
//   public notifyOnEvent: boolean = true;
//   private balance: number = 0;
//   private tokenPrice: number = 0;

//   constructor({
//     onBuyCB,
//     canvas,
//     lang,
//   }: {
//     onBuyCB: (selectedBuyType: number) => void;
//     canvas: UICanvas;
//     lang: LangText;
//   }) {
//     this.lang = lang;
//     this.canvas = canvas;
//     if (!onBuyCB) throw new Error("Must pass a callback to PurchaseModal");
//     this.onBuyCB = onBuyCB;

//     this.UIContainer = new UIContainerRect(this.canvas);
//     this.UIContainer.isPointerBlocker = false;
//     this.UIContainer.visible = false;

//     this.notificationContainer = new UIContainerRect(this.canvas);
//     this.notificationContainer.isPointerBlocker = false;
//     this.notificationContainer.visible = false;

//     this.buyButtonTexture = new Texture(`${backendUrlPublic}buyButton.png`);
//     this.buyButtonDisabledTexture = new Texture(
//       `${backendUrlPublic}buyButtonDisabled.png`
//     );
//     this.playIconTexture = new Texture(`${backendUrlPublic}play.png`);
//     this.transparentTexture = new Texture(
//       `${backendUrlPublic}transparentTexture.png`
//     );
//     engine.addEntity(this.streamSource);

//     this.createComponents();
//   }

//   public showQrAndUrl(qr?: string, url?: string): void {
//     if (!this.nftImage || !this.buyText || !this.buyButton) return;
//     if (qr) {
//       this.nftImage.source = new Texture(qr);
//       this.nftImage.sourceWidth = 400;
//       this.nftImage.sourceHeight = 400;
//     }
//     if (url) {
//       this.buyButton.source = new Texture(`${backendUrlPublic}buyButton.png`);
//       this.isBuying = false;
//       this.buyText.positionX = 15;
//       this.buyText.fontSize = 15;
//       this.buyText.value = this.lang.openPaymentLink;
//       this.buyButton.onClick = new OnPointerDown(() => {
//         openExternalURL(url);
//         this.notification("", this.lang.waitingCoinbase);
//         this.UIContainer.visible = false;
//       });
//     }
//     this.UIContainer.visible = true;
//   }

//   public toggleModals(showNotification: boolean = false): void {
//     if (showNotification) {
//       this.notificationContainer.visible = true;
//       this.UIContainer.visible = false;
//     } else {
//       this.notificationContainer.visible = false;
//       this.UIContainer.visible = true;
//     }
//   }

//   public notification(title: string, text: string): void {
//     if (!this.notificationTitle || !this.notificationText) return;
//     this.notificationTitle.value = title ? title : this.notificationTitle.value;
//     const message: string[] = [];
//     const chunkLength = 42;
//     const charWidth = 6;
//     const totalLines = Math.ceil(text.length / chunkLength);
//     for (let currentLine = 0; currentLine < totalLines; currentLine++) {
//       const start = currentLine * chunkLength;
//       const end = start + chunkLength;
//       message.push(text.slice(start, end));
//     }

//     const containerHeight = 60 + (totalLines > 1 ? totalLines * 15 : 15);
//     this.UIContainer.visible = false;
//     this.notificationContainer.height = containerHeight;
//     this.notificationContainer.visible = true;

//     this.notificationTitle.positionX =
//       (300 - this.notificationTitle.value.length * 12) / 2;

//     this.notificationText.value = message.join("\n");
//     // center text
//     const factor = (message[0].length * charWidth) / 255;
//     this.notificationText.positionX = 150 - 150 * factor;

//     // this.copyTxHashTexture.height = containerHeight
//     // this.copyTxHashTexture.onClick = new OnPointerDown(() => {
//     //   const custom = new ui.CustomPrompt('dark', 250, 100)
//     //   custom.addText('Trasaction hash logged on the console. \n Please open it to copy.', 0, 0, undefined, 12)
//     // })
//     // this.notificationText.positionY = 50 - 12 * totalLines
//   }

//   // public noFunds({
//   //   nftImagePath,
//   //   nftTitle,
//   //   nftDesc,
//   //   nftPrice
//   // }: {
//   //   nftImagePath: string
//   //   nftTitle: string
//   //   nftDesc: string
//   //   nftPrice: number
//   // }): void {
//   //   if (!this.nftImage || !this.nftTitle || !this.nftDescription || !this.nftPrice || !this.buyButton) return
//   //   this.nftImage.source = new Texture(nftImagePath)
//   //   this.nftImage.sourceWidth = 256
//   //   this.nftImage.sourceHeight = 256
//   //   this.nftTitle.value = nftTitle
//   //   this.nftDescription.value = nftDesc
//   //   this.nftPrice.value = nftPrice.toString()
//   //   this.buyButton.onClick = null
//   //   if (this.buyText) {
//   //     this.buyText.value = this.lang.noFundsButton
//   //   }
//   //   if (this.buyButton) this.buyButton.source = new Texture(`${backendUrlPublic}buyButtonDisabled.png`)
//   //   this.UIContainer.visible = false
//   // }

//   public openModal({
//     nftImagePath,
//     nftTitle,
//     nftDesc,
//     nftPrice,
//     width,
//     height,
//     audioUrl,
//     animationUrl,
//     youtubeUrl,
//     paymentMethod,
//     balance,
//   }: {
//     nftImagePath: string;
//     nftTitle: string;
//     nftDesc: string;
//     nftPrice: number;
//     width: number;
//     height: number;
//     audioUrl?: string;
//     animationUrl?: string;
//     youtubeUrl?: string;
//     paymentMethod: string;
//     balance: string;
//   }): void {
//     if (
//       !this.nftImage ||
//       !this.nftTitle ||
//       !this.nftDescription ||
//       !this.nftPrice ||
//       !this.notificationTitle
//     )
//       return;
//     this.balance = +balance;
//     this.tokenPrice = nftPrice;
//     this.nftImage.source = new Texture(nftImagePath);
//     const titleLength = nftTitle.length;
//     let ratio = 1;
//     if (width > height) {
//       ratio = width / height;
//       this.nftImage.width = 256;
//       this.nftImage.height = 256 / ratio;
//     } else if (height > width) {
//       ratio = height / width;
//       this.nftImage.width = 256 / ratio;
//       this.nftImage.height = 256;
//     } else {
//       this.nftImage.width = 256;
//       this.nftImage.height = 256;
//     }
//     this.nftImage.sourceWidth = width || 256;
//     this.nftImage.sourceHeight = height || 256;
//     this.nftTitle.value = nftTitle;
//     if (titleLength > 25 && titleLength < 50) {
//       this.nftTitle.fontSize = 18;
//     } else if (titleLength > 50) {
//       this.nftTitle.value = nftTitle.slice(0, 25) + "...";
//       this.nftTitle.fontSize = 18;
//     }
//     this.nftDescription.value = nftDesc;
//     this.nftPrice.value = nftPrice.toString();
//     this.UIContainer.visible = true;
//     if (audioUrl && this.playPauseIcon) {
//       this.playPauseIcon.visible = true;
//       if (this.streamSource.hasComponent(AudioStream)) {
//         this.streamSource.removeComponent(AudioStream);
//       }
//       this.streamSource.addComponent(new AudioStream(audioUrl));
//       this.streamSource.getComponent(AudioStream).playing = false;
//     }
//   }

//   private createComponents(): void {
//     // UIContainer setup
//     this.UIContainer.width = "600";
//     this.UIContainer.height = "300";
//     this.UIContainer.color = Color4.Black();
//     this.UIContainer.hAlign = "mid";
//     this.UIContainer.vAlign = "mid";
//     this.UIContainer.opacity = 0.92;
//     this.UIContainer.isPointerBlocker = true;

//     // Notification container setup
//     this.notificationContainer.width = "300";
//     this.notificationContainer.height = "0";
//     this.notificationContainer.color = Color4.Black();
//     this.notificationContainer.hAlign = "mid";
//     this.notificationContainer.vAlign = "mid";
//     this.notificationContainer.opacity = 0.92;
//     this.notificationContainer.isPointerBlocker = true;

//     // Log tx hash button
//     // this.copyTxHashTexture = new UIImage(this.notificationContainer, this.buyButtonTexture)
//     // this.copyTxHashTexture.positionX = -0
//     // this.copyTxHashTexture.positionY = 0
//     // this.copyTxHashTexture.height = 50 // Este es el tamaño del contenedor de la imagen
//     // this.copyTxHashTexture.width = 300
//     // this.copyTxHashTexture.sourceTop = 0
//     // this.copyTxHashTexture.sourceWidth = 1 // Esto es para indicar el tamaño original de la imagen
//     // this.copyTxHashTexture.sourceHeight = 1
//     // this.copyTxHashTexture.onClick = new OnPointerDown(() => {
//     //   log('somebody clicked me!')
//     // })

//     // Load textures
//     const closeTexture = new Texture(`${backendUrlPublic}close.png`);
//     const tickTexture = new Texture(`${backendUrlPublic}tick.png`);
//     const nftImagePlaceholderTexture = new Texture(
//       `${backendUrlPublic}DGPlaceholder.png`
//     );
//     const bagIconTexture = new Texture(`${backendUrlPublic}bag.png`);
//     const pauseIconTexture = new Texture(`${backendUrlPublic}pause.png`);
//     this.playIconTexture = new Texture(`${backendUrlPublic}play.png`);
//     // NFT Image setup
//     const nftImagePlaceholder = nftImagePlaceholderTexture;
//     this.nftImage = new UIImage(this.UIContainer, nftImagePlaceholder);
//     this.nftImage.height = 256; // Este es el tamaño del contenedor de la imagen
//     this.nftImage.width = 256;
//     this.nftImage.hAlign = "top";
//     this.nftImage.vAlign = "left";
//     this.nftImage.positionY = 0; //Esto es posicionamiento con respecto al padre
//     this.nftImage.positionX = -150;
//     this.nftImage.sourceLeft = 0; // Esto es para moverse en un sprite
//     this.nftImage.sourceTop = 0;
//     this.nftImage.sourceWidth = 256; // Esto es para indicar el tamaño original de la imagen
//     this.nftImage.sourceHeight = 256;

//     // NFT Title
//     this.nftTitle = new UIText(this.UIContainer);
//     this.nftTitle.value = "Amnesia Gear";
//     this.nftTitle.font = this.sansSerifBold;
//     this.nftTitle.fontSize = 25;
//     this.nftTitle.vAlign = "top";
//     this.nftTitle.hAlign = "right";
//     this.nftTitle.positionX = 0;
//     this.nftTitle.positionY = -20;
//     this.nftTitle.adaptHeight = true;
//     this.nftTitle.width = 300;

//     // NFT Description
//     this.nftDescription = new UIText(this.UIContainer);
//     this.nftDescription.value = "DCL Wearable 13/10000";
//     this.nftDescription.font = this.liberationSans;
//     this.nftDescription.fontSize = 13;
//     this.nftDescription.vAlign = "top";
//     this.nftDescription.hAlign = "right";
//     this.nftDescription.positionX = 0;
//     this.nftDescription.positionY = -60;
//     this.nftDescription.width = 300;
//     this.nftDescription.adaptWidth = false;
//     this.nftDescription.adaptHeight = true;
//     this.nftDescription.textWrapping = true;
//     this.nftDescription.color = Color4.Gray();

//     // Notification Title
//     this.notificationTitle = new UIText(this.notificationContainer);
//     this.notificationTitle.value = "Notification Title";
//     this.notificationTitle.font = this.sansSerifBold;
//     this.notificationTitle.fontSize = 25;
//     this.notificationTitle.vAlign = "top";
//     this.notificationTitle.hAlign = "left";
//     this.notificationTitle.positionX = 0;
//     this.notificationTitle.positionY = 10;
//     this.notificationTitle.width = 300;

//     // Notification text
//     this.notificationText = new UIText(this.notificationContainer);
//     this.notificationText.value = "Notification text";
//     this.notificationText.font = this.liberationSans;
//     this.notificationText.fontSize = 13;
//     this.notificationText.vAlign = "bottom";
//     this.notificationText.hAlign = "center";
//     this.notificationText.positionX = 10;
//     this.notificationText.positionY = 10;
//     this.notificationText.width = 300;
//     this.notificationText.color = Color4.Gray();

//     // Payment Icons Container
//     this.paymentIconsContainer = new UIContainerRect(this.UIContainer);
//     this.paymentIconsContainer.width = "300";
//     this.paymentIconsContainer.height = "100";
//     this.paymentIconsContainer.hAlign = "right";
//     this.paymentIconsContainer.vAlign = "bottom";
//     this.paymentIconsContainer.positionX = -13;
//     this.paymentIconsContainer.positionY = 100;

//     //Custom toggle
//     const toggleImg = new UIImage(this.paymentIconsContainer, tickTexture);
//     toggleImg.positionX = -135;
//     toggleImg.positionY = -60;
//     toggleImg.height = 24; // Este es el tamaño del contenedor de la imagen
//     toggleImg.width = 24;
//     toggleImg.sourceTop = 0;
//     toggleImg.sourceWidth = 256; // Esto es para indicar el tamaño original de la imagen
//     toggleImg.sourceHeight = 256;
//     toggleImg.onClick = new OnPointerDown(() => {
//       this.notifyOnEvent = !this.notifyOnEvent;
//       toggleImg.source = this.notifyOnEvent ? tickTexture : closeTexture;
//     });

//     const notifyEventLabel = new UIText(this.paymentIconsContainer);
//     notifyEventLabel.value = "Notify me on event";
//     notifyEventLabel.fontSize = 15;
//     notifyEventLabel.vAlign = "mid";
//     notifyEventLabel.hAlign = "mid";
//     notifyEventLabel.positionY = -45;
//     notifyEventLabel.positionX = -65;
//     notifyEventLabel.adaptWidth = false;
//     notifyEventLabel.color = Color4.White();
//     notifyEventLabel.isPointerBlocker = false;
//     //Create available payment methods
//     this.payWithBagContainer = this.createPayWithBag();
//     this.payWithCoinbaseContainer = this.createPayWithCoinbase();
//     this.payWithBinanceContainer = this.createPayWithBinance();
//     // this.payWithCreditCardContainer = this.createPayWithCreditCard()

//     //Create pay button
//     this.buyButton = new UIImage(this.UIContainer, this.buyButtonTexture);
//     this.buyButton.width = 170;
//     this.buyButton.height = 45;
//     this.buyButton.hAlign = "right";
//     this.buyButton.vAlign = "bottom";
//     this.buyButton.positionX = -30;
//     this.buyButton.positionY = 25;
//     this.buyButton.onClick = new OnPointerDown(() => {
//       this.isBuying = true;
//       this.notification("", "Buying...");
//       this.onBuyCB(this.selectedBuyType);
//       // if (!this.isBuying) {
//       //   if (this.buyText) this.buyText.value = this.lang.wait
//       //   if (this.buyButton) this.buyButton.source = this.buyButtonDisabledTexture
//       //   this.onBuyCB(this.selectedBuyType)
//       //   this.isBuying = true
//       // }
//     });

//     // Create buy text
//     this.buyText = new UIText(this.buyButton);
//     this.buyText.value = this.lang.buy;
//     this.buyText.fontSize = 20;
//     this.buyText.width = this.buyText.value.length * this.buyText.fontSize;
//     this.buyText.vAlign = "mid";
//     this.buyText.hAlign = "left";
//     this.buyText.positionY = 15;
//     this.buyText.color = Color4.White();
//     this.buyText.isPointerBlocker = false;
//     this.buyText.positionX = this.centerText(this.buyText);

//     // Create price container
//     const priceContainer = new UIContainerRect(this.UIContainer);
//     priceContainer.width = "100";
//     priceContainer.height = "48";
//     priceContainer.color = Color4.Black();
//     priceContainer.hAlign = "right";
//     priceContainer.vAlign = "bottom";
//     priceContainer.positionX = -210;
//     priceContainer.positionY = 23;
//     priceContainer.isPointerBlocker = false;

//     // Create price text
//     this.nftPrice = new UIText(priceContainer);
//     this.nftPrice.value = "1500000";
//     this.nftPrice.font = this.liberationSans;
//     this.nftPrice.fontSize = 15;
//     this.nftPrice.vAlign = "mid";
//     this.nftPrice.hAlign = "mid";
//     this.nftPrice.positionX = 30;
//     this.nftPrice.positionY = 0;
//     this.nftPrice.width = 300;
//     this.nftPrice.adaptWidth = false;
//     this.nftPrice.adaptHeight = true;
//     this.nftPrice.textWrapping = true;
//     this.nftPrice.color = Color4.Gray();
//     this.nftPrice.isPointerBlocker = false;

//     // Create price icon
//     const bagLogo = new UIImage(priceContainer, bagIconTexture);
//     bagLogo.height = 25; // Este es el tamaño del contenedor de la imagen
//     bagLogo.width = 25;
//     bagLogo.hAlign = "mid";
//     bagLogo.vAlign = "mid";
//     bagLogo.positionY = 0; //Esto es posicionamiento con respecto al padre
//     bagLogo.positionX = -35;
//     bagLogo.sourceLeft = 0; // Esto es para moverse en un sprite
//     bagLogo.sourceTop = 0;
//     bagLogo.sourceWidth = 512; // Esto es para indicar el tamaño original de la imagen
//     bagLogo.sourceHeight = 512;

//     // Create play icon
//     this.playPauseIcon = new UIImage(this.UIContainer, this.playIconTexture);
//     this.playPauseIcon.visible = false;
//     this.playPauseIcon.height = 64; // Este es el tamaño del contenedor de la imagen
//     this.playPauseIcon.width = 64;
//     this.playPauseIcon.hAlign = "mid";
//     this.playPauseIcon.vAlign = "mid";
//     this.playPauseIcon.positionY = 0; //Esto es posicionamiento con respecto al padre
//     this.playPauseIcon.positionX = -150;
//     this.playPauseIcon.sourceLeft = 0; // Esto es para moverse en un sprite
//     this.playPauseIcon.sourceTop = 0;
//     this.playPauseIcon.sourceWidth = 256; // Esto es para indicar el tamaño original de la imagen
//     this.playPauseIcon.sourceHeight = 256;
//     this.playPauseIcon.onClick = new OnPointerDown(() => {
//       if (this.streamSource.hasComponent(AudioStream) && this.playPauseIcon) {
//         const audioStream = this.streamSource.getComponent(AudioStream);
//         audioStream.playing = !audioStream.playing;

//         this.playPauseIcon.source = audioStream.playing
//           ? pauseIconTexture
//           : this.playIconTexture;
//       }
//     });

//     //Create close button
//     const closeModal = new UIImage(this.UIContainer, closeTexture);
//     closeModal.height = 70; // Este es el tamaño del contenedor de la imagen
//     closeModal.width = 70;
//     closeModal.hAlign = "right";
//     closeModal.vAlign = "top";
//     closeModal.positionY = 10; //Esto es posicionamiento con respecto al padre
//     closeModal.positionX = 40;
//     closeModal.sourceWidth = 512; // Esto es para indicar el tamaño original de la imagen
//     closeModal.sourceHeight = 512;
//     closeModal.onClick = new OnPointerDown(() => {
//       this.resetModal(this.buyButtonTexture);
//       this.UIContainer.visible = false;
//     });

//     //Create close button Notification
//     const closeNotificationModal = new UIImage(
//       this.notificationContainer,
//       closeTexture
//     );
//     closeNotificationModal.height = 70; // Este es el tamaño del contenedor de la imagen
//     closeNotificationModal.width = 70;
//     closeNotificationModal.hAlign = "right";
//     closeNotificationModal.vAlign = "top";
//     closeNotificationModal.positionY = 10; //Esto es posicionamiento con respecto al padre
//     closeNotificationModal.positionX = 40;
//     closeNotificationModal.sourceWidth = 512; // Esto es para indicar el tamaño original de la imagen
//     closeNotificationModal.sourceHeight = 512;
//     closeNotificationModal.onClick = new OnPointerDown(() => {
//       this.UIContainer.visible = false;
//       this.notificationContainer.visible = false;
//       this.resetModal(this.buyButtonTexture);
//     });
//   }

//   public resetModal(texture: Texture = this.buyButtonTexture) {
//     if (
//       !this.buyButton ||
//       !this.buyText ||
//       !this.payWithBagContainer ||
//       !this.payWithCoinbaseContainer ||
//       !this.payWithBinanceContainer ||
//       // !this.payWithCreditCardContainer ||
//       !this.streamSource
//     )
//       return;
//     this.buyButton.source = texture;
//     this.buyButton.onClick = new OnPointerDown(() => {
//       if (!this.isBuying) {
//         if (this.buyText) this.buyText.value = this.lang.wait;
//         if (this.buyButton)
//           this.buyButton.source = this.buyButtonDisabledTexture;
//         this.onBuyCB(this.selectedBuyType);
//         this.isBuying = true;
//       }
//     });
//     this.buyText.positionX = 65;
//     this.buyText.fontSize = 20;
//     this.buyText.value = "Buy";
//     this.payWithBagContainer.color = Color4.Gray();
//     this.payWithCoinbaseContainer.color = this.transparentColor;
//     this.payWithBinanceContainer.color = this.transparentColor;
//     // this.payWithCreditCardContainer.color = this.transparentColor
//     this.isBuying = false;
//     // this.notifyOnEvent = false
//     this.interval = 10;
//     if (this.playPauseIcon) {
//       this.playPauseIcon.visible = false;
//       this.playPauseIcon.source = this.playIconTexture;
//     }
//     this.streamSource.removeComponent(AudioStream);
//   }
//   private createPayWithBag(): UIContainerRect {
//     const container = this.createPayContainer(0, true);
//     this.createPayTitle("BAG", container);
//     this.createPayIcon(container, "bag.png", BuySelection.BAG);
//     return container;
//   }

//   private createPayWithCoinbase(): UIContainerRect {
//     const container = this.createPayContainer(75, false);
//     this.createPayTitle("Coinbase", container);
//     this.createPayIcon(container, "coinbase.png", BuySelection.Coinbase);
//     return container;
//   }

//   private createPayWithBinance(): UIContainerRect {
//     const container = this.createPayContainer(150, false);
//     this.createPayTitle("Binance", container);
//     this.createPayIcon(container, "binance.png", BuySelection.Binance);
//     return container;
//   }

//   private createPayWithCreditCard(): UIContainerRect {
//     const container = this.createPayContainer(225, false);
//     this.createPayTitle("Card", container);
//     this.createPayIcon(container, "paper.png", BuySelection.Paper);
//     return container;
//   }

//   private createPayContainer(
//     positionX: number,
//     active: boolean
//   ): UIContainerRect {
//     const _container = new UIContainerRect(this.paymentIconsContainer);
//     _container.width = "70";
//     _container.height = "80";
//     _container.hAlign = "left";
//     _container.positionX = positionX;
//     _container.color = active ? Color4.Gray() : this.transparentColor;
//     return _container;
//   }

//   private createPayTitle(name: string, parent: UIContainerRect): UIText {
//     const _uiText = new UIText(parent);
//     _uiText.value = name;
//     _uiText.width = 70;
//     _uiText.font = this.liberationSans;
//     _uiText.fontSize = 13;
//     _uiText.vAlign = "bottom";
//     _uiText.hTextAlign = "center";
//     _uiText.textWrapping = true;
//     _uiText.color = Color4.White();
//     _uiText.positionX = 3;
//     _uiText.positionY = 5;
//     return _uiText;
//   }

//   private createPayIcon(
//     parent: UIContainerRect,
//     resource: string,
//     buySelection: number
//   ): UIImage {
//     const _uiImage = new UIImage(
//       parent,
//       new Texture(`${backendUrlPublic}${resource}`)
//     );
//     _uiImage.height = 50;
//     _uiImage.width = 50;
//     _uiImage.sourceWidth = 512;
//     _uiImage.sourceHeight = 512;
//     _uiImage.positionX = 0;
//     _uiImage.positionY = +7;
//     _uiImage.onClick = new OnPointerDown(() => {
//       this.selectedBuyType = buySelection;
//       this.switchSelection();
//     });
//     return _uiImage;
//   }

//   private switchSelection() {
//     if (
//       !this.payWithBagContainer ||
//       !this.payWithBinanceContainer ||
//       !this.payWithCoinbaseContainer
//       //  ||!this.payWithCreditCardContainer
//     )
//       return;

//     this.payWithBagContainer.color = this.transparentColor;
//     this.payWithCoinbaseContainer.color = this.transparentColor;
//     this.payWithBinanceContainer.color = this.transparentColor;
//     // this.payWithCreditCardContainer.color = this.transparentColor

//     switch (this.selectedBuyType) {
//       case BuySelection.BAG:
//         this.payWithBagContainer.color = Color4.Gray();
//         break;

//       case BuySelection.Coinbase:
//         this.payWithCoinbaseContainer.color = Color4.Gray();
//         break;

//       case BuySelection.Binance:
//         this.payWithBinanceContainer.color = Color4.Gray();
//         break;

//       // case BuySelection.Paper:
//       //   this.payWithCreditCardContainer.color = Color4.Gray()
//       //   break
//     }
//   }
//   private centerText(element: any): number {
//     const parentWidth = +element.parent.width.split("px")[0];
//     const chars = element.value.replace(/\s/g, "").length;
//     const factor = (element.fontSize * chars) / 2.8;
//     const pos = parentWidth / 2 - factor;
//     return pos;
//   }
// }

type OpenModalProps = {
  nftImagePath: string
  nftTitle: string
  nftDesc: string
  nftPrice: number
  width: number
  height: number
  audioUrl?: string
  animationUrl?: string
  youtubeUrl?: string
  paymentMethod: string
  balance: string
}

export default class PurchaseModal {
  public openModal(props: OpenModalProps): void {
    // const {
    //     nftImagePath,
    //     nftTitle,
    //     nftDesc,
    //     nftPrice,
    //     width,
    //     height,
    //     audioUrl,
    //     animationUrl,
    //     youtubeUrl,
    //     paymentMethod,
    //     balance,
    // } = props
  }
}
