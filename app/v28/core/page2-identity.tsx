"use client";

// 接缝件（**整合版专有，不属于同事的代码，也不属于第二/四页的功能**）：
// 把"当前登录的是谁"从同事那套 RuntimeProvider 推给第二/四页的接口层
// （`features/knowledge/page2-api.ts`）。
//
// 为什么需要它：第二/四页的后端是独立进程（elfred-page2-api），数据按用户分开存，
// 但它不认识同事那套 session，所以每次请求得把 handle 带上（头 `X-Elfred-User`）。
// page2-api 是普通模块，拿不到 React context，所以用这个挂件在 Provider 里盯着。

import { useEffect } from "react";
import { useRuntime } from "./runtime-context";
import { loadPage2, setPage2User } from "../features/pages24";

export function Page2Identity() {
  const runtime = useRuntime();
  const handle = runtime?.snapshot?.user?.handle ?? null;
  // 他那边每次刷新都会带一个新的 server_time。用它当"外面有动静了"的信号：
  // 用户在首页验收完一条成果，第二页会在下一次刷新时自己重拉，不需要手动刷页面。
  // 不加这个的话，「刚验收完切过来第二页还是空的」，看起来就像后端根本没通。
  const stamp = runtime?.snapshot?.server_time ?? null;
  useEffect(() => {
    setPage2User(handle);
  }, [handle]);
  useEffect(() => {
    if (handle && stamp) void loadPage2(true);
  }, [handle, stamp]);
  return null;
}
