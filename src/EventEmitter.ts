export default class EventEmitter<EventKeyValues> {
  constructor() {}

  private _events: {
    [K in keyof EventKeyValues]?: ((
      data: EventKeyValues[K] & { eventTag: K }
    ) => void)[];
  } = {};

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
  }
}
