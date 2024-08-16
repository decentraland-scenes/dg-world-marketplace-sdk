export class LoopSystem {
  private readonly targetTime: number = 0
  private timer: number = 0
  public id: number = 0
  cb = () => {}
  constructor(timer: number, cb: () => void) {
    this.targetTime = timer
    this.timer = timer
    this.cb = cb
    return this
  }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt
    } else {
      this.timer = this.targetTime
      this.cb()
    }
  }
}
