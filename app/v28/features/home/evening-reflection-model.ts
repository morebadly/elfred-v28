import type { V277AgentId, V277State } from "../../../v27-7-state";

export type ReflectionDecision =
  | "pending"
  | "confirmed"
  | "corrected"
  | "deferred"
  | "denied";

export type ReflectionReviewState = {
  decision: ReflectionDecision;
  correction: string;
};

export type ReflectionReviewAction =
  | { type: "decide"; decision: Exclude<ReflectionDecision, "pending" | "corrected"> }
  | { type: "correct"; correction: string }
  | { type: "reset" };

const agentNames: Record<V277AgentId, string> = {
  explore: "探索 Agent",
  advisor: "参谋 Agent",
  create: "创作 Agent",
  connect: "连接 Agent",
  execute: "执行 Agent",
};

export const initialReflectionReview: ReflectionReviewState = {
  decision: "pending",
  correction: "",
};

export function updateReflectionReview(
  current: ReflectionReviewState,
  action: ReflectionReviewAction,
): ReflectionReviewState {
  if (action.type === "reset") return initialReflectionReview;
  if (action.type === "correct")
    return { decision: "corrected", correction: action.correction.trim() };
  return { ...current, decision: action.decision };
}

export function buildEveningReflectionModel(state: V277State) {
  const todayTasks = state.tasks.filter(
    (task) =>
      task.source.includes("今日") ||
      task.updatedAt.includes("今天") ||
      task.updatedAt.includes("刚刚"),
  );
  const completed = todayTasks.filter((task) => task.status === "已完成");
  const unfinished = todayTasks.filter((task) => task.status !== "已完成");
  const pending = unfinished.filter((task) => task.status === "待确认");
  const running = unfinished.filter((task) => task.status === "进行中");
  const paused = unfinished.filter((task) => task.status === "已暂停");
  const nextTask = unfinished[0];

  const changesAndBlocks = [
    pending.length > 0
      ? `${pending.length} 项仍待用户确认，尚未进入正式执行或验收。`
      : "没有待确认的今日事项。",
    running.length > 0
      ? `${running.length} 项仍在进行中，晚间尚未被验收为完成。`
      : "没有仍在进行中的今日事项。",
    paused.length > 0
      ? `${paused.length} 项已暂停，需要先核对阻塞原因。`
      : "当前没有记录为暂停的今日事项。",
  ];

  return {
    facts: {
      completed:
        completed.length > 0
          ? completed.map((task) => task.title)
          : ["当前任务状态中还没有被验收为“已完成”的今日事项。"],
      unfinished:
        unfinished.length > 0
          ? unfinished.map((task) => `${task.title}（${task.status}）`)
          : ["当前没有未完成的今日事项。"],
      changesAndBlocks,
    },
    explanation: {
      primary:
        pending.length > 0
          ? "今日偏差可能来自关键事项仍在等待你的确认，任务状态还没有进入可验收阶段。"
          : running.length > 0
            ? "今日偏差可能来自进行中的事项尚未完成收口与验收。"
            : "当前状态没有显示明显偏差，仍需要你核对是否遗漏了线下结果。",
      alternative:
        "也可能是演示任务状态没有及时更新，实际进展与页面记录并不一致。",
    },
    understanding: {
      text: "你可能更需要 Person Agent 在晚间先帮你核对任务状态与完成标准，再讨论长期偏好或能力变化。",
      confidence: todayTasks.length > 0 ? 62 : 38,
      evidence: `当前记录包含 ${todayTasks.length} 项今日相关任务：${completed.length} 项已完成、${pending.length} 项待确认、${running.length} 项进行中、${paused.length} 项暂停。`,
    },
    action: {
      continuation: nextTask
        ? `先核对“${nextTask.title}”的当前结果与完成标准，再决定是否延续到明日。`
        : "当前没有建议自动延续到明日的事项。",
      routing: nextTask
        ? `如你另行授权，仅向${agentNames[nextTask.agent]}提供“任务名称 + 当前状态 + 下一步”，不共享完整今日记录。`
        : "当前不建议向任何子 Agent 分配新上下文。",
      target: nextTask ? agentNames[nextTask.agent] : "无",
    },
  };
}
