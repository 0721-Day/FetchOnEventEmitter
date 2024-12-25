export default class EventEmitter<EventKeyValues> {
  constructor() {}

  private _events: {
    [K in keyof EventKeyValues]?: ((
      data: EventKeyValues[K] & { eventTag: K }
    ) => void)[];
  } = {};

  private _wildcard: ((
    data: EventKeyValues[keyof EventKeyValues] & {
      eventTag: keyof EventKeyValues;
    }
  ) => void)[] = [];

  public on<EventKey extends keyof EventKeyValues>(
    events: EventKey | EventKey[],
    handler: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void
  ): () => void {
    const eventArray = Array.isArray(events) ? events : [events];

    eventArray.forEach((event) => {
      if (!this._events[event]) this._events[event] = [];
      this._events[event]!.push(handler);
    });

    return () => eventArray.forEach((event) => this.off(event, handler));
  }

  public onAll<EventKey extends keyof EventKeyValues>(
    handler: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void
  ) {
    this._wildcard.push(handler);
    return () => this.offAll(handler);
  }

  public offAll(
    handler: (
      data: EventKeyValues[keyof EventKeyValues] & {
        eventTag: keyof EventKeyValues;
      }
    ) => void
  ): void {
    const index = this._wildcard.indexOf(handler);
    if (index !== -1) this._wildcard.splice(index, 1);
  }

  public off<EventKey extends keyof EventKeyValues>(
    event: EventKey,
    handler: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void
  ): void {
    const handlers = this._events[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    }
  }

  public emit<EventKey extends keyof EventKeyValues>(
    event: EventKey,
    data: EventKeyValues[EventKey]
  ): void {
    const handlers = this._events[event];
    if (handlers) {
      handlers.forEach((handler) => handler({ ...data, eventTag: event }));
    }

    // 触发通配符事件的处理函数
    this._wildcard.forEach((handler) => handler({ ...data, eventTag: event }));
  }
}
