import JSON5 from "json5";
import type { ConfigState, InstallerGatewayBind, InstallerSetupPayload, SystemInfo } from "../../main/types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function readPath(root: unknown, path: string[]) {
  let current = root;

  for (const segment of path) {
    const record = asRecord(current);
    if (!record) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
}

function readString(root: unknown, path: string[]) {
  const value = readPath(root, path);
  return typeof value === "string" ? value : "";
}

function readBoolean(root: unknown, path: string[]) {
  return readPath(root, path) === true;
}

function readNumber(root: unknown, path: string[]) {
  const value = readPath(root, path);
  return typeof value === "number" ? value : undefined;
}

function readStringArray(root: unknown, path: string[]) {
  const value = readPath(root, path);
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry) => typeof entry === "string").join(", ");
}

function inferGatewayBind(value: string): InstallerGatewayBind {
  if (value === "loopback" || value === "lan" || value === "tailnet" || value === "auto") {
    return value;
  }

  if (value === "0.0.0.0" || value === "::") {
    return "lan";
  }

  if (value === "127.0.0.1" || value === "localhost") {
    return "loopback";
  }

  return "auto";
}

export function createDefaultInstallerSetup(systemInfo: SystemInfo): InstallerSetupPayload {
  return {
    existingConfig: "modify",
    resetScope: "config",
    flow: "quickstart",
    mode: "local",
    workspace: systemInfo.defaultWorkspacePath,
    repoRoot: "",
    skipBootstrap: false,
    toolProfile: "coding",
    dmScope: "per-channel-peer",
    gatewayBind: "loopback",
    gatewayPort: 18789,
    gatewayAuth: "token",
    gatewayToken: "",
    gatewayPassword: "",
    tailscale: "off",
    secretInputMode: "plaintext",
    authChoice: "skip",
    openaiApiKey: "",
    anthropicApiKey: "",
    geminiApiKey: "",
    xaiApiKey: "",
    moonshotApiKey: "",
    kimiCodeApiKey: "",
    customApiKey: "",
    customBaseUrl: "",
    customModelId: "",
    customProviderId: "",
    customCompatibility: "openai",
    remoteUrl: "",
    remoteToken: "",
    installDaemon: true,
    nodeManager: "npm",
    skipSkills: false,
    skipChannels: true,
    skipHealth: false,
    searchProvider: "none",
    searchApiKey: "",
    telegramEnabled: false,
    telegramBotToken: "",
    telegramAllowFrom: "",
    telegramDmPolicy: "pairing",
    discordEnabled: false,
    discordToken: "",
    discordAllowFrom: "",
    discordDmPolicy: "pairing",
    whatsappEnabled: false,
    whatsappAllowFrom: "",
    whatsappDmPolicy: "pairing",
    whatsappGroupPolicy: "allowlist",
    whatsappGroupAllowFrom: "",
    googlechatEnabled: false,
    googlechatServiceAccountFile: "",
    googlechatAudienceType: "app-url",
    googlechatAudience: "",
    googlechatWebhookPath: "",
    googlechatBotUser: "",
    googlechatDmPolicy: "pairing",
    googlechatAllowFrom: "",
    mattermostEnabled: false,
    mattermostBaseUrl: "",
    mattermostBotToken: "",
    mattermostDmPolicy: "pairing",
    mattermostChatmode: "oncall",
    mattermostOncharPrefixes: "",
    signalEnabled: false,
    signalAccount: "",
    signalCliPath: "",
    signalDmPolicy: "pairing",
    signalAllowFrom: "",
    bluebubblesEnabled: false,
    bluebubblesServerUrl: "",
    bluebubblesPassword: "",
    bluebubblesWebhookPath: "",
    bluebubblesDmPolicy: "pairing",
    bluebubblesAllowFrom: "",
    imessageEnabled: false,
    imessageCliPath: "",
    imessageDbPath: "",
    imessageRemoteHost: "",
    imessageDmPolicy: "pairing",
    imessageAllowFrom: "",
  };
}

export function installerSetupFromConfig(configState: ConfigState, systemInfo: SystemInfo): InstallerSetupPayload {
  const fallback = createDefaultInstallerSetup(systemInfo);
  const source = configState.valid ? configState.content : configState.template;

  try {
    const parsed = JSON5.parse(source);
    const gatewayMode = readString(parsed, ["gateway", "mode"]);

    return {
      ...fallback,
      existingConfig: configState.exists ? "modify" : "keep",
      mode: gatewayMode === "remote" ? "remote" : "local",
      workspace: readString(parsed, ["agents", "defaults", "workspace"]) || fallback.workspace,
      repoRoot: readString(parsed, ["agents", "defaults", "repoRoot"]),
      skipBootstrap: readBoolean(parsed, ["agents", "defaults", "skipBootstrap"]),
      toolProfile: readString(parsed, ["tools", "profile"]) === "general" ? "general" : "coding",
      dmScope:
        readString(parsed, ["session", "dmScope"]) === "main"
          ? "main"
          : readString(parsed, ["session", "dmScope"]) === "per-account-channel-peer"
            ? "per-account-channel-peer"
            : "per-channel-peer",
      gatewayBind: inferGatewayBind(readString(parsed, ["gateway", "bind"])),
      gatewayPort: readNumber(parsed, ["gateway", "port"]) || fallback.gatewayPort,
      gatewayAuth: readString(parsed, ["gateway", "auth", "mode"]) === "password" ? "password" : "token",
      gatewayToken: readString(parsed, ["gateway", "auth", "token"]),
      gatewayPassword: readString(parsed, ["gateway", "auth", "password"]),
      remoteUrl: readString(parsed, ["gateway", "remote", "url"]),
      remoteToken: readString(parsed, ["gateway", "remote", "token"]),
      searchProvider:
        readString(parsed, ["tools", "web", "search", "provider"]) === "brave"
          ? "brave"
          : readString(parsed, ["tools", "web", "search", "provider"]) === "perplexity"
            ? "perplexity"
            : "none",
      searchApiKey: readString(parsed, ["tools", "web", "search", "apiKey"]),
      telegramEnabled: Boolean(readString(parsed, ["channels", "telegram", "botToken"])),
      telegramBotToken: readString(parsed, ["channels", "telegram", "botToken"]),
      telegramAllowFrom: readStringArray(parsed, ["channels", "telegram", "allowFrom"]),
      telegramDmPolicy: readString(parsed, ["channels", "telegram", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "telegram", "dmPolicy"]) === "open" ? "open" : "pairing",
      discordEnabled: Boolean(readString(parsed, ["channels", "discord", "token"])),
      discordToken: readString(parsed, ["channels", "discord", "token"]),
      discordAllowFrom: readStringArray(parsed, ["channels", "discord", "allowFrom"]),
      discordDmPolicy: readString(parsed, ["channels", "discord", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "discord", "dmPolicy"]) === "open" ? "open" : "pairing",
      whatsappEnabled: readPath(parsed, ["channels", "whatsapp", "enabled"]) === true,
      whatsappAllowFrom: readStringArray(parsed, ["channels", "whatsapp", "allowFrom"]),
      whatsappDmPolicy: readString(parsed, ["channels", "whatsapp", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "whatsapp", "dmPolicy"]) === "open" ? "open" : "pairing",
      whatsappGroupPolicy:
        readString(parsed, ["channels", "whatsapp", "groupPolicy"]) === "open"
          ? "open"
          : readString(parsed, ["channels", "whatsapp", "groupPolicy"]) === "disabled"
            ? "disabled"
            : "allowlist",
      whatsappGroupAllowFrom: readStringArray(parsed, ["channels", "whatsapp", "groupAllowFrom"]),
      googlechatEnabled: Boolean(readPath(parsed, ["channels", "googlechat"])),
      googlechatServiceAccountFile: readString(parsed, ["channels", "googlechat", "serviceAccountFile"]),
      googlechatAudienceType:
        readString(parsed, ["channels", "googlechat", "auth", "audienceType"]) === "project-number" ? "project-number" : "app-url",
      googlechatAudience: readString(parsed, ["channels", "googlechat", "auth", "audience"]),
      googlechatWebhookPath: readString(parsed, ["channels", "googlechat", "webhookPath"]),
      googlechatBotUser: readString(parsed, ["channels", "googlechat", "botUser"]),
      googlechatDmPolicy: readString(parsed, ["channels", "googlechat", "dm", "policy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "googlechat", "dm", "policy"]) === "open" ? "open" : "pairing",
      googlechatAllowFrom: readStringArray(parsed, ["channels", "googlechat", "dm", "allowFrom"]),
      mattermostEnabled: Boolean(readPath(parsed, ["channels", "mattermost"])),
      mattermostBaseUrl: readString(parsed, ["channels", "mattermost", "baseUrl"]),
      mattermostBotToken: readString(parsed, ["channels", "mattermost", "botToken"]),
      mattermostDmPolicy: readString(parsed, ["channels", "mattermost", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "mattermost", "dmPolicy"]) === "open" ? "open" : "pairing",
      mattermostChatmode:
        readString(parsed, ["channels", "mattermost", "chatmode"]) === "onmessage"
          ? "onmessage"
          : readString(parsed, ["channels", "mattermost", "chatmode"]) === "onchar"
            ? "onchar"
            : "oncall",
      mattermostOncharPrefixes: readStringArray(parsed, ["channels", "mattermost", "oncharPrefixes"]),
      signalEnabled: Boolean(readPath(parsed, ["channels", "signal"])),
      signalAccount: readString(parsed, ["channels", "signal", "account"]),
      signalCliPath: readString(parsed, ["channels", "signal", "cliPath"]),
      signalDmPolicy: readString(parsed, ["channels", "signal", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "signal", "dmPolicy"]) === "open" ? "open" : "pairing",
      signalAllowFrom: readStringArray(parsed, ["channels", "signal", "allowFrom"]),
      bluebubblesEnabled: Boolean(readPath(parsed, ["channels", "bluebubbles"])),
      bluebubblesServerUrl: readString(parsed, ["channels", "bluebubbles", "serverUrl"]),
      bluebubblesPassword: readString(parsed, ["channels", "bluebubbles", "password"]),
      bluebubblesWebhookPath: readString(parsed, ["channels", "bluebubbles", "webhookPath"]),
      bluebubblesDmPolicy: readString(parsed, ["channels", "bluebubbles", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "bluebubbles", "dmPolicy"]) === "open" ? "open" : "pairing",
      bluebubblesAllowFrom: readStringArray(parsed, ["channels", "bluebubbles", "allowFrom"]),
      imessageEnabled: Boolean(readPath(parsed, ["channels", "imessage"])),
      imessageCliPath: readString(parsed, ["channels", "imessage", "cliPath"]),
      imessageDbPath: readString(parsed, ["channels", "imessage", "dbPath"]),
      imessageRemoteHost: readString(parsed, ["channels", "imessage", "remoteHost"]),
      imessageDmPolicy: readString(parsed, ["channels", "imessage", "dmPolicy"]) === "allowlist" ? "allowlist" : readString(parsed, ["channels", "imessage", "dmPolicy"]) === "open" ? "open" : "pairing",
      imessageAllowFrom: readStringArray(parsed, ["channels", "imessage", "allowFrom"]),
    };
  } catch {
    return fallback;
  }
}
