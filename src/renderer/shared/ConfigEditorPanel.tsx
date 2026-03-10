import JSON5 from "json5";
import type { ConfigState, InstallerChannelDmPolicy, InstallerChannelGroupPolicy } from "../../main/types";
import type { IntentControls } from "../app/model";
import IntentButton from "./IntentButton";

type ProviderPreset =
  | "openai"
  | "gemini"
  | "minimax-global"
  | "minimax-cn"
  | "anthropic"
  | "deepseek"
  | "glm"
  | "kimi";

interface ProviderMeta {
  label: string;
  defaultModel: string;
  models: string[];
  apiKeyEnv: string;
  providerId?: string;
  baseUrl?: string;
  api?: string;
}

interface ConfigEditorPanelProps {
  configState: ConfigState;
  configDraft: string;
  setConfigDraft: (next: string) => void;
  configDirty: boolean;
  controls: IntentControls;
  section?: ConfigEditorSection;
}

export type ConfigEditorSection = "all" | "models" | "skills" | "channels" | "settings";

function parseDraft(content: string) {
  try {
    const parsed = JSON5.parse(content) as Record<string, unknown>;
    return { parsed, error: undefined as string | undefined };
  } catch (error) {
    return { parsed: {} as Record<string, unknown>, error: error instanceof Error ? error.message : "配置解析失败" };
  }
}

function updateDraft(content: string, updater: (draft: Record<string, unknown>) => void) {
  const { parsed } = parseDraft(content);
  updater(parsed);
  return JSON.stringify(parsed, null, 2);
}

function ensureRecord(root: Record<string, unknown>, key: string) {
  const next = root[key];
  if (typeof next === "object" && next !== null && !Array.isArray(next)) {
    return next as Record<string, unknown>;
  }

  const created: Record<string, unknown> = {};
  root[key] = created;
  return created;
}

function readStringField(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : "";
}

function readNumberField(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "number" ? String(current) : "";
}

function readUnknownField(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function readBooleanField(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current === true;
}

function readStringArrayField(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (!Array.isArray(current)) {
    return "";
  }

  return current.filter((entry) => typeof entry === "string").join(", ");
}

function readModelCatalogField(source: Record<string, unknown>, path: string[]) {
  const current = readUnknownField(source, path);

  if (Array.isArray(current)) {
    return current.filter((entry) => typeof entry === "string").join(", ");
  }

  if (current && typeof current === "object") {
    return Object.keys(current as Record<string, unknown>).join(", ");
  }

  return "";
}

function toStringArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateAllowList(
  configDraft: string,
  setConfigDraft: (next: string) => void,
  path: string[],
  value: string,
) {
  setConfigDraft(
    updateDraft(configDraft, (draft) => {
      let current = draft;
      for (const segment of path.slice(0, -1)) {
        current = ensureRecord(current, segment);
      }
      const next = toStringArray(value);
      const leaf = path[path.length - 1];
      if (next.length > 0) {
        current[leaf] = next;
      } else {
        delete current[leaf];
      }
    }),
  );
}

function ChannelDmPolicyOptions() {
  return (
    <>
      <option value="pairing">pairing</option>
      <option value="allowlist">allowlist</option>
      <option value="open">open</option>
    </>
  );
}

function ChannelGroupPolicyOptions() {
  return (
    <>
      <option value="allowlist">allowlist</option>
      <option value="open">open</option>
      <option value="disabled">disabled</option>
    </>
  );
}

const providerPresetMeta: Record<ProviderPreset, ProviderMeta> = {
  openai: {
    label: "OpenAI",
    defaultModel: "openai/gpt-5.4",
    models: ["openai/gpt-5.4", "openai/gpt-5.2", "openai/gpt-5-mini"],
    apiKeyEnv: "OPENAI_API_KEY",
  },
  gemini: {
    label: "Gemini",
    defaultModel: "google/gemini-3.1-pro-preview",
    models: ["google/gemini-3.1-pro-preview", "google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite-preview"],
    apiKeyEnv: "GEMINI_API_KEY",
  },
  "minimax-global": {
    label: "MiniMax 国际",
    defaultModel: "minimax/MiniMax-M2.5",
    models: [
      "minimax/MiniMax-M2.5",
      "minimax/MiniMax-M2.5-highspeed",
      "minimax/MiniMax-M2.1",
      "minimax/MiniMax-M2.1-highspeed",
    ],
    apiKeyEnv: "MINIMAX_API_KEY",
    providerId: "minimax",
    baseUrl: "https://api.minimax.io/anthropic",
    api: "anthropic-messages",
  },
  "minimax-cn": {
    label: "MiniMax 国内",
    defaultModel: "minimax/MiniMax-M2.5",
    models: [
      "minimax/MiniMax-M2.5",
      "minimax/MiniMax-M2.5-highspeed",
      "minimax/MiniMax-M2.1",
      "minimax/MiniMax-M2.1-highspeed",
    ],
    apiKeyEnv: "MINIMAX_API_KEY",
    providerId: "minimax",
    baseUrl: "https://api.minimaxi.com/anthropic",
    api: "anthropic-messages",
  },
  anthropic: {
    label: "Claude",
    defaultModel: "anthropic/claude-opus-4-6",
    models: ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-6", "anthropic/claude-sonnet-4-5"],
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek/deepseek-chat",
    models: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
    apiKeyEnv: "DEEPSEEK_API_KEY",
    providerId: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    api: "openai-completions",
  },
  glm: {
    label: "GLM",
    defaultModel: "zai/glm-4.7",
    models: ["zai/glm-4.7", "zai/glm-5"],
    apiKeyEnv: "ZAI_API_KEY",
  },
  kimi: {
    label: "Kimi",
    defaultModel: "moonshot/kimi-k2.5",
    models: ["moonshot/kimi-k2.5", "moonshot/kimi-k2-0905-preview", "moonshot/kimi-k2-thinking"],
    apiKeyEnv: "MOONSHOT_API_KEY",
    providerId: "moonshot",
    baseUrl: "https://api.moonshot.ai/v1",
    api: "openai-completions",
  },
};

function inferProviderPreset(primaryModel: string, minimaxBaseUrl: string): ProviderPreset {
  if (primaryModel.startsWith("openai/")) {
    return "openai";
  }
  if (primaryModel.startsWith("google/")) {
    return "gemini";
  }
  if (primaryModel.startsWith("anthropic/")) {
    return "anthropic";
  }
  if (primaryModel.startsWith("zai/")) {
    return "glm";
  }
  if (primaryModel.startsWith("moonshot/")) {
    return "kimi";
  }
  if (primaryModel.startsWith("deepseek/")) {
    return "deepseek";
  }
  if (primaryModel.startsWith("minimax/")) {
    return minimaxBaseUrl.includes("minimaxi.com") ? "minimax-cn" : "minimax-global";
  }

  return "openai";
}

function setEnvValue(draft: Record<string, unknown>, key: string, value: string) {
  const env = ensureRecord(draft, "env");
  if (value.trim()) {
    env[key] = value;
  } else {
    delete env[key];
  }
}

function setPrimaryModel(draft: Record<string, unknown>, modelId: string) {
  const agents = ensureRecord(draft, "agents");
  const defaults = ensureRecord(agents, "defaults");
  const model = ensureRecord(defaults, "model");
  model.primary = modelId;
}

function setModelAllowlist(draft: Record<string, unknown>, modelId: string) {
  setModelCatalog(draft, [modelId], { preserveExisting: true });
}

function setModelCatalog(
  draft: Record<string, unknown>,
  modelIds: string[],
  options: { preserveExisting: boolean } = { preserveExisting: false },
) {
  const agents = ensureRecord(draft, "agents");
  const defaults = ensureRecord(agents, "defaults");
  const current = readUnknownField(draft, ["agents", "defaults", "models"]);
  const currentRecord =
    current && typeof current === "object" && !Array.isArray(current) ? (current as Record<string, unknown>) : undefined;
  const next: Record<string, unknown> = {};
  const uniqueIds = Array.from(new Set(modelIds.map((id) => id.trim()).filter(Boolean)));

  if (uniqueIds.length === 0) {
    delete defaults.models;
    return;
  }

  for (const id of uniqueIds) {
    if (options.preserveExisting && currentRecord?.[id] && typeof currentRecord[id] === "object" && currentRecord[id] !== null) {
      next[id] = currentRecord[id];
    } else {
      next[id] = {};
    }
  }

  defaults.models = next;
}

function setCustomProvider(
  draft: Record<string, unknown>,
  providerId: string,
  apiKeyEnv: string,
  baseUrl: string,
  api: string,
  modelIds: string[],
) {
  const models = ensureRecord(draft, "models");
  models.mode = "merge";
  const providers = ensureRecord(models, "providers");
  providers[providerId] = {
    baseUrl,
    apiKey: `\${${apiKeyEnv}}`,
    api,
    models: modelIds.map((id) => ({
      id: id.split("/").slice(1).join("/"),
      name: id.split("/").slice(1).join("/"),
    })),
  };
}

function applyProviderPreset(draft: Record<string, unknown>, preset: ProviderPreset, modelId?: string) {
  const meta = providerPresetMeta[preset];
  const nextModelId = modelId || meta.defaultModel;
  setPrimaryModel(draft, nextModelId);
  setModelAllowlist(draft, nextModelId);

  if (meta.providerId && meta.baseUrl && meta.api) {
    setCustomProvider(draft, meta.providerId, meta.apiKeyEnv, meta.baseUrl, meta.api, meta.models);
  }
}

function dashboardHostFromBind(bind: string) {
  if (!bind || bind === "loopback" || bind === "auto" || bind === "lan" || bind === "tailnet") {
    return "127.0.0.1";
  }

  return bind;
}

export default function ConfigEditorPanel({
  configState,
  configDraft,
  setConfigDraft,
  configDirty,
  controls,
  section = "all",
}: ConfigEditorPanelProps) {
  const { parsed, error } = parseDraft(configDraft);
  const workspace = readStringField(parsed, ["agents", "defaults", "workspace"]);
  const gatewayBind = readStringField(parsed, ["gateway", "bind"]);
  const gatewayPort = readNumberField(parsed, ["gateway", "port"]);
  const minimaxBaseUrl = readStringField(parsed, ["models", "providers", "minimax", "baseUrl"]);
  const toolProfile = readStringField(parsed, ["tools", "profile"]) || "coding";
  const searchProvider = readStringField(parsed, ["tools", "web", "search", "provider"]) || "none";
  const searchApiKey = readStringField(parsed, ["tools", "web", "search", "apiKey"]);
  const primaryModel = readStringField(parsed, ["agents", "defaults", "model", "primary"]);
  const providerPreset = inferProviderPreset(primaryModel, minimaxBaseUrl);
  const providerMeta = providerPresetMeta[providerPreset];
  const providerApiKey = readStringField(parsed, ["env", providerMeta.apiKeyEnv]);
  const minimaxPreset = minimaxBaseUrl.includes("minimaxi.com") ? "minimax-cn" : "minimax-global";
  const minimaxMeta = providerPresetMeta[minimaxPreset];
  const minimaxApiKey = readStringField(parsed, ["env", minimaxMeta.apiKeyEnv]);
  const providerEntries = (
    [
      "openai",
      "gemini",
      "anthropic",
      "deepseek",
      "glm",
      "kimi",
    ] as ProviderPreset[]
  ).map((key) => [key, providerPresetMeta[key]] as const);
  const fallbackModels = readStringArrayField(parsed, ["agents", "defaults", "model", "fallbacks"]);
  const allowedModels = readModelCatalogField(parsed, ["agents", "defaults", "models"]);
  const imageModel = readStringField(parsed, ["agents", "defaults", "imageModel"]);
  const pdfModel = readStringField(parsed, ["agents", "defaults", "pdfModel"]);
  const bundledSkillSetting = readUnknownField(parsed, ["skills", "allowBundled"]);
  const bundledSkills = bundledSkillSetting === undefined ? true : bundledSkillSetting === true;
  const nodeManager = readStringField(parsed, ["skills", "install", "nodeManager"]) || "npm";
  const skillsWatch = readBooleanField(parsed, ["skills", "load", "watch"]);
  const skillDirs = readStringArrayField(parsed, ["skills", "load", "extraDirs"]);
  const telegramEnabled = readBooleanField(parsed, ["channels", "telegram", "enabled"]) || Boolean(readStringField(parsed, ["channels", "telegram", "botToken"]));
  const telegramBotToken = readStringField(parsed, ["channels", "telegram", "botToken"]);
  const telegramAllowFrom = readStringArrayField(parsed, ["channels", "telegram", "allowFrom"]);
  const telegramDmPolicy = (readStringField(parsed, ["channels", "telegram", "dmPolicy"]) || "pairing") as InstallerChannelDmPolicy;
  const discordEnabled = readBooleanField(parsed, ["channels", "discord", "enabled"]) || Boolean(readStringField(parsed, ["channels", "discord", "token"]));
  const discordToken = readStringField(parsed, ["channels", "discord", "token"]);
  const discordAllowFrom = readStringArrayField(parsed, ["channels", "discord", "allowFrom"]);
  const discordDmPolicy = (readStringField(parsed, ["channels", "discord", "dmPolicy"]) || "pairing") as InstallerChannelDmPolicy;
  const whatsappEnabled = readBooleanField(parsed, ["channels", "whatsapp", "enabled"]);
  const whatsappAllowFrom = readStringArrayField(parsed, ["channels", "whatsapp", "allowFrom"]);
  const whatsappDmPolicy = (readStringField(parsed, ["channels", "whatsapp", "dmPolicy"]) || "pairing") as InstallerChannelDmPolicy;
  const whatsappGroupPolicy = (readStringField(parsed, ["channels", "whatsapp", "groupPolicy"]) || "allowlist") as InstallerChannelGroupPolicy;
  const whatsappGroupAllowFrom = readStringArrayField(parsed, ["channels", "whatsapp", "groupAllowFrom"]);
  const signalEnabled = readBooleanField(parsed, ["channels", "signal", "enabled"]);
  const signalAccount = readStringField(parsed, ["channels", "signal", "account"]);
  const signalCliPath = readStringField(parsed, ["channels", "signal", "cliPath"]);
  const signalAllowFrom = readStringArrayField(parsed, ["channels", "signal", "allowFrom"]);
  const signalDmPolicy = (readStringField(parsed, ["channels", "signal", "dmPolicy"]) || "pairing") as InstallerChannelDmPolicy;
  const dashboardHost = dashboardHostFromBind(gatewayBind || configState.summary.gatewayBind || "127.0.0.1");
  const codexConfigured = configState.summary.openaiCodexConfigured === true;
  const codexAuthenticated = configState.summary.openaiCodexAuthenticated === true;
  const codexExpiresAt = configState.summary.openaiCodexExpiresAt;
  const codexStatusTone = codexAuthenticated ? "ready" : codexConfigured ? "active" : "warning";
  const codexStatusLabel = codexAuthenticated ? "Codex 已登录" : codexConfigured ? "已配置，待确认登录" : "未检测到登录";
  const codexStatusDetail = codexAuthenticated
    ? codexExpiresAt
      ? `OAuth 凭证有效期至 ${new Date(codexExpiresAt).toLocaleString()}`
      : "已检测到 OpenAI Codex OAuth 凭证。"
    : codexConfigured
      ? "配置里已经声明 openai-codex，但当前没有检测到本机 OAuth 凭证。"
      : "还没有检测到 openai-codex 凭证，可以直接发起 Codex 登录。";
  const showSettings = section === "all" || section === "settings";
  const showModels = section === "all" || section === "models";
  const showSkills = section === "all" || section === "skills";
  const showChannels = section === "all" || section === "channels";
  const saveLabel =
    section === "models"
      ? "保存模型配置"
      : section === "skills"
        ? "保存 Skills 配置"
        : section === "channels"
          ? "保存渠道配置"
          : "保存设置";

  return (
    <div className="config-panel-shell">
      <div className="config-panel-scroll">
        {showSettings ? (
          <div className="fact-grid">
            <article className="fact-card">
              <span>配置文件</span>
              <strong>{configState.path}</strong>
              <p>{configState.exists ? "已经存在，保存时会自动备份旧文件。" : "首次保存后将创建配置文件。"}</p>
            </article>
            <article className="fact-card">
              <span>当前 workspace</span>
              <strong>{workspace || configState.summary.workspace || "未填写"}</strong>
              <p>控制台设置会直接写入这份运行配置。</p>
            </article>
            <article className="fact-card">
              <span>Dashboard 地址</span>
              <strong>{dashboardHost}:{gatewayPort || configState.summary.gatewayPort || 18789}</strong>
              <p>保存配置并验证通过后，这里会成为主要入口。</p>
            </article>
          </div>
        ) : null}

        {error ? (
          <div className="inline-warning">
            <strong>当前配置无法解析</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {showSettings ? (
          <div className="form-grid">
            <label className="form-field">
              <span>workspace 路径</span>
              <input
                type="text"
                value={workspace}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      defaults.workspace = event.target.value;
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>gateway host</span>
              <input
                type="text"
                value={gatewayBind}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const gateway = (draft.gateway as Record<string, unknown> | undefined) || {};
                      gateway.bind = event.target.value;
                      draft.gateway = gateway;
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>gateway port</span>
              <input
                type="number"
                value={gatewayPort}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const gateway = (draft.gateway as Record<string, unknown> | undefined) || {};
                      gateway.port = Number(event.target.value || 18789);
                      draft.gateway = gateway;
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>tools.profile</span>
              <select
                value={toolProfile}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const tools = ensureRecord(draft, "tools");
                      tools.profile = event.target.value;
                    }),
                  );
                }}
              >
                <option value="coding">coding</option>
                <option value="general">general</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="stack-fields">
        {showModels ? (
        <article className="subform-card">
          <div className="subform-header">
            <strong>模型提供商</strong>
            <span className="mini-label">Provider</span>
          </div>
          <div className="compact-form-grid">
            <label className="form-field">
              <span>当前提供商</span>
              <select
                value={providerPreset}
                onChange={(event) => {
                  const nextPreset = event.target.value as ProviderPreset;
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      applyProviderPreset(draft, nextPreset);
                    }),
                  );
                }}
              >
                {Object.entries(providerPresetMeta).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>默认模型</span>
              <select
                value={primaryModel || providerMeta.defaultModel}
                onChange={(event) => {
                      setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      applyProviderPreset(draft, providerPreset, event.target.value);
                    }),
                  );
                }}
              >
                {providerMeta.models.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>API Key</span>
              <input
                type="password"
                value={providerApiKey}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      setEnvValue(draft, providerMeta.apiKeyEnv, event.target.value);
                    }),
                  );
                }}
              />
            </label>
            {providerMeta.baseUrl ? (
              <label className="form-field">
                <span>Base URL</span>
                <input
                  type="text"
                  value={readStringField(parsed, ["models", "providers", providerMeta.providerId!, "baseUrl"]) || providerMeta.baseUrl}
                  onChange={(event) => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        setCustomProvider(
                          draft,
                          providerMeta.providerId!,
                          providerMeta.apiKeyEnv,
                          event.target.value,
                          providerMeta.api!,
                          providerMeta.models,
                        );
                      }),
                    );
                  }}
                />
              </label>
            ) : null}
          </div>

          <div className="provider-credential-grid">
            <article className={`provider-credential-card${providerPreset === minimaxPreset ? " provider-credential-card-active" : ""}`}>
              <div className="provider-card-head">
                <div>
                  <strong>MiniMax</strong>
                  <p className="provider-card-copy">国际 / 国内共用 `MINIMAX_API_KEY`，当前通过 endpoint 决定接哪一边。</p>
                </div>
                <button
                  type="button"
                  className="ghost-button provider-card-action"
                  onClick={() => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        applyProviderPreset(draft, minimaxPreset);
                      }),
                    );
                  }}
                >
                  {providerPreset === minimaxPreset ? "当前使用中" : "设为当前"}
                </button>
              </div>
              <div className="compact-form-grid">
                <label className="form-field">
                  <span>Endpoint</span>
                  <select
                    value={minimaxPreset}
                    onChange={(event) => {
                      const nextPreset = event.target.value as "minimax-global" | "minimax-cn";
                      const nextMeta = providerPresetMeta[nextPreset];
                      setConfigDraft(
                        updateDraft(configDraft, (draft) => {
                          setCustomProvider(draft, nextMeta.providerId!, nextMeta.apiKeyEnv, nextMeta.baseUrl!, nextMeta.api!, nextMeta.models);
                          if (providerPreset.startsWith("minimax")) {
                            applyProviderPreset(draft, nextPreset);
                          }
                        }),
                      );
                    }}
                  >
                    <option value="minimax-global">国际</option>
                    <option value="minimax-cn">国内</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={minimaxApiKey}
                    onChange={(event) => {
                      setConfigDraft(
                        updateDraft(configDraft, (draft) => {
                          setEnvValue(draft, minimaxMeta.apiKeyEnv, event.target.value);
                          setCustomProvider(draft, minimaxMeta.providerId!, minimaxMeta.apiKeyEnv, minimaxMeta.baseUrl!, minimaxMeta.api!, minimaxMeta.models);
                        }),
                      );
                    }}
                  />
                </label>
                <label className="form-field">
                  <span>默认模型</span>
                  <select
                    value={providerPreset.startsWith("minimax") ? primaryModel || minimaxMeta.defaultModel : minimaxMeta.defaultModel}
                    onChange={(event) => {
                      setConfigDraft(
                        updateDraft(configDraft, (draft) => {
                          applyProviderPreset(draft, minimaxPreset, event.target.value);
                        }),
                      );
                    }}
                  >
                    {minimaxMeta.models.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Base URL</span>
                  <input
                    type="text"
                    value={readStringField(parsed, ["models", "providers", minimaxMeta.providerId!, "baseUrl"]) || minimaxMeta.baseUrl}
                    onChange={(event) => {
                      setConfigDraft(
                        updateDraft(configDraft, (draft) => {
                          setCustomProvider(
                            draft,
                            minimaxMeta.providerId!,
                            minimaxMeta.apiKeyEnv,
                            event.target.value,
                            minimaxMeta.api!,
                            minimaxMeta.models,
                          );
                        }),
                      );
                    }}
                  />
                </label>
              </div>
            </article>

            {providerEntries.map(([preset, meta]) => {
              const isCurrent = providerPreset === preset;
              const apiKeyValue = readStringField(parsed, ["env", meta.apiKeyEnv]);
              const configuredBaseUrl = meta.providerId ? readStringField(parsed, ["models", "providers", meta.providerId, "baseUrl"]) : "";
              const baseUrlValue = meta.baseUrl ? configuredBaseUrl || meta.baseUrl : "";

              return (
                <article key={preset} className={`provider-credential-card${isCurrent ? " provider-credential-card-active" : ""}`}>
                  <div className="provider-card-head">
                    <div>
                      <strong>{meta.label}</strong>
                      <p className="provider-card-copy">当前环境变量键：`{meta.apiKeyEnv}`</p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button provider-card-action"
                      onClick={() => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            applyProviderPreset(draft, preset);
                          }),
                        );
                      }}
                    >
                      {isCurrent ? "当前使用中" : "设为当前"}
                    </button>
                  </div>
                  {preset === "openai" ? (
                    <div className="intent-row">
                      <span className={`status-badge status-badge-${codexStatusTone}`}>{codexStatusLabel}</span>
                      <IntentButton intent="loginOpenaiCodex" fallbackLabel="使用 Codex 登录" {...controls} />
                      <IntentButton intent="refreshAll" fallbackLabel="重新检测" {...controls} />
                    </div>
                  ) : null}
                  {preset === "openai" ? <p className="provider-card-copy">{codexStatusDetail}</p> : null}
                  <div className="compact-form-grid">
                    <label className="form-field">
                      <span>API Key</span>
                      <input
                        type="password"
                        value={apiKeyValue}
                        onChange={(event) => {
                          setConfigDraft(
                            updateDraft(configDraft, (draft) => {
                              setEnvValue(draft, meta.apiKeyEnv, event.target.value);
                              if (meta.providerId && meta.baseUrl && meta.api) {
                                setCustomProvider(draft, meta.providerId, meta.apiKeyEnv, baseUrlValue, meta.api, meta.models);
                              }
                            }),
                          );
                        }}
                      />
                    </label>
                    <label className="form-field">
                      <span>默认模型</span>
                      <select
                        value={isCurrent ? primaryModel || meta.defaultModel : meta.defaultModel}
                        onChange={(event) => {
                          setConfigDraft(
                            updateDraft(configDraft, (draft) => {
                              if (meta.providerId && meta.baseUrl && meta.api) {
                                setCustomProvider(draft, meta.providerId, meta.apiKeyEnv, baseUrlValue, meta.api, meta.models);
                              }
                              applyProviderPreset(draft, preset, event.target.value);
                            }),
                          );
                        }}
                      >
                        {meta.models.map((modelId) => (
                          <option key={modelId} value={modelId}>
                            {modelId}
                          </option>
                        ))}
                      </select>
                    </label>
                    {meta.baseUrl ? (
                      <label className="form-field form-field-wide">
                        <span>Base URL</span>
                        <input
                          type="text"
                          value={baseUrlValue}
                          onChange={(event) => {
                            setConfigDraft(
                              updateDraft(configDraft, (draft) => {
                                setCustomProvider(draft, meta.providerId!, meta.apiKeyEnv, event.target.value, meta.api!, meta.models);
                              }),
                            );
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </article>
        ) : null}

        {showModels ? (
        <article className="subform-card">
          <div className="subform-header">
            <strong>模型</strong>
            <span className="mini-label">Models</span>
          </div>
          <div className="compact-form-grid">
            <label className="form-field">
              <span>默认主模型</span>
              <input
                type="text"
                value={primaryModel}
                placeholder="例如 openai/gpt-5"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      const model = ensureRecord(defaults, "model");
                      model.primary = event.target.value;
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>候选回退模型</span>
              <input
                type="text"
                value={fallbackModels}
                placeholder="逗号分隔"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      const model = ensureRecord(defaults, "model");
                      const next = toStringArray(event.target.value);
                      if (next.length > 0) {
                        model.fallbacks = next;
                      } else {
                        delete model.fallbacks;
                      }
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>图片模型</span>
              <input
                type="text"
                value={imageModel}
                placeholder="可选"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      if (event.target.value.trim()) {
                        defaults.imageModel = event.target.value;
                      } else {
                        delete defaults.imageModel;
                      }
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field">
              <span>PDF 模型</span>
              <input
                type="text"
                value={pdfModel}
                placeholder="可选"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      if (event.target.value.trim()) {
                        defaults.pdfModel = event.target.value;
                      } else {
                        delete defaults.pdfModel;
                      }
                    }),
                  );
                }}
              />
            </label>
            <label className="form-field form-field-wide">
              <span>模型 allowlist</span>
              <input
                type="text"
                value={allowedModels}
                placeholder="逗号分隔，例如 openai/gpt-5, anthropic/claude-3-7-sonnet"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const agents = ensureRecord(draft, "agents");
                      const defaults = ensureRecord(agents, "defaults");
                      const next = toStringArray(event.target.value);
                      setModelCatalog(draft, next);
                    }),
                  );
                }}
              />
            </label>
          </div>
        </article>
        ) : null}

        {showSkills ? (
        <article className="subform-card">
          <div className="subform-header">
            <strong>Skills 与搜索</strong>
            <span className="mini-label">Tools</span>
          </div>
          <div className="compact-form-grid">
            <label className="form-field">
              <span>搜索提供商</span>
              <select
                value={searchProvider}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const tools = ensureRecord(draft, "tools");
                      const web = ensureRecord(tools, "web");
                      if (event.target.value === "none") {
                        delete web.search;
                        return;
                      }
                      const search = ensureRecord(web, "search");
                      search.provider = event.target.value;
                    }),
                  );
                }}
              >
                <option value="none">none</option>
                <option value="brave">brave</option>
                <option value="perplexity">perplexity</option>
              </select>
            </label>
            <label className="form-field">
              <span>搜索 API Key</span>
              <input
                type="password"
                value={searchApiKey}
                placeholder={searchProvider === "none" ? "先启用 provider" : ""}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const tools = ensureRecord(draft, "tools");
                      const web = ensureRecord(tools, "web");
                      const search = ensureRecord(web, "search");
                      if (event.target.value.trim()) {
                        search.apiKey = event.target.value;
                      } else {
                        delete search.apiKey;
                      }
                    }),
                  );
                }}
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={bundledSkills}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const skills = ensureRecord(draft, "skills");
                      if (event.target.checked) {
                        delete skills.allowBundled;
                      } else {
                        skills.allowBundled = false;
                      }
                    }),
                  );
                }}
              />
              <span>启用 bundled skills</span>
            </label>
            <label className="form-field">
              <span>node manager</span>
              <select
                value={nodeManager}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const skills = ensureRecord(draft, "skills");
                      const install = ensureRecord(skills, "install");
                      install.nodeManager = event.target.value;
                    }),
                  );
                }}
              >
                <option value="npm">npm</option>
                <option value="pnpm">pnpm</option>
                <option value="bun">bun</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={skillsWatch}
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const skills = ensureRecord(draft, "skills");
                      const load = ensureRecord(skills, "load");
                      if (event.target.checked) {
                        load.watch = true;
                      } else {
                        delete load.watch;
                      }
                    }),
                  );
                }}
              />
              <span>监听额外 skill 目录</span>
            </label>
            <label className="form-field form-field-wide">
              <span>额外 skill 目录</span>
              <input
                type="text"
                value={skillDirs}
                placeholder="逗号分隔目录路径"
                onChange={(event) => {
                  setConfigDraft(
                    updateDraft(configDraft, (draft) => {
                      const skills = ensureRecord(draft, "skills");
                      const load = ensureRecord(skills, "load");
                      const next = toStringArray(event.target.value);
                      if (next.length > 0) {
                        load.extraDirs = next;
                      } else {
                        delete load.extraDirs;
                      }
                    }),
                  );
                }}
              />
            </label>
          </div>
        </article>
        ) : null}

        {showChannels ? (
        <article className="subform-card">
          <div className="subform-header">
            <strong>Channels</strong>
            <span className="mini-label">Messaging</span>
          </div>

          <div className="stack-fields">
            <div className="subform-card">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(event) => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        const channels = ensureRecord(draft, "channels");
                        const telegram = ensureRecord(channels, "telegram");
                        telegram.enabled = event.target.checked;
                      }),
                    );
                  }}
                />
                <span>Telegram</span>
              </label>
              {telegramEnabled ? (
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>botToken</span>
                    <input
                      type="password"
                      value={telegramBotToken}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const telegram = ensureRecord(channels, "telegram");
                            telegram.botToken = event.target.value;
                          }),
                        );
                      }}
                    />
                  </label>
                  <label className="form-field">
                    <span>dmPolicy</span>
                    <select
                      value={telegramDmPolicy}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const telegram = ensureRecord(channels, "telegram");
                            telegram.dmPolicy = event.target.value;
                          }),
                        );
                      }}
                    >
                      <ChannelDmPolicyOptions />
                    </select>
                  </label>
                  <label className="form-field form-field-wide">
                    <span>allowFrom</span>
                    <input
                      type="text"
                      value={telegramAllowFrom}
                      placeholder="逗号分隔"
                      onChange={(event) => updateAllowList(configDraft, setConfigDraft, ["channels", "telegram", "allowFrom"], event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="subform-card">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={discordEnabled}
                  onChange={(event) => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        const channels = ensureRecord(draft, "channels");
                        const discord = ensureRecord(channels, "discord");
                        discord.enabled = event.target.checked;
                      }),
                    );
                  }}
                />
                <span>Discord</span>
              </label>
              {discordEnabled ? (
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>token</span>
                    <input
                      type="password"
                      value={discordToken}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const discord = ensureRecord(channels, "discord");
                            discord.token = event.target.value;
                          }),
                        );
                      }}
                    />
                  </label>
                  <label className="form-field">
                    <span>dmPolicy</span>
                    <select
                      value={discordDmPolicy}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const discord = ensureRecord(channels, "discord");
                            discord.dmPolicy = event.target.value;
                          }),
                        );
                      }}
                    >
                      <ChannelDmPolicyOptions />
                    </select>
                  </label>
                  <label className="form-field form-field-wide">
                    <span>allowFrom</span>
                    <input
                      type="text"
                      value={discordAllowFrom}
                      placeholder="逗号分隔"
                      onChange={(event) => updateAllowList(configDraft, setConfigDraft, ["channels", "discord", "allowFrom"], event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="subform-card">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={(event) => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        const channels = ensureRecord(draft, "channels");
                        const whatsapp = ensureRecord(channels, "whatsapp");
                        whatsapp.enabled = event.target.checked;
                      }),
                    );
                  }}
                />
                <span>WhatsApp</span>
              </label>
              {whatsappEnabled ? (
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>dmPolicy</span>
                    <select
                      value={whatsappDmPolicy}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const whatsapp = ensureRecord(channels, "whatsapp");
                            whatsapp.dmPolicy = event.target.value;
                          }),
                        );
                      }}
                    >
                      <ChannelDmPolicyOptions />
                    </select>
                  </label>
                  <label className="form-field">
                    <span>groupPolicy</span>
                    <select
                      value={whatsappGroupPolicy}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const whatsapp = ensureRecord(channels, "whatsapp");
                            whatsapp.groupPolicy = event.target.value;
                          }),
                        );
                      }}
                    >
                      <ChannelGroupPolicyOptions />
                    </select>
                  </label>
                  <label className="form-field">
                    <span>allowFrom</span>
                    <input
                      type="text"
                      value={whatsappAllowFrom}
                      placeholder="逗号分隔"
                      onChange={(event) => updateAllowList(configDraft, setConfigDraft, ["channels", "whatsapp", "allowFrom"], event.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    <span>groupAllowFrom</span>
                    <input
                      type="text"
                      value={whatsappGroupAllowFrom}
                      placeholder="逗号分隔"
                      onChange={(event) =>
                        updateAllowList(configDraft, setConfigDraft, ["channels", "whatsapp", "groupAllowFrom"], event.target.value)
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="subform-card">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={signalEnabled}
                  onChange={(event) => {
                    setConfigDraft(
                      updateDraft(configDraft, (draft) => {
                        const channels = ensureRecord(draft, "channels");
                        const signal = ensureRecord(channels, "signal");
                        signal.enabled = event.target.checked;
                      }),
                    );
                  }}
                />
                <span>Signal</span>
              </label>
              {signalEnabled ? (
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>account</span>
                    <input
                      type="text"
                      value={signalAccount}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const signal = ensureRecord(channels, "signal");
                            signal.account = event.target.value;
                          }),
                        );
                      }}
                    />
                  </label>
                  <label className="form-field">
                    <span>cliPath</span>
                    <input
                      type="text"
                      value={signalCliPath}
                      placeholder="可选"
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const signal = ensureRecord(channels, "signal");
                            if (event.target.value.trim()) {
                              signal.cliPath = event.target.value;
                            } else {
                              delete signal.cliPath;
                            }
                          }),
                        );
                      }}
                    />
                  </label>
                  <label className="form-field">
                    <span>dmPolicy</span>
                    <select
                      value={signalDmPolicy}
                      onChange={(event) => {
                        setConfigDraft(
                          updateDraft(configDraft, (draft) => {
                            const channels = ensureRecord(draft, "channels");
                            const signal = ensureRecord(channels, "signal");
                            signal.dmPolicy = event.target.value;
                          }),
                        );
                      }}
                    >
                      <ChannelDmPolicyOptions />
                    </select>
                  </label>
                  <label className="form-field">
                    <span>allowFrom</span>
                    <input
                      type="text"
                      value={signalAllowFrom}
                      placeholder="逗号分隔"
                      onChange={(event) => updateAllowList(configDraft, setConfigDraft, ["channels", "signal", "allowFrom"], event.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </article>
        ) : null}
        </div>

        {showSettings ? (
          <details className="advanced-block">
            <summary>高级 JSON5</summary>
            <textarea className="config-raw-editor" value={configDraft} onChange={(event) => setConfigDraft(event.target.value)} spellCheck={false} />
          </details>
        ) : null}
      </div>

      <div className="intent-row">
        <IntentButton intent="saveConfig" fallbackLabel={configDirty ? saveLabel : "已保存"} variant="primary" {...controls} />
        {showSettings ? <IntentButton intent="reloadConfig" fallbackLabel="从磁盘重载" {...controls} /> : null}
        {showSettings ? <IntentButton intent="resetConfigDraft" fallbackLabel="恢复默认模板" {...controls} /> : null}
        <IntentButton intent="revealConfigPath" fallbackLabel="打开配置位置" {...controls} />
      </div>
    </div>
  );
}
