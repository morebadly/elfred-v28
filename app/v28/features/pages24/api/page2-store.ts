"use client";

// 第二页自己的本地状态（浏览器 localStorage）。它管三件事：
//   ① 成果的裁定：确认 / 这条不对 / 忘掉 —— 会真的改变卡片上的分数与成果数
//   ② 知识 → 能力：知识卡固化出来的能力卡，以及"从哪张知识来的"
//   ③ 手动升级：等级够了之后用户点的那一下
//
// 接后端时把下面这些读函数换成接口即可，界面不用动。

import type { AbilityType } from "../data/knowledge-data";
import { getPage2User } from "./page2-api";

export type EvidenceVerdict = "confirmed" | "disputed" | "forgotten";

export type FixedCard = {
  title: string;
  type: AbilityType;
  dimension: string;
  copy: string;
  score: number;
  evidence: number;
  level: number;
  fromKnowledge: string;
};

/** 导进来的原始素材：先进"待确认"，用户点头才变成知识卡 */
export type PendingMaterial = {
  id: string;
  title: string;
  from: string;
  kind: "file" | "link" | "resume";
};

/** 待确认的素材被确认后，落到知识货架上的那张知识卡 */
export type KnowledgeDraft = {
  id: string;
  title: string;
  source: string;
  purpose: string;
  status: string;
};

type Page2Store = {
  verdicts: Record<string, EvidenceVerdict>;
  fixedCards: FixedCard[];
  fixedFrom: Record<string, string>;
  levelOverride: Record<string, number>;
  /** 从成果页点卡名过来时，要自动打开哪张卡（打开一次就清掉） */
  pendingCard: string | null;
  /** 点了「用它做一件事」之后，要把哪张 skill 带进 Agent 对话（读一次就清掉） */
  pendingSkill: string | null;
  pendingMaterials: PendingMaterial[];
  knowledgeDrafts: KnowledgeDraft[];
};

// v1 → v2：旧版留下的本地状态（固化出来的卡、成果裁定、导入的简历…）在改版后已经和
// 新结构对不上（比如卡面小字里还带着"（来自知识：…）"的尾巴），所以直接升版本号让旧数据作废。
const KEY = "elfred.page2.v2";
const storageKey = () => getPage2User() ? `${KEY}.${getPage2User()}` : null;
const EMPTY: Page2Store = {
  verdicts: {},
  fixedCards: [],
  fixedFrom: {},
  levelOverride: {},
  pendingCard: null,
  pendingSkill: null,
  pendingMaterials: [],
  knowledgeDrafts: [],
};

export function readPage2(): Page2Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const key = storageKey();
    if (!key) return EMPTY;
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Page2Store>) };
  } catch {
    return EMPTY;
  }
}

function writePage2(next: Page2Store) {
  if (typeof window === "undefined") return;
  const key = storageKey();
  if (key) window.localStorage.setItem(key, JSON.stringify(next));
}

export function setEvidenceVerdict(id: string, verdict: EvidenceVerdict) {
  const store = readPage2();
  writePage2({ ...store, verdicts: { ...store.verdicts, [id]: verdict } });
}

export function clearEvidenceVerdict(id: string) {
  const store = readPage2();
  const verdicts = { ...store.verdicts };
  delete verdicts[id];
  writePage2({ ...store, verdicts });
}

export function setCardLevel(title: string, level: number) {
  const store = readPage2();
  writePage2({ ...store, levelOverride: { ...store.levelOverride, [title]: level } });
}

export function addFixedCard(card: FixedCard) {
  const store = readPage2();
  if (store.fixedCards.some((existing) => existing.title === card.title)) return;
  writePage2({
    ...store,
    fixedCards: [card, ...store.fixedCards],
    fixedFrom: { ...store.fixedFrom, [card.fromKnowledge]: card.title },
  });
}

export function setPendingCard(title: string) {
  writePage2({ ...readPage2(), pendingCard: title });
}

export function setPendingSkill(title: string) {
  writePage2({ ...readPage2(), pendingSkill: title });
}

/** 读一次就清掉：对话页接上 prefill 之后，用它把 skill 带过去 */
export function takePendingSkill() {
  const store = readPage2();
  if (!store.pendingSkill) return null;
  writePage2({ ...store, pendingSkill: null });
  return store.pendingSkill;
}

export function addPendingMaterial(material: PendingMaterial) {
  const store = readPage2();
  writePage2({ ...store, pendingMaterials: [material, ...store.pendingMaterials] });
}

/** keep=true：确认上架 → 变成知识卡；keep=false：丢弃 */
export function resolvePendingMaterial(id: string, keep: boolean) {
  const store = readPage2();
  const material = store.pendingMaterials.find((item) => item.id === id);
  if (!material) return;
  writePage2({
    ...store,
    pendingMaterials: store.pendingMaterials.filter((item) => item.id !== id),
    knowledgeDrafts: keep
      ? [
          {
            id: material.id,
            title: material.title,
            source: material.kind === "resume" ? "简历导入" : material.from,
            purpose: "刚导入，还没用过",
            status: "待用",
          },
          ...store.knowledgeDrafts,
        ]
      : store.knowledgeDrafts,
  });
}

/** 读一次就清掉：避免下次回到知识库又自动弹出来 */
export function takePendingCard() {
  const store = readPage2();
  if (!store.pendingCard) return null;
  writePage2({ ...store, pendingCard: null });
  return store.pendingCard;
}
