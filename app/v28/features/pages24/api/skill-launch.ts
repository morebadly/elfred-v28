"use client";

// 「用它做一件事」的接口层：**让这条能力进场**，而不是只跳过去聊天。
//
// 现状（2026-09-25）：**接口已经写好，但缺一个上游命令，所以暂时走不通**。
//   · 第 ① 步「要一个能发消息的会话」需要同事那边加 `conversation.ensure_personal`；
//     服务端现在**没有任何命令**能建出"我的 Elfred"那个会话（查证过：全库 0 个会话对象，
//     能建会话的代码只有"好友通过→私聊"和"建群聊"两处），而 message.send / draft.save
//     都要求先有会话成员。所以这一步现在必然拿不到 id。
//   · 他加上那条命令之后，**这里一行都不用改**就会自动走通：拿到会话 → 把任务契约
//     写进输入框 → 跳到那个会话。
//
// 「暂时搁置」的是**那条上游命令**，不是这段接口：接口留着，拿不到会话就如实退回
// （调用方走原来的行为），绝不假装已经带进场。
//
// 这个模块故意不 import 任何 runtime 类型：第二页在我自己那份单独跑的版本里没有 runtime，
// 用结构化类型就能同时满足两边。
import { fetchContract } from "./page2-api";

type Entity = { id: string; version?: number; data?: Record<string, unknown> };

type LaunchRuntime = {
  snapshot: { objects: Record<string, Entity[]> } | null;
  command: (action: string, input: Record<string, unknown>) => Promise<unknown>;
};

export type LaunchOutcome = {
  ok: boolean;
  reason?: string;
  conversationId?: string;
  note?: string;
};

/** 个人 agent 会话在前端一直用的是这个固定 id（5 处入口都跳它）。 */
const PERSONAL_CHAT_ID = "elfred";

/**
 * 要一个"能发消息的会话"。
 *
 * 优先用已经存在的；没有再请他那边建（`conversation.ensure_personal`，幂等）。
 * **命令不存在时返回 null** —— 这是现在必然会走到的分支，调用方据此如实退回。
 */
async function ensurePersonalConversation(service: LaunchRuntime): Promise<string | null> {
  const conversations = service.snapshot?.objects?.conversation ?? [];
  if (conversations.some((item) => item.id === PERSONAL_CHAT_ID)) {
    return PERSONAL_CHAT_ID;      // 会话已经在了（他那边建过），直接用
  }
  try {
    const result = (await service.command("conversation.ensure_personal",
                                           { id: PERSONAL_CHAT_ID })) as { id?: string } | undefined;
    return result?.id ?? null;
  } catch {
    return null;                  // 命令还没有 → 如实退回，不假装
  }
}

/** 契约 → 用户看得懂、也改得动的一段话（不是给机器看的 JSON）。 */
export function contractPrompt(
  title: string,
  goal: string,
  contract: { criteria: string; constraints: string; memories: string[] } | null,
): string {
  const lines = [goal.trim() || "（把你要做的事写在这里，越具体越好）", ""];
  if (contract) {
    lines.push(`—— 这条能力《${title}》的做法 ——`);
    if (contract.constraints) lines.push(contract.constraints);
    if (contract.criteria) lines.push(`算做完的标准：${contract.criteria}`);
    if (contract.memories.length) lines.push("你之前交代过的：" + contract.memories.join("；"));
  } else {
    lines.push(`（这次没取到《${title}》的做法，先按你说的做）`);
  }
  return lines.join("\n");
}

/**
 * 带能力进场。返回 `ok` 才算真的把契约写进了对话输入框。
 * 现在会返回 `need_conversation`（上游命令还没有），调用方走原来的行为。
 */
export async function launchWithSkill(
  runtime: unknown,
  title: string,
  goal = "",
): Promise<LaunchOutcome> {
  const service = runtime as LaunchRuntime | undefined;
  if (!service?.snapshot || typeof service.command !== "function") {
    return { ok: false, reason: "no_runtime" };
  }

  // ⚠️ 顺序很重要：**先要会话，再取契约**。
  // 反过来（先取契约）会有个坑：卡片还不是一条真 skill 时 `fetchContract` 会 404，
  // 于是整件事直接返回、连会话都不去要 —— 用户点了按钮什么都没发生。
  // 现在取不到契约只是退化成"没有做法可带"，人照样进对话（实测就是这么暴露的）。
  const conversationId = await ensurePersonalConversation(service);
  if (!conversationId) {
    return {
      ok: false,
      reason: "need_conversation",
      note: "还差一个能发消息的会话（等上游补 conversation.ensure_personal）",
    };
  }

  let contractMissing = false;
  const contract = await fetchContract(title, goal);
  if (contract && contract.ok === false) {
    // 这次带不上做法，但还是把话送到输入框里 —— 不因为"查不到 skill"就把用户挡在门外
    contractMissing = true;
  }
  const existing = service.snapshot.objects.draft?.find(
    (item) => item.data?.conversation_id === conversationId);
  const text = contractPrompt(title, goal, contractMissing ? null : (contract ?? null));
  try {
    await service.command("draft.save", {
      conversation_id: conversationId,
      // 已经有草稿就不覆盖：你原本写的放在前面，能力条件接在后面
      text: existing?.data?.text ? `${String(existing.data.text).trim()}\n\n${text}` : text,
      version: existing?.version ?? 0,
    });
    return { ok: true, conversationId };
  } catch {
    return { ok: false, reason: "draft_failed", note: "会话草稿没能写入，稍后再试" };
  }
}
