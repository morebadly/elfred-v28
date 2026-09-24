"use client";

// Static V27.7 data used by both the state layer and the view, split out of
// v27-7-app.tsx so neither has to import the other (a cycle).

import { CheckCircle2, Compass, Lightbulb, PenLine, Users } from "lucide-react";
import type { V277AgentId, V277Message } from "./v27-7-state";

export const agentList: {
  id: V277AgentId;
  name: string;
  role: string;
  icon: typeof Compass;
  prompt: string;
}[] = [
  {
    id: "explore",
    name: "探索",
    role: "找到值得关注的信息",
    icon: Compass,
    prompt: "我会先帮你找到与当前目标有关的新信息。",
  },
  {
    id: "advisor",
    name: "参谋",
    role: "比较方案并给出判断",
    icon: Lightbulb,
    prompt: "我会把选择、依据和风险讲清楚。",
  },
  {
    id: "create",
    name: "创作",
    role: "把想法变成可用草稿",
    icon: PenLine,
    prompt: "告诉我用途，我先给你一版可以修改的草稿。",
  },
  {
    id: "connect",
    name: "连接",
    role: "整理人和协作机会",
    icon: Users,
    prompt: "我只会先整理候选条件，不会自动联系任何人。",
  },
  {
    id: "execute",
    name: "执行",
    role: "把目标推进成下一步",
    icon: CheckCircle2,
    prompt: "我会把目标拆成明确动作，需要对外操作时再请你确认。",
  },
];

export const initialMessages = (name = "你"): Record<string, V277Message[]> => ({
  elfred: [
    {
      id: "welcome",
      role: "assistant",
      text: `${name}好，我能帮你整理目标、生成任务草稿，或继续推进已有任务。`,
      time: "刚刚",
    },
  ],
  explore: [
    {
      id: "explore-welcome",
      role: "assistant",
      text: agentList[0].prompt,
      time: "刚刚",
    },
  ],
  advisor: [
    {
      id: "advisor-welcome",
      role: "assistant",
      text: agentList[1].prompt,
      time: "刚刚",
    },
  ],
  create: [
    {
      id: "create-welcome",
      role: "assistant",
      text: agentList[2].prompt,
      time: "刚刚",
    },
  ],
  connect: [
    {
      id: "connect-welcome",
      role: "assistant",
      text: agentList[3].prompt,
      time: "刚刚",
    },
  ],
  execute: [
    {
      id: "execute-welcome",
      role: "assistant",
      text: agentList[4].prompt,
      time: "刚刚",
    },
  ],
});
