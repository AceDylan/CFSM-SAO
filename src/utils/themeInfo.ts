import pkg from "../../package.json" with { type: "json" };

/** 当前主题版本（构建时写入）。 */
export const THEME_VERSION = `v${pkg.version}`;

/** 本站实际部署的主题源码仓库；main 推送后由 CI 自动发布。 */
export const THEME_REPO_URL = "https://github.com/AceDylan/CFSM-SAO";
