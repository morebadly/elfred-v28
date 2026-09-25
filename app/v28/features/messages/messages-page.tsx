"use client";

import { useState } from "react";
import { Plus, Search, UserPlus } from "lucide-react";
import type { V277State } from "../../../v27-7-state";
import type { Screen } from "../../core/screen";
import {useRuntime} from "../../core/runtime-context";
import { MessageSearchSheet } from "../../legacy/legacy-ui";

export function MessagesPage({
  go,
}: {
  state: V277State;
  go: (screen: Screen) => void;
}) {
  const runtime=useRuntime();
  const [filter, setFilter] = useState("全部");
  const [searching, setSearching] = useState(false);
  const contacts = runtime?(runtime.snapshot?.objects.conversation||[]).filter(item=>item.data.kind!=='agent').slice().sort((a,b)=>b.updated.localeCompare(a.updated)).map(item=>({id:item.id,name:String(item.data.title),text:String(runtime.snapshot?.objects.message.filter(message=>message.space===item.id).sort((a,b)=>Number(b.data.seq)-Number(a.data.seq))[0]?.data.text||"暂无消息"),time:new Date(item.updated).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}),badge:item.unread||0,kind:item.data.kind==="group"?"群聊":"私聊",avatar:item.data.kind==="group"?"avatar-group":"avatar-lin"})):[
    {
      id: "group-danbasa",
      name: "丹巴萨餐厅",
      text: "他们周日营业吗？",
      time: "24分钟前",
      badge: 4,
      kind: "群聊",
      avatar: "avatar-group",
    },
    {
      id: "person-linjia",
      name: "林嘉",
      text: "好的，谢谢！",
      time: "2分钟前",
      kind: "私聊",
      avatar: "avatar-lin",
    },
    {
      id: "person-chenkai",
      name: "陈凯",
      text: "回头见。",
      time: "3分钟前",
      kind: "私聊",
      avatar: "avatar-kevin",
    },
    {
      id: "person-aya",
      name: "阿雅",
      text: "哈哈，确实。",
      time: "5分钟前",
      kind: "私聊",
      avatar: "avatar-aya",
    },
    {
      id: "person-duming",
      name: "杜明",
      text: "那就晚上8点开始，可以吗？",
      time: "5分钟前",
      badge: 4,
      kind: "私聊",
      avatar: "avatar-du",
    },
    {
      id: "person-zhaoya",
      name: "赵雅",
      text: "好的，晚点联系。",
      time: "12分钟前",
      kind: "私聊",
      avatar: "avatar-zhao",
    },
  ];
  const visible = contacts.filter(
    (item) => filter === "全部" || item.kind === filter,
  );
  const stories = [
    ["我", "story-me", "profile"],
    ["林野", "story-lin", "person-linye"],
    ["陈默", "story-chen", "person-chenmo"],
    ["苏宁", "story-su", "person-suning"],
    ["一鸣", "story-yi", "person-yiming"],
    ["小夏", "story-xia", "person-xiaxia"],
  ];
  return (
    <main className="v277-page v277-messages-page">
      <div className="v282-messages-fixed-head">
        <header className="v277-messages-head">
          <h1>消息</h1>
          <span>
            <button
              type="button"
              aria-label="搜索消息"
              onClick={() => setSearching(true)}
            >
              <Search size={27} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              aria-label="添加好友"
              onClick={() => go({ name: "utility", kind: "add-friend" })}
            >
              <UserPlus size={27} strokeWidth={1.8} />
            </button>
          </span>
        </header>
        {!runtime&&<section className="v277-story-row">
          {stories.map(([name, photo, target], index) => (
            <button
              type="button"
              key={name}
              onClick={() =>
                target === "profile"
                  ? go({ name: "profile" })
                  : go({ name: "chat", id: target })
              }
            >
              <i className={`${photo} v277-sprite-community`}>
                {index === 0 && (
                  <em>
                    <Plus size={15} />
                  </em>
                )}
                {index > 0 && <b />}
              </i>
              {index === 1 && <small>在线</small>}
              <span>{name}</span>
            </button>
          ))}
        </section>}
        <nav className="v277-message-filters" aria-label="消息分类">
          {["全部", "私聊", "群聊"].map((name) => (
            <button
              type="button"
              key={name}
              className={filter === name ? "active" : ""}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </div>
      <section className="v277-conversations v277-reference-conversations">{runtime&&visible.length===0&&<div className="v277-empty"><p>尚无真人会话。添加好友后由对方确认。</p></div>}
        {visible.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => go({ name: "chat", id: item.id })}
          >
            <i className={`${item.avatar} v277-sprite-community`} />
            <div>
              <b>{item.name}</b>
              <p>{item.text}</p>
            </div>
            <small>{item.time}</small>
            {Boolean(item.badge) && <em>{item.badge}</em>}
          </button>
        ))}
      </section>
      {searching && (
        <MessageSearchSheet
          contacts={contacts}
          go={go}
          onClose={() => setSearching(false)}
        />
      )}
    </main>
  );
}
