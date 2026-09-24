import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createInitialV277State,
  restoreV277State,
  taskFromPost,
  updateTaskStatus,
  v277Posts,
  V277_STORAGE_KEY,
} from "../app/v27-7-app";
import {
  buildEveningReflectionModel,
  initialReflectionReview,
  updateReflectionReview,
} from "../app/v28/features/home/evening-reflection-model";

function readV28Source() {
  return [
    "app/v28/core/app-shell.tsx",
    "app/v28/legacy/legacy-ui.tsx",
    "app/v28/features/home/home-page.tsx",
    "app/v28/features/home/evening-reflection-page.tsx",
    "app/v28/features/knowledge/knowledge-page.tsx",
    "app/v28/features/messages/messages-page.tsx",
    "app/v28/features/profile/profile-page.tsx",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

test("V27.8 starts with the restored onboarding route and no fabricated work", () => {
  const state = createInitialV277State();
  assert.equal(state.version, 278);
  assert.equal(state.phase, "auth");
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.memories, []);
  assert.equal(state.account.onboardingComplete, false);
  assert.equal(Object.values(state.agentSetup).every((agent) => agent.enabled), true);
  assert.equal(V277_STORAGE_KEY, "elfred-v278-product");
});

test("V28 evening reflection keeps Person Agent inference behind explicit review", () => {
  const reflection = readFileSync(
    "app/v28/features/home/evening-reflection-page.tsx",
    "utf8",
  );
  const legacy = readFileSync("app/v28/legacy/legacy-ui.tsx", "utf8");

  for (const required of [
    "事实层",
    "解释层",
    "理解层",
    "行动层",
    "待本人核对 · 不推断长期偏好",
    "依据",
    "确认",
    "修正",
    "搁置",
    "否认",
    "不广播给其他 Agent",
    "反思不自动写入长期记忆",
  ]) assert.ok(reflection.includes(required), required);

  for (const forbidden of ["setState", "localStorage", "memory-daily-", "createBriefTask"])
    assert.ok(!reflection.includes(forbidden), forbidden);
  assert.ok(!legacy.includes("settleIncomplete"));
  assert.ok(!legacy.includes("memory-daily-"));
});

test("evening reflection derives facts from current tasks and review decisions stay local", () => {
  const state = createInitialV277State();
  state.tasks = [
    {
      id: "today-done",
      title: "完成首页核对",
      brief: "演示",
      source: "今日安排 · 09:00",
      agent: "advisor",
      status: "已完成",
      nextStep: "无",
      result: [],
      knowledgeIds: [],
      updatedAt: "今天 10:00",
    },
    {
      id: "today-pending",
      title: "确认访谈名单",
      brief: "演示",
      source: "今日安排 · 14:00",
      agent: "execute",
      status: "待确认",
      nextStep: "确认筛选标准",
      result: [],
      knowledgeIds: [],
      updatedAt: "今天 14:00",
    },
  ];
  const snapshot = JSON.parse(JSON.stringify(state));
  const model = buildEveningReflectionModel(state);
  assert.deepEqual(model.facts.completed, ["完成首页核对"]);
  assert.deepEqual(model.facts.unfinished, ["确认访谈名单（待确认）"]);
  assert.match(model.understanding.evidence, /1 项已完成、1 项待确认/);
  assert.match(model.action.routing, /执行 Agent/);

  const confirmed = updateReflectionReview(initialReflectionReview, {
    type: "decide",
    decision: "confirmed",
  });
  const corrected = updateReflectionReview(confirmed, {
    type: "correct",
    correction: "  今天只是缺少筛选标准。  ",
  });
  const deferred = updateReflectionReview(corrected, {
    type: "decide",
    decision: "deferred",
  });
  const denied = updateReflectionReview(deferred, {
    type: "decide",
    decision: "denied",
  });
  assert.equal(confirmed.decision, "confirmed");
  assert.deepEqual(corrected, {
    decision: "corrected",
    correction: "今天只是缺少筛选标准。",
  });
  assert.equal(deferred.decision, "deferred");
  assert.equal(denied.decision, "denied");
  assert.deepEqual(state, snapshot);
});

test("content creates one shared task and opens the existing task on repeat", () => {
  const first = taskFromPost(v277Posts[0], []);
  assert.equal(first.created, true);
  assert.equal(first.tasks.length, 1);
  assert.equal(first.task.sourceId, v277Posts[0].id);
  assert.equal(first.task.status, "待确认");
  assert.ok(first.task.result.length >= 3);
  const repeated = taskFromPost(v277Posts[0], first.tasks);
  assert.equal(repeated.created, false);
  assert.equal(repeated.tasks.length, 1);
  assert.equal(repeated.task.id, first.task.id);
});

test("pausing and resuming never loses or regresses a task result", () => {
  const task = taskFromPost(v277Posts[1], []).task;
  const running = updateTaskStatus(task, "进行中");
  const paused = updateTaskStatus(running, "已暂停");
  const resumed = updateTaskStatus(paused, "进行中");
  assert.deepEqual(paused.result, task.result);
  assert.deepEqual(resumed.result, task.result);
  assert.equal(paused.status, "已暂停");
  assert.match(paused.nextStep, /原草稿|恢复/);
});

test("saved V27.8 state restores profile, tasks, chat, and truth-based settings", () => {
  const state = createInitialV277State();
  state.phase = "ready";
  state.profile = {
    ...state.profile,
    name: "小林",
    role: "产品经理",
    focus: "走通首次使用",
  };
  state.tasks = taskFromPost(v277Posts[2], []).tasks;
  state.messages.elfred.push({ id: "m1", role: "user", text: "继续任务", time: "刚刚" });
  state.notifications = true;
  const restored = restoreV277State(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.profile, state.profile);
  assert.deepEqual(restored.tasks, state.tasks);
  assert.equal(restored.messages.elfred.at(-1)?.text, "继续任务");
  assert.equal(restored.notifications, true);
});

test("V27.8 source contains the full usable path and the five reference-aligned primary screens", () => {
  const source = readV28Source();
  const styles = `${readFileSync("app/v27-7.css", "utf8")}\n${readFileSync("app/v27-8.css", "utf8")}`;
  for (const required of [
    "欢迎使用 Elfred", "输入验证码", "让 Elfred 开始理解你", "个人信息",
    "你的 Agent 团队", "使用默认设置并继续", "Elfred 已准备好",
    "今天", "转为任务", "任务详情", "已暂停", "你的 Agent", "知识库", "记忆库",
    "我的 Elfred", "编辑资料", "退出登录", "当前浏览器", "能力卡组",
    "今天的新进展", "能力雷达", "关键关系", "消息分类", "Skill 与 Mini App",
    "讨论详情", "添加联系人", "Agent 朋友圈", "community-post",
  ]) assert.ok(source.includes(required), required);
  for (const removed of ["对齐率", "真实能力路径", "等级成长", "左右滑动浏览"]) assert.ok(!source.includes(removed), removed);
  for (const contract of ["height:72px", "grid-template-columns:180px minmax(0,1fr) 140px", "font-size:24px", "min-height:48px", "repeat(5,1fr)"]) assert.ok(styles.includes(contract), contract);
});

test("V28 carries the complete settings, profile, capability, friend-chat, and Agent return flows", () => {
  const source = readV28Source();
  const styles = `${readFileSync("app/v27-9.css", "utf8")}\n${readFileSync("app/v28.css", "utf8")}`;
  const route = readFileSync("app/v28/page.tsx", "utf8");
  for (const required of [
    "返回上一页",
    "分享个人主页",
    "主页可见范围",
    "展示等级与能力",
    "可以完成",
    "内部结构",
    "好友信息",
    "和 Ta 的 Personal Agent 沟通",
    "Elfred V28",
    "由林嘉授权",
  ]) assert.ok(source.includes(required), required);
  for (const contract of [
    "--v279-bg",
    "v279-profile-share-sheet",
    "v279-capability-sheet",
    "v279-human-chat-page",
    "v279-agent-head-left",
  ]) assert.ok(styles.includes(contract), contract);
  assert.match(route, /V277App/);
});


// Deferring alignment must allow normal navigation without claiming completion.
import {projectState} from '../app/v28/core/runtime-context';
import type {Snapshot} from '../app/v28/features/live/types';
test('延期初始化可使用首页导航，刷新后保持可用且不冒充完成',()=>{
 const snapshot={user:{id:'u',handle:'qa',name:'qa'},objects:{profile:[{data:{}}],settings:[{data:{}}],onboarding:[{data:{status:'collecting',deferred_at:'2026-09-22T00:00:00Z'}}],task:[],run:[],message:[],memory:[],interaction:[]}} as unknown as Snapshot;
 const first=projectState(snapshot);assert.equal(first.phase,'ready');assert.equal(first.account.onboardingComplete,false);
 assert.equal(projectState(snapshot,first).phase,'ready');
 snapshot.objects.onboarding[0].data.deferred_at=null;assert.equal(projectState(snapshot).phase,'welcome');
});
