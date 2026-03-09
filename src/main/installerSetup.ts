import type { InstallerAuthChoice, InstallerChannelDmPolicy, InstallerSetupPayload } from "./types";

function appendOption(target: string[], flag: string, value?: string | number | null | false) {
  if (value === undefined || value === null || value === false || value === "") {
    return;
  }

  target.push(flag, String(value));
}

function setRecordValue(root: Record<string, unknown>, path: string[], value: unknown) {
  let current = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const next = current[segment];
    if (typeof next !== "object" || !next || Array.isArray(next)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[path[path.length - 1]] = value;
}

function deleteRecordValue(root: Record<string, unknown>, path: string[]) {
  let current: Record<string, unknown> | undefined = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const next = current?.[path[index]];
    if (typeof next !== "object" || !next || Array.isArray(next)) {
      return;
    }

    current = next as Record<string, unknown>;
  }

  if (current) {
    delete current[path[path.length - 1]];
  }
}

function splitAllowFrom(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function setPluginEnabled(root: Record<string, unknown>, pluginKey: string) {
  setRecordValue(root, ["plugins", "entries", pluginKey, "enabled"], true);
}

function authFlagForChoice(choice: InstallerAuthChoice) {
  switch (choice) {
    case "openai-codex":
      return undefined;
    case "openai-api-key":
      return "--openai-api-key";
    case "anthropic-api-key":
      return "--anthropic-api-key";
    case "gemini-api-key":
      return "--gemini-api-key";
    case "xai-api-key":
      return "--xai-api-key";
    case "moonshot-api-key":
      return "--moonshot-api-key";
    case "kimi-code-api-key":
      return "--kimi-code-api-key";
    case "custom-api-key":
      return "--custom-api-key";
    default:
      return undefined;
  }
}

function authValueForChoice(setup: InstallerSetupPayload) {
  switch (setup.authChoice) {
    case "openai-api-key":
      return setup.openaiApiKey;
    case "anthropic-api-key":
      return setup.anthropicApiKey;
    case "gemini-api-key":
      return setup.geminiApiKey;
    case "xai-api-key":
      return setup.xaiApiKey;
    case "moonshot-api-key":
      return setup.moonshotApiKey;
    case "kimi-code-api-key":
      return setup.kimiCodeApiKey;
    case "custom-api-key":
      return setup.customApiKey;
    default:
      return "";
  }
}

export function validateInstallerSetup(setup: InstallerSetupPayload) {
  if (!setup.workspace.trim() && setup.mode === "local") {
    return "请先填写 workspace 路径。";
  }

  if (setup.mode === "remote" && !setup.remoteUrl.trim()) {
    return "Remote 模式需要填写远程 Gateway URL。";
  }

  const keyValue = authValueForChoice(setup);
  if (
    setup.authChoice !== "skip" &&
    setup.authChoice !== "setup-token" &&
    setup.authChoice !== "oauth" &&
    setup.authChoice !== "openai-codex" &&
    !keyValue.trim()
  ) {
    return "当前认证方式需要 API Key，或者把认证方式切回“稍后处理”。";
  }

  if (setup.authChoice === "custom-api-key" && (!setup.customBaseUrl.trim() || !setup.customModelId.trim())) {
    return "自定义 Provider 至少需要 base URL 和 model ID。";
  }

  if (setup.telegramEnabled && !setup.telegramBotToken.trim()) {
    return "Telegram 已启用，但 bot token 还是空的。";
  }

  if (setup.discordEnabled && !setup.discordToken.trim()) {
    return "Discord 已启用，但 token 还是空的。";
  }

  if (setup.googlechatEnabled && !setup.googlechatServiceAccountFile.trim()) {
    return "Google Chat 已启用，但 service account 文件路径还是空的。";
  }

  if (setup.mattermostEnabled && (!setup.mattermostBaseUrl.trim() || !setup.mattermostBotToken.trim())) {
    return "Mattermost 已启用，但 base URL 或 bot token 还没填完。";
  }

  if (setup.signalEnabled && !setup.signalAccount.trim()) {
    return "Signal 已启用，但账号还是空的。";
  }

  if (setup.bluebubblesEnabled && (!setup.bluebubblesServerUrl.trim() || !setup.bluebubblesPassword.trim())) {
    return "BlueBubbles 已启用，但 server URL 或 password 还没填完。";
  }

  if (setup.imessageEnabled && !setup.imessageCliPath.trim()) {
    return "iMessage 已启用，但 CLI 路径还是空的。";
  }

  return undefined;
}

export function buildInstallerSetupCommand(
  setup: InstallerSetupPayload,
  options: { nonInteractive: boolean; includeSecrets: boolean },
) {
  const args = ["onboard"];

  if (options.nonInteractive) {
    args.push("--non-interactive", "--accept-risk", "--json");
  }

  args.push("--flow", setup.flow, "--mode", setup.mode);

  if (setup.existingConfig === "reset") {
    args.push("--reset", "--reset-scope", setup.resetScope);
  }

  if (setup.mode === "local") {
    appendOption(args, "--workspace", setup.workspace.trim());
    appendOption(args, "--gateway-bind", setup.gatewayBind);
    appendOption(args, "--gateway-port", setup.gatewayPort);
    appendOption(args, "--gateway-auth", setup.gatewayAuth);
    appendOption(args, "--tailscale", setup.tailscale);
    appendOption(args, "--secret-input-mode", setup.secretInputMode);

    if (setup.gatewayAuth === "token") {
      appendOption(args, "--gateway-token", setup.gatewayToken.trim());
    } else {
      appendOption(args, "--gateway-password", setup.gatewayPassword.trim());
    }

    args.push(setup.installDaemon ? "--install-daemon" : "--no-install-daemon");
    appendOption(args, "--node-manager", setup.nodeManager);

    if (setup.skipSkills) {
      args.push("--skip-skills");
    }
    if (setup.skipChannels) {
      args.push("--skip-channels");
    }
    if (setup.skipHealth) {
      args.push("--skip-health");
    }
  } else {
    appendOption(args, "--remote-url", setup.remoteUrl.trim());
    appendOption(args, "--remote-token", setup.remoteToken.trim());
    args.push("--skip-daemon");
  }

  appendOption(args, "--auth-choice", setup.authChoice);

  const authFlag = authFlagForChoice(setup.authChoice);
  const authValue = authValueForChoice(setup).trim();
  if (options.includeSecrets) {
    appendOption(args, authFlag || "", authValue);
  }

  if (setup.authChoice === "custom-api-key") {
    appendOption(args, "--custom-base-url", setup.customBaseUrl.trim());
    appendOption(args, "--custom-model-id", setup.customModelId.trim());
    appendOption(args, "--custom-provider-id", setup.customProviderId.trim());
    appendOption(args, "--custom-compatibility", setup.customCompatibility);
  }

  return args.filter(Boolean);
}

export function mergeInstallerSetupIntoConfig(root: Record<string, unknown>, setup: InstallerSetupPayload) {
  setRecordValue(root, ["agents", "defaults", "workspace"], setup.workspace.trim());

  if (setup.repoRoot.trim()) {
    setRecordValue(root, ["agents", "defaults", "repoRoot"], setup.repoRoot.trim());
  } else {
    deleteRecordValue(root, ["agents", "defaults", "repoRoot"]);
  }

  if (setup.skipBootstrap) {
    setRecordValue(root, ["agents", "defaults", "skipBootstrap"], true);
  } else {
    deleteRecordValue(root, ["agents", "defaults", "skipBootstrap"]);
  }

  setRecordValue(root, ["tools", "profile"], setup.toolProfile);
  setRecordValue(root, ["session", "dmScope"], setup.dmScope);

  if (setup.mode === "local") {
    setRecordValue(root, ["gateway", "mode"], "local");
    setRecordValue(root, ["gateway", "port"], setup.gatewayPort);
    if (setup.gatewayBind === "loopback") {
      setRecordValue(root, ["gateway", "bind"], "127.0.0.1");
    }
    if (setup.gatewayBind === "lan") {
      setRecordValue(root, ["gateway", "bind"], "0.0.0.0");
    }
    setRecordValue(root, ["gateway", "auth", "mode"], setup.gatewayAuth);
    if (setup.gatewayAuth === "token" && setup.gatewayToken.trim()) {
      setRecordValue(root, ["gateway", "auth", "token"], setup.gatewayToken.trim());
      deleteRecordValue(root, ["gateway", "auth", "password"]);
    }
    if (setup.gatewayAuth === "password" && setup.gatewayPassword.trim()) {
      setRecordValue(root, ["gateway", "auth", "password"], setup.gatewayPassword.trim());
      deleteRecordValue(root, ["gateway", "auth", "token"]);
    }
  } else {
    setRecordValue(root, ["gateway", "mode"], "remote");
    if (setup.remoteUrl.trim()) {
      setRecordValue(root, ["gateway", "remote", "url"], setup.remoteUrl.trim());
    }
    if (setup.remoteToken.trim()) {
      setRecordValue(root, ["gateway", "remote", "token"], setup.remoteToken.trim());
    }
  }

  if (setup.searchProvider === "none") {
    deleteRecordValue(root, ["tools", "web", "search"]);
  } else {
    setRecordValue(root, ["tools", "web", "search", "provider"], setup.searchProvider);
    if (setup.searchApiKey.trim()) {
      setRecordValue(root, ["tools", "web", "search", "apiKey"], setup.searchApiKey.trim());
    }
  }

  if (setup.telegramEnabled) {
    const allowFrom = splitAllowFrom(setup.telegramAllowFrom);
    setRecordValue(root, ["channels", "telegram", "enabled"], true);
    setRecordValue(root, ["channels", "telegram", "botToken"], setup.telegramBotToken.trim());
    setRecordValue(root, ["channels", "telegram", "dmPolicy"], setup.telegramDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "telegram", "allowFrom"], allowFrom);
    }
  }

  if (setup.discordEnabled) {
    const allowFrom = splitAllowFrom(setup.discordAllowFrom);
    setRecordValue(root, ["channels", "discord", "enabled"], true);
    setRecordValue(root, ["channels", "discord", "token"], setup.discordToken.trim());
    setRecordValue(root, ["channels", "discord", "dmPolicy"], setup.discordDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "discord", "allowFrom"], allowFrom);
    }
  }

  if (setup.whatsappEnabled) {
    const allowFrom = splitAllowFrom(setup.whatsappAllowFrom);
    const groupAllowFrom = splitAllowFrom(setup.whatsappGroupAllowFrom);
    setRecordValue(root, ["channels", "whatsapp", "enabled"], true);
    setRecordValue(root, ["channels", "whatsapp", "dmPolicy"], setup.whatsappDmPolicy);
    setRecordValue(root, ["channels", "whatsapp", "groupPolicy"], setup.whatsappGroupPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "whatsapp", "allowFrom"], allowFrom);
    }
    if (groupAllowFrom.length > 0) {
      setRecordValue(root, ["channels", "whatsapp", "groupAllowFrom"], groupAllowFrom);
    }
  }

  if (setup.googlechatEnabled) {
    const allowFrom = splitAllowFrom(setup.googlechatAllowFrom);
    setRecordValue(root, ["channels", "googlechat", "serviceAccountFile"], setup.googlechatServiceAccountFile.trim());
    setRecordValue(root, ["channels", "googlechat", "auth", "audienceType"], setup.googlechatAudienceType);
    if (setup.googlechatAudience.trim()) {
      setRecordValue(root, ["channels", "googlechat", "auth", "audience"], setup.googlechatAudience.trim());
    }
    if (setup.googlechatWebhookPath.trim()) {
      setRecordValue(root, ["channels", "googlechat", "webhookPath"], setup.googlechatWebhookPath.trim());
    }
    if (setup.googlechatBotUser.trim()) {
      setRecordValue(root, ["channels", "googlechat", "botUser"], setup.googlechatBotUser.trim());
    }
    setRecordValue(root, ["channels", "googlechat", "dm", "policy"], setup.googlechatDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "googlechat", "dm", "allowFrom"], allowFrom);
    }
    setPluginEnabled(root, "googlechat");
  }

  if (setup.mattermostEnabled) {
    const prefixes = splitAllowFrom(setup.mattermostOncharPrefixes);
    setRecordValue(root, ["channels", "mattermost", "enabled"], true);
    setRecordValue(root, ["channels", "mattermost", "baseUrl"], setup.mattermostBaseUrl.trim());
    setRecordValue(root, ["channels", "mattermost", "botToken"], setup.mattermostBotToken.trim());
    setRecordValue(root, ["channels", "mattermost", "dmPolicy"], setup.mattermostDmPolicy);
    setRecordValue(root, ["channels", "mattermost", "chatmode"], setup.mattermostChatmode);
    if (prefixes.length > 0) {
      setRecordValue(root, ["channels", "mattermost", "oncharPrefixes"], prefixes);
    }
    setPluginEnabled(root, "mattermost");
  }

  if (setup.signalEnabled) {
    const allowFrom = splitAllowFrom(setup.signalAllowFrom);
    setRecordValue(root, ["channels", "signal", "enabled"], true);
    setRecordValue(root, ["channels", "signal", "account"], setup.signalAccount.trim());
    if (setup.signalCliPath.trim()) {
      setRecordValue(root, ["channels", "signal", "cliPath"], setup.signalCliPath.trim());
    }
    setRecordValue(root, ["channels", "signal", "dmPolicy"], setup.signalDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "signal", "allowFrom"], allowFrom);
    }
  }

  if (setup.bluebubblesEnabled) {
    const allowFrom = splitAllowFrom(setup.bluebubblesAllowFrom);
    setRecordValue(root, ["channels", "bluebubbles", "enabled"], true);
    setRecordValue(root, ["channels", "bluebubbles", "serverUrl"], setup.bluebubblesServerUrl.trim());
    setRecordValue(root, ["channels", "bluebubbles", "password"], setup.bluebubblesPassword.trim());
    if (setup.bluebubblesWebhookPath.trim()) {
      setRecordValue(root, ["channels", "bluebubbles", "webhookPath"], setup.bluebubblesWebhookPath.trim());
    }
    setRecordValue(root, ["channels", "bluebubbles", "dmPolicy"], setup.bluebubblesDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "bluebubbles", "allowFrom"], allowFrom);
    }
    setPluginEnabled(root, "bluebubbles");
  }

  if (setup.imessageEnabled) {
    const allowFrom = splitAllowFrom(setup.imessageAllowFrom);
    setRecordValue(root, ["channels", "imessage", "enabled"], true);
    setRecordValue(root, ["channels", "imessage", "cliPath"], setup.imessageCliPath.trim());
    if (setup.imessageDbPath.trim()) {
      setRecordValue(root, ["channels", "imessage", "dbPath"], setup.imessageDbPath.trim());
    }
    if (setup.imessageRemoteHost.trim()) {
      setRecordValue(root, ["channels", "imessage", "remoteHost"], setup.imessageRemoteHost.trim());
    }
    setRecordValue(root, ["channels", "imessage", "dmPolicy"], setup.imessageDmPolicy);
    if (allowFrom.length > 0) {
      setRecordValue(root, ["channels", "imessage", "allowFrom"], allowFrom);
    }
    setPluginEnabled(root, "imessage");
  }

  setRecordValue(root, ["skills", "install", "nodeManager"], setup.nodeManager);
}

export function pluginIdsForInstallerSetup(setup: InstallerSetupPayload) {
  return [
    setup.telegramEnabled && "telegram",
    setup.discordEnabled && "discord",
    setup.whatsappEnabled && "whatsapp",
    setup.googlechatEnabled && "googlechat",
    setup.mattermostEnabled && "mattermost",
    setup.signalEnabled && "signal",
    setup.bluebubblesEnabled && "bluebubbles",
    setup.imessageEnabled && "imessage",
  ].filter((value): value is string => Boolean(value));
}

export function channelPolicyLabel(policy: InstallerChannelDmPolicy) {
  if (policy === "allowlist") {
    return "仅 allowlist";
  }
  if (policy === "open") {
    return "所有 DM";
  }
  return "首次配对";
}
