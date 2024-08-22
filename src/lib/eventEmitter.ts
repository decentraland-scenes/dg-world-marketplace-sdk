export class EventEmitter<T extends Record<string, any>> {
  private _events: Record<string, Array<(arg: any) => void>> = {}

  on<TName extends keyof T & string>(
    event: TName,
    handler: (eventArg: T[TName]) => void
  ): void {
    if (this._events[event] === undefined) {
      this._events[event] = []
    }
    this._events[event].push(handler)
  }

  emit<TName extends keyof T & string>(event: TName, arg?: T[TName]): void {
    if (this._events[event] !== undefined) {
      this._events[event].forEach((listener) => {
        listener(arg)
      })
    }
  }
}
