"use client";
import { agentList, initialMessages } from "./v27-7-data";

export function createDefaultAgentSetup(): V277State["agentSetup"] {
  return {
    explore: {
      name: "探索 Agent",
      focus: "发现与你相关的信息、案例和机会",
      enabled: true,
    },
    advisor: {
      name: "参谋 Agent",
      focus: "分析问题、比较选择并给出建议",
      enabled: true,
    },
    create: {
      name: "创作 Agent",
      focus: "生成文案、方案和可交付内容",
      enabled: true,
    },
    connect: {
      name: "连接 Agent",
      focus: "寻找合适的人并判断合作匹配",
      enabled: true,
    },
    execute: {
      name: "执行 Agent",
      focus: "拆解任务、调用工具并汇报结果",
      enabled: true,
    },
  };
}

// V27.7/V27.8 state layer, extracted from v27-7-app.tsx (refactor step 3).
// This is the single place that will move from localStorage to the real API,
// so it holds types, the storage key and the pure task transitions only -
// no view code, no icon imports, no data literals.

export type V277AgentId =
  "explore" | "advisor" | "create" | "connect" | "execute";
export type V277TaskStatus = "待确认" | "进行中" | "已暂停" | "已完成";
export type V277Phase =
  | "auth"
  | "verify"
  | "welcome"
  | "profile-init"
  | "agents-init"
  | "complete"
  | "ready";

export type V277Task = {
  id: string;
  title: string;
  brief: string;
  source: string;
  sourceId?: string;
  agent: V277AgentId;
  status: V277TaskStatus;
  nextStep: string;
  result: string[];
  knowledgeIds: string[];
  updatedAt: string;
};

export type V277Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};
export type V277Memory = {
  id: string;
  group: "基础" | "社交" | "习惯" | "偏好";
  label: string;
  value: string;
  source: string;
  status: "已确认" | "待确认";
};

export type V277State = {
  version: 278;
  phase: V277Phase;
  account: {
    identifier: string;
    provider: "contact" | "wechat" | "apple";
    verified: boolean;
    onboardingComplete: boolean;
  };
  agentSetup: Record<
    V277AgentId,
    {
      name: string;
      focus: string;
      enabled: boolean;
    }
  >;
  profile: {
    name: string;
    username: string;
    role: string;
    bio: string;
    focus: string;
    tags: string[];
    showLevel: boolean;
  };
  profileVisibility: "public" | "contacts" | "private";
  tasks: V277Task[];
  messages: Record<string, V277Message[]>;
  memories: V277Memory[];
  savedPostIds: string[];
  hiddenPostIds: string[];
  notifications: boolean;
  quiet: boolean;
};

export type Post = {
  id: string;
  agent: V277AgentId;
  label: string;
  title: string;
  summary: string;
  detail: string[];
  taskTitle: string;
  taskBrief: string;
  result: string[];
  category: "推荐" | "方法" | "协作";
};

export type KnowledgeItem = {
  id: string;
  title: string;
  purpose: string;
  source: string;
  status: string;
  example: string;
};

export const V277_STORAGE_KEY = "elfred-v278-product";

export function taskFromPost(post: Post, existing: V277Task[], now = "刚刚") {
  const duplicate = existing.find((task) => task.sourceId === post.id);
  if (duplicate) return { task: duplicate, tasks: existing, created: false };
  const task: V277Task = {
    id: `post-${post.id}`,
    title: post.taskTitle,
    brief: post.taskBrief,
    source: `首页内容 · ${post.title}`,
    sourceId: post.id,
    agent: post.agent,
    status: "待确认",
    nextStep: "确认目标与交付范围",
    result: post.result,
    knowledgeIds: [],
    updatedAt: now,
  };
  return { task, tasks: [task, ...existing], created: true };
}

export function updateTaskStatus(
  task: V277Task,
  status: V277TaskStatus,
): V277Task {
  const nextStep =
    status === "待确认"
      ? "确认目标与交付范围"
      : status === "进行中"
        ? "检查草稿并决定是否完成"
        : status === "已暂停"
          ? "继续时从当前草稿恢复"
          : "结果已保存，可随时回来查看";
  return { ...task, status, nextStep, updatedAt: "刚刚" };
}

export function createInitialV277State(): V277State {
  return {
    version: 278,
    phase: "auth",
    account: {
      identifier: "",
      provider: "contact",
      verified: false,
      onboardingComplete: false,
    },
    agentSetup: createDefaultAgentSetup(),
    profile: {
      name: "",
      username: "harisen",
      role: "",
      bio: "正在把 Personal Agent 做成真正懂你、能行动的数字伙伴。",
      focus: "",
      tags: ["产品", "创业"],
      showLevel: true,
    },
    profileVisibility: "public",
    tasks: [],
    messages: initialMessages(),
    memories: [],
    savedPostIds: [],
    hiddenPostIds: [],
    notifications: false,
    quiet: true,
  };
}

export function restoreV277State(value: unknown): V277State {
  const base = createInitialV277State();
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<V277State>;
  if (candidate.version !== 278) return base;
  const storedPhase = String(candidate.phase || "auth");
  const currentPhases: V277Phase[] = [
    "auth",
    "verify",
    "welcome",
    "profile-init",
    "agents-init",
    "complete",
    "ready",
  ];
  const legacyComplete =
    storedPhase === "ready" ||
    Boolean(candidate.profile?.name) ||
    Boolean(candidate.tasks?.length) ||
    Boolean(candidate.memories?.length);
  const restoredSetup = createDefaultAgentSetup();
  for (const agent of agentList) {
    restoredSetup[agent.id] = {
      ...restoredSetup[agent.id],
      ...(candidate.agentSetup?.[agent.id] || {}),
    };
  }
  return {
    ...base,
    ...candidate,
    phase: currentPhases.includes(storedPhase as V277Phase)
      ? (storedPhase as V277Phase)
      : "auth",
    account: {
      ...base.account,
      ...(candidate.account || {}),
      onboardingComplete:
        candidate.account?.onboardingComplete ?? legacyComplete,
    },
    agentSetup: restoredSetup,
    profile: { ...base.profile, ...candidate.profile },
    profileVisibility:
      candidate.profileVisibility === "contacts" ||
      candidate.profileVisibility === "private"
        ? candidate.profileVisibility
        : "public",
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    memories: Array.isArray(candidate.memories) ? candidate.memories : [],
    messages: { ...base.messages, ...(candidate.messages || {}) },
    savedPostIds: Array.isArray(candidate.savedPostIds)
      ? candidate.savedPostIds
      : [],
    hiddenPostIds: Array.isArray(candidate.hiddenPostIds)
      ? candidate.hiddenPostIds
      : [],
  };
}
