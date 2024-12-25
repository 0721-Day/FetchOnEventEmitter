export default class EventEmitter<EventKeyValues> {
  constructor() {}

  private _events: {
    [K in keyof EventKeyValues]?: ((data: EventKeyValues[K]) => void)[];
  } = {};

  public on<EventKey extends keyof EventKeyValues>(
    a: EventKey,
    handler: (data: EventKeyValues[EventKey]) => void
  ) {
    if (!this._events[a]) this._events[a] = [];
    this._events[a].push(handler);
    return () => this.off(a, handler);
  }

  public off<EventKey extends keyof EventKeyValues>(
    a: EventKey,
    handler: (data: EventKeyValues[EventKey]) => void
  ) {
    const index = this._events[a]?.indexOf(handler);
    if (index !== undefined && index !== -1) this._events[a]!.splice(index, 1);
  }

  public emit<EventKey extends keyof EventKeyValues>(
    a: EventKey,
    data: EventKeyValues[EventKey]
  ) {
    this._events[a]?.forEach((v) => v(data));
  }
}
