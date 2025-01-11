import EventEmitter from "./EventEmitter";

interface EventFetchExtendEventBus {
  "EventFetch:Fetch:Request": any;
  "EventFetch:Fetch:Response": any;
}

type EventFetchRequestHander<ApiKey> = {
  success: boolean;
  message: string;
  requestId: string;
  apiKey: ApiKey;
};

type EventFetchRequestDataFormat<T, ApiKey> = {
  data: T;
  header: EventFetchRequestHander<ApiKey>;
  userInfo: {
    requesterId: string;
    remoteId: string;
  };
};

type EventFetchResponseDataFormat<T, ApiKey> = {
  data: T;
  header: EventFetchRequestHander<ApiKey>;
  userInfo: {
    requesterId: string;
    replayerId: string;
  };
};

export default class EventFetch<
  EventFetchApi extends {
    [ApiKey in keyof EventFetchApi]: [
      EventFetchApi[ApiKey][0],
      EventFetchApi[ApiKey][1]
    ];
  },
  EventKeyValues
> extends EventEmitter<EventKeyValues & EventFetchExtendEventBus> {
  private _selfId: string;

  private _createSelfId = () =>
    "u-" + Math.random().toString(36).substring(2, 15);

  /**
   * 创建一个 `EventFetch` 实例，用于管理 API 请求和响应事件。
   *
   * @template EventFetchApi - API 定义的泛型类型，表示 API 键与其请求和响应数据类型的映射。
   * @template EventKeyValues - 事件键与其数据类型的映射。
   * @param {string} [selfId] - 当前实例的唯一标识符。如果未提供，将自动生成一个随机 ID。
   *
   * @example
   * // 创建一个 EventFetch 实例，使用自定义 ID
   * const eventFetch = new EventFetch<EventFetchApis, EventKeyValues>("my-instance-id");
   *
   * @example
   * // 创建一个 EventFetch 实例，自动生成 ID
   * const eventFetch = new EventFetch<EventFetchApis, EventKeyValues>();
   */
  constructor(selfId?: string) {
    super();
    this._selfId = selfId ?? this._createSelfId();

    // 在总线上监听请求的响应
    this.on(
      "EventFetch:Fetch:Response",
      <ApiKey extends keyof EventFetchApi>(
        v: EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
      ) => {
        // 根据请求ID触发相应函数
        this._EventToResponseHandler.get(v.header.requestId)?.(v);
      }
    );
  }

  private _EventToResponseHandler: Map<
    string,
    <ApiKey extends keyof EventFetchApi>(
      data: EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
    ) => void
  > = new Map();

  private _createRequestId = () =>
    "o-" + Math.random().toString(36).substring(2, 15);

  /**
   * 发起一个 API 请求，并返回一个 Promise，等待响应或超时。
   *
   * @template ApiKey - API 键的类型，必须是 `EventFetchApi` 的键之一。
   * @param {ApiKey} api - 要调用的 API 键。
   * @param {EventFetchApi[ApiKey][0]} params - API 请求的参数。
   * @param {string} [remoteId] - 远程目标 ID，默认为当前实例的 ID。
   * @param {number} [timeout=5000] - 请求超时时间（毫秒），默认为 5000 毫秒。
   * @returns {Promise<EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>>} - 返回一个 Promise，解析为 API 响应数据。
   * @throws {Object} - 如果请求超时，返回一个包含 `code` 和 `message` 的对象，例如 `{ code: "TIMEOUT", message: "Request timed out" }`。
   *
   * @example
   * // 发起一个 API 请求
   * eventFetch.Fetch("EFetch:RTCManager:Auth", { token: "abc123" })
   *   .then((response) => {
   *     console.log("API 响应:", response.data);
   *   })
   *   .catch((error) => {
   *     if (error.code === "TIMEOUT") {
   *       console.error("请求超时:", error.message);
   *     } else {
   *       console.error("请求失败:", error);
   *     }
   *   });
   *
   * @example
   * // 使用 async/await 处理响应
   * (async () => {
   *   try {
   *     const response = await eventFetch.Fetch("EFetch:RTCManager:Auth", { token: "abc123" });
   *     console.log("API 响应:", response.data);
   *   } catch (error) {
   *     if (error.code === "TIMEOUT") {
   *       console.error("请求超时:", error.message);
   *     } else {
   *       console.error("请求失败:", error);
   *     }
   *   }
   * })();
   */
  public Fetch<ApiKey extends keyof EventFetchApi>(
    api: ApiKey,
    params: EventFetchApi[ApiKey][0],
    remoteId: string = this._selfId,
    timeout: number = 5000
  ): Promise<EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>> {
    const requestId = this._createRequestId();

    // 创建超时Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        this._EventToResponseHandler.delete(requestId);
        reject({ code: "TIMEOUT", message: "Request timed out" });
      }, timeout);
    });

    // 创建请求Promise
    const Request = new Promise<
      EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
    >((resolve) => {
      const eventClose = () => this._EventToResponseHandler.delete(requestId);

      this._EventToResponseHandler.set(requestId, (v) => {
        // 判断是否是当前请求
        if (v.header.requestId !== requestId) return;
        // 判断是否来自被请求者
        if (v.userInfo.replayerId !== remoteId) return;
        // 判断是否为自己发送的请求
        if (v.userInfo.requesterId !== this._selfId) return;

        eventClose();

        // @ts-ignore
        resolve(v);
      });

      const EventFetchRequestData: EventFetchRequestDataFormat<
        EventFetchApi[ApiKey][0],
        ApiKey
      > = {
        data: params,
        header: {
          success: true,
          message: "",
          requestId,
          apiKey: api,
        },
        userInfo: {
          requesterId: this._selfId,
          remoteId,
        },
      };

      this.emit("EventFetch:Fetch:Request", EventFetchRequestData);
    });

    // 返回请求结果
    return Promise.race([Request, timeoutPromise]);
  }

  /**
   * 注册一个处理函数，用于处理特定 API 的请求，并返回响应数据。
   *
   * @template ApiKey - API 键的类型，必须是 `EventFetchApi` 的键之一。
   * @param {ApiKey} api - 要处理的 API 键。
   * @param {(val: EventFetchRequestDataFormat<EventFetchApi[ApiKey][0], ApiKey>) => EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>["data"] | Promise<EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>["data"]> | void} handler - 处理函数，用于处理请求并返回响应数据。如果返回 `void`，则不发送响应。
   * @returns {() => void} - 返回一个函数，调用该函数可以取消注册的处理函数。
   *
   * @example
   * // 使用同步处理函数
   * eventFetch.onFetch("EFetch:RTCManager:Auth", (val) => {
   *   console.log("收到请求:", val.data);
   *   return { success: true, message: "授权成功" };
   * });
   *
   * @example
   * // 使用异步处理函数
   * eventFetch.onFetch("EFetch:RTCManager:Auth", async (val) => {
   *   console.log("收到请求:", val.data);
   *   const result = await someAsyncOperation(val.data);
   *   return { success: true, message: "授权成功", data: result };
   * });
   *
   * @example
   * // 取消注册的处理函数
   * const unsubscribe = eventFetch.onFetch("EFetch:RTCManager:Auth", (val) => {
   *   console.log("收到请求:", val.data);
   *   return { success: true, message: "授权成功" };
   * });
   *
   * // 取消注册
   * unsubscribe();
   */
  public onFetch<ApiKey extends keyof EventFetchApi>(
    api: ApiKey,
    handler: (
      val: EventFetchRequestDataFormat<EventFetchApi[ApiKey][0], ApiKey>
    ) =>
      | EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>["data"]
      | Promise<
          EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>["data"]
        >
      | void
      | Promise<void>
      | false,
  ) {
    return this.on(
      "EventFetch:Fetch:Request",
      async (
        val: EventFetchRequestDataFormat<EventFetchApi[ApiKey][0], ApiKey>
      ) => {
        // 判断是否为注册的Api
        if (val.header.apiKey !== api) return;
        // 判断自身是否为被请求者
        if (val.userInfo.remoteId !== this._selfId) return;

        const resultData = await handler(val);

        // 如果返回 false，阻断后续处理
        if (resultData === false) return;

        // 没有结果就不回应
        if (!resultData) return;

        const EventFetchResponseData: EventFetchResponseDataFormat<
          EventFetchApi[ApiKey][1],
          ApiKey
        > = {
          data: resultData,
          header: {
            success: true,
            message: "",
            requestId: val.header.requestId,
            apiKey: api,
          },
          userInfo: {
            requesterId: val.userInfo.requesterId,
            replayerId: this._selfId,
          },
        };

        this.emit("EventFetch:Fetch:Response", EventFetchResponseData);
      }
    );
  }

}
