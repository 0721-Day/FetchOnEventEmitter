export default class EventEmitter<EventKeyValues> {
  constructor() {}

  // 用于生成唯一的 index
  private _indexCounter: number = 0;

  // 具名事件的处理函数
  private _events: {
    [K in keyof EventKeyValues]?: {
      handler: (data: EventKeyValues[K] & { eventTag: K }) => void;
      once: boolean;
      priority: number;
      index: number; // 添加 index 属性
    }[];
  } = {};

  // 通配符事件的处理函数
  private _wildcard: {
    handler: (
      data: EventKeyValues[keyof EventKeyValues] & {
        eventTag: keyof EventKeyValues;
      }
    ) => void;
    once: boolean;
    priority: number;
    index: number; // 添加 index 属性
  }[] = [];

  /**
   * 订阅一个或多个事件，或订阅所有事件（使用 "*"）。
   *
   * @template EventKey - 事件键的类型，必须是 `EventKeyValues` 的键之一。
   * @param {EventKey | EventKey[] | "*"} events - 要订阅的事件名称或事件名称数组，使用 "*" 表示订阅所有事件。
   * @param {(data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void} handler - 事件触发时的处理函数。
   * @param {Object} [options] - 可选参数，包含 `once` 和 `priority` 属性。
   * @param {boolean} [options.once=false] - 是否只订阅一次事件。
   * @param {number} [options.priority=10] - 事件处理的优先级，数值越大优先级越高。同优先级下，先订阅的先执行。
   * @returns {() => void} - 返回一个函数，调用该函数可以取消订阅。
   *
   * @example
   * // 订阅单个事件
   * const unsubscribe = emitter.on("EventBus:Created", (data) => {
   *   console.log("EventBus:Created triggered", data);
   * });
   *
   * // 订阅多个事件
   * const unsubscribe = emitter.on(["Event1", "Event2"], (data) => {
   *   console.log("Event1 or Event2 triggered", data);
   * });
   *
   * // 订阅所有事件
   * const unsubscribe = emitter.on("*", (data) => {
   *   console.log("Any event triggered", data);
   * });
   */
  public on<EventKey extends keyof EventKeyValues>(
    events: EventKey | EventKey[] | "*",
    handler: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void,
    options: { once?: boolean; priority?: number } = {}
  ): () => void {
    const { once = false, priority = 10 } = options;
    const index = this._indexCounter++; // 分配唯一的 index

    if (events === "*") return this._onAll(handler, { once, priority, index });

    const eventArray = Array.isArray(events) ? events : [events];

    eventArray.forEach((event) => {
      if (!this._events[event]) this._events[event] = [];
      this._events[event]!.push({ handler, once, priority, index });
      // 按优先级和 index 排序
      this._events[event]!.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority; // 优先级高的在前
        return a.index - b.index; // 同优先级下，index 小的在前
      });
    });

    return () => eventArray.forEach((event) => this.off(event, handler));
  }

  // 添加通配符事件的处理函数
  private _onAll<EventKey extends keyof EventKeyValues>(
    handler: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void,
    options: { once: boolean; priority: number; index: number }
  ) {
    const { once, priority, index } = options;
    this._wildcard.push({ handler, once, priority, index });
    // 按优先级和 index 排序
    this._wildcard.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority; // 优先级高的在前
      return a.index - b.index; // 同优先级下，index 小的在前
    });
    return () => this._offAll(handler);
  }

  // 移除所有通配符事件的处理函数
  private _offAll(
    handler: (
      data: EventKeyValues[keyof EventKeyValues] & {
        eventTag: keyof EventKeyValues;
      }
    ) => void
  ): void {
    this._wildcard = this._wildcard.filter((h) => h.handler !== handler);
  }

  /**
   * 取消订阅某个事件或所有事件（使用 "*"）。
   *
   * @template EventKey - 事件键的类型，必须是 `EventKeyValues` 的键之一。
   * @param {EventKey | "*"} event - 要取消订阅的事件名称，使用 "*" 表示取消订阅所有事件。
   * @param {(data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void} handler - 要移除的处理函数。如果未提供，则移除该事件的所有处理函数。
   *
   * @example
   * // 取消订阅单个事件的处理函数
   * emitter.off("EventBus:Created", handler);
   *
   * // 取消订阅某个事件的所有处理函数
   * emitter.off("EventBus:Created");
   *
   * // 取消订阅所有事件的处理函数
   * emitter.off("*");
   */
  public off<EventKey extends keyof EventKeyValues>(
    event: EventKey | "*",
    handler?: (data: EventKeyValues[EventKey] & { eventTag: EventKey }) => void
  ): void {
    // 移除通配符事件的处理函数
    if (event === "*") {
      if (handler) return this._offAll(handler);
      this._wildcard = [];
      return;
    }

    // 移除指定事件的处理函数
    const handlers = this._events[event];
    if (handlers) {
      if (handler) {
        this._events[event] = handlers.filter((h) => h.handler !== handler);
      } else {
        delete this._events[event];
      }
    }
  }

  /**
   * 触发某个事件，并传递相关数据。
   *
   * @template EventKey - 事件键的类型，必须是 `EventKeyValues` 的键之一。
   * @param {EventKey} event - 要触发的事件名称。
   * @param {EventKeyValues[EventKey]} data - 传递给事件处理函数的数据。
   *
   * @example
   * emitter.emit("EventBus:Created", { /* 数据 *\/ });
   */
  public async emit<EventKey extends keyof EventKeyValues>(
    event: EventKey,
    data: EventKeyValues[EventKey]
  ): Promise<void> {
    const handlers = this._events[event];
    if (handlers) {
      for (const { handler, once } of handlers) {
        await handler({ ...data, eventTag: event });
        if (once) this.off(event, handler);
      }
    }

    // 触发通配符事件的处理函数
    for (const { handler, once } of this._wildcard) {
      await handler({ ...data, eventTag: event });
      if (once) this._offAll(handler);
    }
  }
}
