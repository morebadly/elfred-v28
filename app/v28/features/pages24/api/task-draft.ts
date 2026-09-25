"use client";

// 第二页要"真的算数"的那条动作：从一张能力卡或一张知识卡生成一张任务草稿。
// 生成后它真的会出现在任务页里（写进应用状态 state.tasks），不是只弹一句提示。

import type { Dispatch, SetStateAction } from "react";
import type { V277AgentId, V277State } from "../../../../v27-7-state";

export function draftTask(
  setState: Dispatch<SetStateAction<V277State>>,
  draft: {
    title: string;
    brief: string;
    source: string;
    agent: V277AgentId;
    knowledgeIds?: string[];
  },
) {
  const id = `draft-${Date.now().toString(36)}`;
  setState((state) => ({
    ...state,
    tasks: [
      {
        id,
        title: draft.title,
        brief: draft.brief,
        source: draft.source,
        agent: draft.agent,
        status: "待确认",
        nextStep: "确认要做什么、交付什么",
        result: [],
        knowledgeIds: draft.knowledgeIds ?? [],
        updatedAt: "刚刚",
      },
      ...state.tasks,
    ],
  }));
  return id;
}
