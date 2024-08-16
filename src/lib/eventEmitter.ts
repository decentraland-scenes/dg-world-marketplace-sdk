export class EventEmitter {
  private _events: Record<string, Array<(...args: any) => void>> = {}

  on(event: string, listener: (...args: any) => void): void {
    if (this._events[event] === undefined) {
      this._events[event] = []
    }
    this._events[event].push(listener)
  }

  emit(event: string, ...args: any[]): void {
    if (this._events[event] !== undefined) {
      this._events[event].forEach((listener) => {
        listener(...args)
      })
    }
  }
}
