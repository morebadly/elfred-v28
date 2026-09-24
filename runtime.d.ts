// The retained database helper is optional; this prototype has no D1 binding.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
