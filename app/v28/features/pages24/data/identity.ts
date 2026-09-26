// 主页上"这个人叫什么、账号怎么显示"的唯一规则（第四页、编辑资料、设置三处共用一份）。
//
// 为什么要有这个文件：注册时后端会把账号自动填进 `profile.name`（手机号 = `15889718183`，
// 邮箱 = `qa12345`），于是"还没起名字"的人主页上就顶着手机号或一串字母数字 —— 既难看，
// 手机号还等于直接公开。规则：
//   · 名字为空 / 等于账号 / 等于邮箱 @ 前面那段 / 是 11 位手机号 → 认为"还没起名字"，
//     统一显示默认名 **路人**（用户定的）；
//   · 账号一律**遮蔽**再显示（小红书也只露"小红书号"，不露手机号）。

export const DEFAULT_NAME = "路人";

/** 这个名字是不是"系统自动填的"（不是本人起的） */
export function isAutoName(name: string, handle: string) {
  const value = (name || "").trim();
  if (!value) return true;
  const account = (handle || "").replace(/^@/, "").trim();
  if (!account) return false;
  if (value === account) return true;
  const local = account.includes("@") ? account.split("@")[0] : "";
  if (local && value === local) return true;
  return /^1\d{10}$/.test(value);
}

/** 主页上该显示的名字 */
export function shownNameOf(name: string, handle: string) {
  return isAutoName(name, handle) ? DEFAULT_NAME : (name || "").trim();
}

/** 账号遮蔽：手机号 `158****8183`、邮箱 `qa***@example.com`、其他长串取头尾 */
export function maskHandle(raw: string) {
  const handle = (raw || "").replace(/^@/, "").trim();
  if (!handle) return "";
  if (/^1\d{10}$/.test(handle)) return `${handle.slice(0, 3)}****${handle.slice(-4)}`;
  const at = handle.indexOf("@");
  if (at > 1) return `${handle.slice(0, 2)}***${handle.slice(at)}`;
  if (handle.length > 10) return `${handle.slice(0, 4)}***${handle.slice(-3)}`;
  return handle;
}
