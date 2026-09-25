// 第二页 / 第四页：**这个模块的唯一入口**。
//
// 为什么要有它：这两页原来散在四个目录里（knowledge / memory / profile / library），
// 和别人对接口时得记住"哪个文件在哪儿"。现在只要 3 个接缝文件从这里 import 就够了，
// 内部怎么分层（api / data / parts / screens / styles）是我们自己的事。
//
// 目录约定：
//   api/     跟后端的接口与本地状态（page2-api / page2-store / skill-launch / task-draft）
//   data/    前端的数据层（真数据到了就地替换演示数据）
//   parts/   可复用组件（弹层、雷达图、勋章、页头）
//   screens/ 页面级（第二页、第四页、以及它们的二级屏）
//   styles/  CSS Modules
//
// ⚠️ 这一层只做"导出口"，不写逻辑。

// ── 页面级 ───────────────────────────────────────────────────────────
export { KnowledgePage } from "./screens/knowledge-page";
export { KnowledgeDetailPage } from "./screens/knowledge-detail-page";
export { MemoryPage } from "./screens/memory-page";
export { ProfilePage } from "./screens/profile-page";
export { AbilityProfilePage } from "./screens/ability-profile-page";
export { DimensionDetailPage } from "./screens/dimension-detail-page";
export { EvidenceDetailPage } from "./screens/evidence-detail-page";
export { EvidenceListPage } from "./screens/evidence-list-page";

// ── 组件 ─────────────────────────────────────────────────────────────
export { CapabilitySheet } from "./parts/capability-sheet";
export { UnderstandingSheet } from "./parts/understanding-sheet";
export { HonorGallery } from "./parts/honor-gallery";
export { LibraryHeader } from "./parts/library-header";

// ── 接缝要用到的接口 / 数据层 ────────────────────────────────────────
export { loadPage2, setPage2User, setPage2Runtime, fetchRelationships, usePage2Live } from "./api/page2-api";
export type { LiveRelationship } from "./api/page2-api";
export { setCardLevel } from "./api/page2-store";
export { draftTask } from "./api/task-draft";
export { launchWithSkill } from "./api/skill-launch";
export { hasLiveAlignment, libraryHeader } from "./data/knowledge-data";
