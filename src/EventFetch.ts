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

  private _createSelfId = () => "u-" + Math.random().toString(36).substring(2, 15);

  constructor(selfId?: string) {
    super();
    this._selfId = selfId ?? this._createSelfId();

    // 注册事件
    this.on(
      "EventFetch:Fetch:Response",
      <ApiKey extends keyof EventFetchApi>(
        v: EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>
      ) => {
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

  public Fetch<ApiKey extends keyof EventFetchApi>(
    api: ApiKey,
    params: EventFetchApi[ApiKey][0],
    remoteId: string = this._selfId
  ):Promise<EventFetchResponseDataFormat<EventFetchApi[ApiKey][1], ApiKey>> {
    const requestId = this._createRequestId();

    // 创建超时Promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        this._EventToResponseHandler.delete(requestId);
        reject({ code: "TIMEOUT", message: "Request timed out" });
      }, 5000);
    }); 

    // 创建请求Promise
    const Request =  new Promise<
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