# 该文档使用AI生成

# EventEmitter 和 EventFetch

这是一个基于 TypeScript 的事件驱动库，提供了 `EventEmitter` 和 `EventFetch` 两个核心类，用于处理事件的订阅、触发以及请求-响应机制。

## 项目简介

- **EventEmitter**：一个通用的事件发射器，支持订阅、取消订阅和触发事件。
- **EventFetch**：基于 `EventEmitter` 的扩展类，专门用于处理 API 请求和响应。


## 使用示例

### EventEmitter 示例

```typescript
import { EventEmitter, type EventKeyValues } from "./src";

// 扩展事件类型
interface E extends EventKeyValues {
  "Click:A": "A";
  "Touch:B": "B";
}

const eventEmitter = new EventEmitter<E>();

// 监听单个事件
const close1 = eventEmitter.on("Click:A", (e) => {
  console.log(e); // { eventTag: "Click:A", data: "A" }
});

// 触发事件
eventEmitter.emit("Click:A", "A");

// 取消监听
close1();

```

### EventFetch 示例

```typescript
import EventFetch, { type EventFetchApis, EventKeyValues } from "./src";

// 扩展 API 类型
interface Apis extends EventFetchApis {
  "Fetch:A": [
    { name: string; age: number }, // 请求参数
    { name: string; age: number }  // 响应类型
  ];
}

const eventFetch = new EventFetch<Apis, EventKeyValues>();

// 监听请求
const close = eventFetch.onFetch("Fetch:A", async (req) => {
  console.log("收到请求:", req.data); // { name: "张三", age: 18 }
  return { name: "张三", age: 18 };
});

// 发起请求
eventFetch.Fetch("Fetch:A", { name: "张三", age: 18 })
  .then((response) => {
    console.log("API 响应:", response.data); // { name: "张三", age: 18 }
  })
  .catch((error) => {
    console.error("请求失败:", error);
  });

// 取消监听
close();
```

## 包的可用性

目前，此包尚未发布到 npm 或其他包注册表。要使用它，您需要直接在项目中包含源代码。
