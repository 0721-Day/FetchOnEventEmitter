interface EventKeyValues {
  "EventBus:Created": void;
}

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

interface EventFetchApi {
  "EFetch:RTCManager:Auth": [
    { token: string },
    { success: boolean; message: string }
  ];
}

interface EventFetchExtendEventBus {
  "EventFetch:Created": void;
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

export class EventFetch<
  EventFetchApi extends {
    [K in keyof EventFetchApi]: [EventFetchApi[K][0], EventFetchApi[K][1]];
  },
  EventKeyValues
> extends EventEmitter<EventKeyValues & EventFetchExtendEventBus> {
  private _selfId: string;

  constructor(selfId: string) {
    super();
    this._selfId = selfId;
  }

  private _EventToResponseHandler = new Map<
    string,
    <ApiKey extends keyof EventFetchApi>(
      data: EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
    ) => void
  >();

  private _createRequestId = () =>
    "o-" + Math.random().toString(36).substring(2, 15);

  public Fetch<ApiKey extends keyof EventFetchApi>(
    api: ApiKey,
    params: EventFetchApi[ApiKey][0],
    remoteId: string = this._selfId
  ) {
    const requestId = this._createRequestId();

    return new Promise<
      EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
    >((resolve, reject) => {
      // 请求相应回调
      const eventClose = this.on(
        "EventFetch:Fetch:Response",
        (v: EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>) => {
          // 判断是否是当前请求
          if (v.header.requestId !== requestId) return;
          // 判断是否来自被请求者
          if (v.userInfo.replayerId !== remoteId) return;
          // 判断是否为自己发送的请求
          if (v.userInfo.requesterId !== this._selfId) return;

          eventClose();
          clearTimeout(timer);
          resolve(v);
        }
      );

      // 超时处理
      const timer = setTimeout(() => {
        eventClose();
        reject({ code: "TIMEOUT", message: "Request timed out" });
      }, 5000);

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
  }

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

const test = new EventFetch<EventFetchApi, EventKeyValues>("test");

const cl = test.onFetch("EFetch:RTCManager:Auth", (v) => {
  return { success: true, message: "test" };
});

test.Fetch("EFetch:RTCManager:Auth", { token: "test" }).then((v) => {});

test.Fetch("EFetch:RTCManager:Auth", { token: "test1" }).then((v) => {});

cl();
test.Fetch("EFetch:RTCManager:Auth", { token: "test2" }).then((v) => {});
