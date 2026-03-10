import { useEffect, useMemo, useState } from "react";
import type { ConfigState, InstallerChannelDmPolicy, InstallerSetupPayload } from "../../../main/types";
import type { IntentControls } from "../../app/model";
import IntentButton from "../../shared/IntentButton";
import StatusBadge from "../../shared/StatusBadge";

interface StepConfigPanelProps {
  configState: ConfigState;
  setup: InstallerSetupPayload;
  setSetup: (next: InstallerSetupPayload) => void;
  controls: IntentControls;
}

interface ToggleCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

type ConfigSubstepId = "core" | "integrations" | "review";

const configSubsteps: Array<{ id: ConfigSubstepId; label: string; title: string; description: string }> = [
  {
    id: "core",
    label: "1",
    title: "核心设置",
    description: "先决定模式、工作区、Gateway 和认证。",
  },
  {
    id: "integrations",
    label: "2",
    title: "集成与运行",
    description: "只开启这次真的需要的搜索、渠道和运行方式。",
  },
  {
    id: "review",
    label: "3",
    title: "确认写入",
    description: "确认摘要，然后一键写入 OpenClaw。",
  },
];

function updateSetup(
  setup: InstallerSetupPayload,
  setSetup: (next: InstallerSetupPayload) => void,
  patch: Partial<InstallerSetupPayload>,
) {
  setSetup({
    ...setup,
    ...patch,
  });
}

function ToggleCard({ title, description, enabled, onChange }: ToggleCardProps) {
  return (
    <label className={`toggle-card${enabled ? " toggle-card-active" : ""}`}>
      <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <StatusBadge tone={enabled ? "ready" : "neutral"}>{enabled ? "已启用" : "未启用"}</StatusBadge>
    </label>
  );
}

function PolicyOptions() {
  return (
    <>
      <option value="pairing">pairing</option>
      <option value="allowlist">allowlist</option>
      <option value="open">open</option>
    </>
  );
}

function DmPolicySelect(props: {
  value: InstallerChannelDmPolicy;
  onChange: (next: InstallerChannelDmPolicy) => void;
}) {
  return (
    <select value={props.value} onChange={(event) => props.onChange(event.target.value as InstallerChannelDmPolicy)}>
      <PolicyOptions />
    </select>
  );
}

function joinSummary(items: string[]) {
  return items.length > 0 ? items.join(" / ") : "未启用";
}

export default function StepConfigPanel({ configState, setup, setSetup, controls }: StepConfigPanelProps) {
  const [substep, setSubstep] = useState<ConfigSubstepId>("core");
  const codexConfigured = configState.summary.openaiCodexConfigured === true;
  const codexAuthenticated = configState.summary.openaiCodexAuthenticated === true;

  const selectedChannels = useMemo(
    () =>
      [
        setup.telegramEnabled && "Telegram",
        setup.discordEnabled && "Discord",
        setup.whatsappEnabled && "WhatsApp",
        setup.googlechatEnabled && "Google Chat",
        setup.mattermostEnabled && "Mattermost",
        setup.signalEnabled && "Signal",
        setup.bluebubblesEnabled && "BlueBubbles",
        setup.imessageEnabled && "iMessage",
      ].filter(Boolean) as string[],
    [
      setup.telegramEnabled,
      setup.discordEnabled,
      setup.whatsappEnabled,
      setup.googlechatEnabled,
      setup.mattermostEnabled,
      setup.signalEnabled,
      setup.bluebubblesEnabled,
      setup.imessageEnabled,
    ],
  );

  const coreIssues = useMemo(() => {
    const issues: string[] = [];

    if (setup.mode === "local" && !setup.workspace.trim()) {
      issues.push("workspace 还没填。");
    }

    if (setup.mode === "remote" && !setup.remoteUrl.trim()) {
      issues.push("Remote 模式还没填远程 Gateway URL。");
    }

    if (
      setup.authChoice !== "skip" &&
      setup.authChoice !== "setup-token" &&
      setup.authChoice !== "oauth" &&
      setup.authChoice !== "openai-codex" &&
      setup.authChoice !== "openai-api-key" &&
      setup.authChoice !== "anthropic-api-key" &&
      setup.authChoice !== "gemini-api-key" &&
      setup.authChoice !== "xai-api-key" &&
      setup.authChoice !== "moonshot-api-key" &&
      setup.authChoice !== "kimi-code-api-key" &&
      setup.authChoice !== "custom-api-key"
    ) {
      issues.push("认证方式当前不受支持。");
    }

    if (setup.authChoice === "openai-api-key" && !setup.openaiApiKey.trim()) {
      issues.push("OpenAI API key 还没填。");
    }
    if (setup.authChoice === "anthropic-api-key" && !setup.anthropicApiKey.trim()) {
      issues.push("Anthropic API key 还没填。");
    }
    if (setup.authChoice === "gemini-api-key" && !setup.geminiApiKey.trim()) {
      issues.push("Gemini API key 还没填。");
    }
    if (setup.authChoice === "xai-api-key" && !setup.xaiApiKey.trim()) {
      issues.push("xAI API key 还没填。");
    }
    if (setup.authChoice === "moonshot-api-key" && !setup.moonshotApiKey.trim()) {
      issues.push("Moonshot API key 还没填。");
    }
    if (setup.authChoice === "kimi-code-api-key" && !setup.kimiCodeApiKey.trim()) {
      issues.push("Kimi Coding API key 还没填。");
    }
    if (setup.authChoice === "custom-api-key") {
      if (!setup.customApiKey.trim()) {
        issues.push("Custom API key 还没填。");
      }
      if (!setup.customBaseUrl.trim()) {
        issues.push("Custom base URL 还没填。");
      }
      if (!setup.customModelId.trim()) {
        issues.push("Custom model ID 还没填。");
      }
    }

    return issues;
  }, [
    setup.mode,
    setup.workspace,
    setup.remoteUrl,
    setup.authChoice,
    setup.openaiApiKey,
    setup.anthropicApiKey,
    setup.geminiApiKey,
    setup.xaiApiKey,
    setup.moonshotApiKey,
    setup.kimiCodeApiKey,
    setup.customApiKey,
    setup.customBaseUrl,
    setup.customModelId,
  ]);

  useEffect(() => {
    if (substep === "review" && coreIssues.length > 0) {
      setSubstep("core");
    }
  }, [coreIssues.length, substep]);

  const currentIndex = configSubsteps.findIndex((item) => item.id === substep);
  const currentSubstep = configSubsteps[currentIndex];

  function jumpToSubstep(next: ConfigSubstepId) {
    if (next === "review" && coreIssues.length > 0) {
      setSubstep("core");
      return;
    }

    setSubstep(next);
  }

  function goPrev() {
    setSubstep(configSubsteps[Math.max(0, currentIndex - 1)].id);
  }

  function goNext() {
    if (substep === "core" && coreIssues.length > 0) {
      return;
    }

    setSubstep(configSubsteps[Math.min(configSubsteps.length - 1, currentIndex + 1)].id);
  }

  return (
    <div className="config-panel-shell wizard-setup-shell">
      <div className="wizard-notice">
        <strong>这一步会写入首次使用真正需要的配置</strong>
        <p>
          写入目标是 {configState.path}。先完成核心设置，再决定这次要不要启用搜索、渠道和 daemon。
        </p>
      </div>

      <div className="wizard-copy-shell">
        <p className="section-eyebrow">Substeps</p>
        <h3>{currentSubstep.title}</h3>
        <p className="wizard-copy">{currentSubstep.description}</p>
      </div>

        <div className="mini-steps">
          {configSubsteps.map((item, index) => {
            const active = item.id === substep;
            const reachable = index <= 1 || coreIssues.length === 0;
            return (
              <button
                key={item.id}
                className={`mini-step${active ? " mini-step-active" : ""}`}
                onClick={() => jumpToSubstep(item.id)}
                disabled={!reachable}
              >
                <span className="mini-step-label">{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </button>
            );
          })}
        </div>

        {substep === "core" ? (
          <div className="wizard-step-shell">
            {coreIssues.length > 0 ? (
              <div className="inline-warning">
                <strong>先把核心设置补齐</strong>
                <p>{coreIssues.join(" ")}</p>
              </div>
            ) : (
              <div className="message-inline">
                <strong>核心设置已经可写入</strong>
                <p>下一步你只需要决定要不要加搜索和渠道，不必一次填完所有集成。</p>
              </div>
            )}

            <div className="wizard-core-grid">
              <article className="subform-card">
                <div className="subform-header">
                  <strong>入口策略</strong>
                  <StatusBadge tone="active">必填</StatusBadge>
                </div>
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>现有配置</span>
                    <select
                      value={setup.existingConfig}
                      onChange={(event) =>
                        updateSetup(setup, setSetup, { existingConfig: event.target.value as InstallerSetupPayload["existingConfig"] })
                      }
                    >
                      <option value="keep">Keep</option>
                      <option value="modify">Modify</option>
                      <option value="reset">Reset</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>向导流</span>
                    <select value={setup.flow} onChange={(event) => updateSetup(setup, setSetup, { flow: event.target.value as InstallerSetupPayload["flow"] })}>
                      <option value="quickstart">QuickStart</option>
                      <option value="advanced">Advanced</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>模式</span>
                    <select value={setup.mode} onChange={(event) => updateSetup(setup, setSetup, { mode: event.target.value as InstallerSetupPayload["mode"] })}>
                      <option value="local">Local</option>
                      <option value="remote">Remote</option>
                    </select>
                  </label>
                  {setup.existingConfig === "reset" ? (
                    <label className="form-field">
                      <span>Reset 范围</span>
                      <select
                        value={setup.resetScope}
                        onChange={(event) => updateSetup(setup, setSetup, { resetScope: event.target.value as InstallerSetupPayload["resetScope"] })}
                      >
                        <option value="config">config</option>
                        <option value="config+creds+sessions">config + creds + sessions</option>
                        <option value="full">full</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </article>

              <article className="subform-card">
                <div className="subform-header">
                  <strong>工作区与默认项</strong>
                  <StatusBadge tone="active">必填</StatusBadge>
                </div>
                <div className="compact-form-grid">
                  <label className="form-field form-field-wide">
                    <span>workspace</span>
                    <input type="text" value={setup.workspace} onChange={(event) => updateSetup(setup, setSetup, { workspace: event.target.value })} />
                  </label>
                  <label className="form-field form-field-wide">
                    <span>repoRoot</span>
                    <input type="text" value={setup.repoRoot} onChange={(event) => updateSetup(setup, setSetup, { repoRoot: event.target.value })} placeholder="可选" />
                  </label>
                  <label className="form-field">
                    <span>tools.profile</span>
                    <select
                      value={setup.toolProfile}
                      onChange={(event) => updateSetup(setup, setSetup, { toolProfile: event.target.value as InstallerSetupPayload["toolProfile"] })}
                    >
                      <option value="coding">coding</option>
                      <option value="general">general</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>dmScope</span>
                    <select value={setup.dmScope} onChange={(event) => updateSetup(setup, setSetup, { dmScope: event.target.value as InstallerSetupPayload["dmScope"] })}>
                      <option value="main">main</option>
                      <option value="per-channel-peer">per-channel-peer</option>
                      <option value="per-account-channel-peer">per-account-channel-peer</option>
                    </select>
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={setup.skipBootstrap} onChange={(event) => updateSetup(setup, setSetup, { skipBootstrap: event.target.checked })} />
                    <span>跳过 bootstrap 文件</span>
                  </label>
                </div>
              </article>

              {setup.mode === "local" ? (
                <article className="subform-card">
                  <div className="subform-header">
                    <strong>本地 Gateway</strong>
                    <StatusBadge tone="active">必填</StatusBadge>
                  </div>
                  <div className="compact-form-grid">
                    <label className="form-field">
                      <span>bind</span>
                      <select
                        value={setup.gatewayBind}
                        onChange={(event) => updateSetup(setup, setSetup, { gatewayBind: event.target.value as InstallerSetupPayload["gatewayBind"] })}
                      >
                        <option value="loopback">loopback</option>
                        <option value="lan">lan</option>
                        <option value="tailnet">tailnet</option>
                        <option value="auto">auto</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>port</span>
                      <input type="number" value={setup.gatewayPort} onChange={(event) => updateSetup(setup, setSetup, { gatewayPort: Number(event.target.value || 18789) })} />
                    </label>
                    <label className="form-field">
                      <span>auth</span>
                      <select
                        value={setup.gatewayAuth}
                        onChange={(event) => updateSetup(setup, setSetup, { gatewayAuth: event.target.value as InstallerSetupPayload["gatewayAuth"] })}
                      >
                        <option value="token">token</option>
                        <option value="password">password</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>tailscale</span>
                      <select
                        value={setup.tailscale}
                        onChange={(event) => updateSetup(setup, setSetup, { tailscale: event.target.value as InstallerSetupPayload["tailscale"] })}
                      >
                        <option value="off">off</option>
                        <option value="serve">serve</option>
                        <option value="funnel">funnel</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Secret 保存方式</span>
                      <select
                        value={setup.secretInputMode}
                        onChange={(event) =>
                          updateSetup(setup, setSetup, { secretInputMode: event.target.value as InstallerSetupPayload["secretInputMode"] })
                        }
                      >
                        <option value="plaintext">plaintext</option>
                        <option value="ref">ref</option>
                      </select>
                    </label>
                    {setup.gatewayAuth === "token" ? (
                      <label className="form-field form-field-wide">
                        <span>gateway token</span>
                        <input type="password" value={setup.gatewayToken} onChange={(event) => updateSetup(setup, setSetup, { gatewayToken: event.target.value })} />
                      </label>
                    ) : (
                      <label className="form-field form-field-wide">
                        <span>gateway password</span>
                        <input type="password" value={setup.gatewayPassword} onChange={(event) => updateSetup(setup, setSetup, { gatewayPassword: event.target.value })} />
                      </label>
                    )}
                  </div>
                </article>
              ) : (
                <article className="subform-card">
                  <div className="subform-header">
                    <strong>远程 Gateway</strong>
                    <StatusBadge tone="active">必填</StatusBadge>
                  </div>
                  <div className="compact-form-grid">
                    <label className="form-field form-field-wide">
                      <span>remote URL</span>
                      <input type="text" value={setup.remoteUrl} onChange={(event) => updateSetup(setup, setSetup, { remoteUrl: event.target.value })} placeholder="wss://..." />
                    </label>
                    <label className="form-field form-field-wide">
                      <span>remote token</span>
                      <input type="password" value={setup.remoteToken} onChange={(event) => updateSetup(setup, setSetup, { remoteToken: event.target.value })} placeholder="可选" />
                    </label>
                  </div>
                </article>
              )}

              <article className="subform-card">
                <div className="subform-header">
                  <strong>模型认证</strong>
                  <StatusBadge tone={setup.authChoice === "skip" ? "neutral" : "active"}>{setup.authChoice === "skip" ? "稍后" : "当前已选"}</StatusBadge>
                </div>
                <div className="compact-form-grid">
                  <label className="form-field">
                    <span>auth choice</span>
                    <select
                      value={setup.authChoice}
                      onChange={(event) => updateSetup(setup, setSetup, { authChoice: event.target.value as InstallerSetupPayload["authChoice"] })}
                    >
                      <option value="skip">稍后处理</option>
                      <option value="setup-token">setup-token</option>
                      <option value="oauth">oauth</option>
                      <option value="openai-codex">OpenAI Codex 登录</option>
                      <option value="openai-api-key">OpenAI API key</option>
                      <option value="anthropic-api-key">Anthropic API key</option>
                      <option value="gemini-api-key">Gemini API key</option>
                      <option value="xai-api-key">xAI API key</option>
                      <option value="moonshot-api-key">Moonshot API key</option>
                      <option value="kimi-code-api-key">Kimi Coding API key</option>
                      <option value="custom-api-key">Custom API key</option>
                    </select>
                  </label>
                  {setup.authChoice === "openai-codex" ? (
                    <div className="form-field form-field-wide">
                      <span>OpenAI Codex</span>
                      <div className="message-inline">
                        <strong>使用 ChatGPT / Codex OAuth 登录</strong>
                        <p>
                          {codexAuthenticated
                            ? "当前已经检测到本机 Codex OAuth 凭证。你也可以重新打开登录流程切换账号。"
                            : codexConfigured
                              ? "配置里已经声明 openai-codex，但当前还没检测到本机 OAuth 凭证。"
                              : "点击下面按钮后，会调用官方 `openclaw models auth login --provider openai-codex` 并在系统终端里拉起浏览器登录。"}
                        </p>
                      </div>
                      <div className="intent-row">
                        <IntentButton intent="loginOpenaiCodex" fallbackLabel="开始 Codex 登录" {...controls} />
                        <IntentButton intent="refreshAll" fallbackLabel="重新检测" {...controls} />
                      </div>
                    </div>
                  ) : null}
                  {setup.authChoice === "openai-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>OpenAI API key</span>
                      <input type="password" value={setup.openaiApiKey} onChange={(event) => updateSetup(setup, setSetup, { openaiApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "anthropic-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>Anthropic API key</span>
                      <input type="password" value={setup.anthropicApiKey} onChange={(event) => updateSetup(setup, setSetup, { anthropicApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "gemini-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>Gemini API key</span>
                      <input type="password" value={setup.geminiApiKey} onChange={(event) => updateSetup(setup, setSetup, { geminiApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "xai-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>xAI API key</span>
                      <input type="password" value={setup.xaiApiKey} onChange={(event) => updateSetup(setup, setSetup, { xaiApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "moonshot-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>Moonshot API key</span>
                      <input type="password" value={setup.moonshotApiKey} onChange={(event) => updateSetup(setup, setSetup, { moonshotApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "kimi-code-api-key" ? (
                    <label className="form-field form-field-wide">
                      <span>Kimi Coding API key</span>
                      <input type="password" value={setup.kimiCodeApiKey} onChange={(event) => updateSetup(setup, setSetup, { kimiCodeApiKey: event.target.value })} />
                    </label>
                  ) : null}
                  {setup.authChoice === "custom-api-key" ? (
                    <>
                      <label className="form-field form-field-wide">
                        <span>Custom API key</span>
                        <input type="password" value={setup.customApiKey} onChange={(event) => updateSetup(setup, setSetup, { customApiKey: event.target.value })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>Custom base URL</span>
                        <input type="text" value={setup.customBaseUrl} onChange={(event) => updateSetup(setup, setSetup, { customBaseUrl: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>Custom model ID</span>
                        <input type="text" value={setup.customModelId} onChange={(event) => updateSetup(setup, setSetup, { customModelId: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>Provider ID</span>
                        <input type="text" value={setup.customProviderId} onChange={(event) => updateSetup(setup, setSetup, { customProviderId: event.target.value })} placeholder="可选" />
                      </label>
                      <label className="form-field">
                        <span>兼容模式</span>
                        <select
                          value={setup.customCompatibility}
                          onChange={(event) =>
                            updateSetup(setup, setSetup, { customCompatibility: event.target.value as InstallerSetupPayload["customCompatibility"] })
                          }
                        >
                          <option value="openai">openai</option>
                          <option value="anthropic">anthropic</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {substep === "integrations" ? (
          <div className="wizard-step-shell">
            <div className="message-inline">
              <strong>这里只填这次真的会用到的集成</strong>
              <p>默认不启用任何渠道。你只要勾选本次需要的渠道，写入后 ClawStart 会自动尝试启用对应的 stock plugin。</p>
            </div>

            <div className="subform-card">
              <div className="subform-header">
                <strong>Web Search</strong>
                <StatusBadge tone={setup.searchProvider === "none" ? "neutral" : "ready"}>
                  {setup.searchProvider === "none" ? "未启用" : setup.searchProvider}
                </StatusBadge>
              </div>
              <div className="compact-form-grid">
                <label className="form-field">
                  <span>provider</span>
                  <select value={setup.searchProvider} onChange={(event) => updateSetup(setup, setSetup, { searchProvider: event.target.value as InstallerSetupPayload["searchProvider"] })}>
                    <option value="none">none</option>
                    <option value="brave">Brave</option>
                    <option value="perplexity">Perplexity</option>
                  </select>
                </label>
                {setup.searchProvider !== "none" ? (
                  <label className="form-field form-field-wide">
                    <span>API key</span>
                    <input type="password" value={setup.searchApiKey} onChange={(event) => updateSetup(setup, setSetup, { searchApiKey: event.target.value })} />
                  </label>
                ) : null}
              </div>
            </div>

            <div className="subform-card">
              <div className="subform-header">
                <strong>Channels</strong>
                <label className="checkbox-field inline-checkbox">
                  <input type="checkbox" checked={setup.skipChannels} onChange={(event) => updateSetup(setup, setSetup, { skipChannels: event.target.checked })} />
                  <span>首次安装跳过官方渠道向导</span>
                </label>
              </div>
              <div className="channel-picker-grid">
                <ToggleCard title="Telegram" description="bot token + allowlist" enabled={setup.telegramEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { telegramEnabled: enabled })} />
                <ToggleCard title="Discord" description="bot token + allowlist" enabled={setup.discordEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { discordEnabled: enabled })} />
                <ToggleCard title="WhatsApp" description="配对后走 DM / 群组策略" enabled={setup.whatsappEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { whatsappEnabled: enabled })} />
                <ToggleCard title="Google Chat" description="service account + webhook" enabled={setup.googlechatEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { googlechatEnabled: enabled })} />
                <ToggleCard title="Mattermost" description="plugin 渠道，需 bot token" enabled={setup.mattermostEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { mattermostEnabled: enabled })} />
                <ToggleCard title="Signal" description="signal-cli 账号接入" enabled={setup.signalEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { signalEnabled: enabled })} />
                <ToggleCard title="BlueBubbles" description="plugin 渠道，接入 iMessage 服务器" enabled={setup.bluebubblesEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { bluebubblesEnabled: enabled })} />
                <ToggleCard title="iMessage" description="legacy CLI / sqlite 接入" enabled={setup.imessageEnabled} onChange={(enabled) => updateSetup(setup, setSetup, { imessageEnabled: enabled })} />
              </div>
            </div>

            {selectedChannels.length > 0 ? (
              <div className="stack-fields">
                {setup.telegramEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>Telegram</strong>
                      <StatusBadge tone="ready">已启用</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field form-field-wide">
                        <span>bot token</span>
                        <input type="password" value={setup.telegramBotToken} onChange={(event) => updateSetup(setup, setSetup, { telegramBotToken: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.telegramDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { telegramDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>allowFrom</span>
                        <input type="text" value={setup.telegramAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { telegramAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.discordEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>Discord</strong>
                      <StatusBadge tone="ready">已启用</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field form-field-wide">
                        <span>token</span>
                        <input type="password" value={setup.discordToken} onChange={(event) => updateSetup(setup, setSetup, { discordToken: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.discordDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { discordDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>allowFrom</span>
                        <input type="text" value={setup.discordAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { discordAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.whatsappEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>WhatsApp</strong>
                      <StatusBadge tone="ready">已启用</StatusBadge>
                    </div>
                    <p className="support-copy">WhatsApp 凭证主要还是通过配对产生，这里先落 DM / 群组策略。</p>
                    <div className="compact-form-grid">
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.whatsappDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { whatsappDmPolicy: next })} />
                      </label>
                      <label className="form-field">
                        <span>groupPolicy</span>
                        <select
                          value={setup.whatsappGroupPolicy}
                          onChange={(event) => updateSetup(setup, setSetup, { whatsappGroupPolicy: event.target.value as InstallerSetupPayload["whatsappGroupPolicy"] })}
                        >
                          <option value="allowlist">allowlist</option>
                          <option value="open">open</option>
                          <option value="disabled">disabled</option>
                        </select>
                      </label>
                      <label className="form-field form-field-wide">
                        <span>DM allowFrom</span>
                        <input type="text" value={setup.whatsappAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { whatsappAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>群组 allowFrom</span>
                        <input type="text" value={setup.whatsappGroupAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { whatsappGroupAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.googlechatEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>Google Chat</strong>
                      <StatusBadge tone="warning">插件 / 服务账号</StatusBadge>
                    </div>
                    <p className="support-copy">首次写入只落配置；如果本机没准备好 service account 或 webhook，后续还需要补一次交互向导。</p>
                    <div className="compact-form-grid">
                      <label className="form-field form-field-wide">
                        <span>serviceAccountFile</span>
                        <input type="text" value={setup.googlechatServiceAccountFile} onChange={(event) => updateSetup(setup, setSetup, { googlechatServiceAccountFile: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>audienceType</span>
                        <select
                          value={setup.googlechatAudienceType}
                          onChange={(event) =>
                            updateSetup(setup, setSetup, { googlechatAudienceType: event.target.value as InstallerSetupPayload["googlechatAudienceType"] })
                          }
                        >
                          <option value="app-url">app-url</option>
                          <option value="project-number">project-number</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span>audience</span>
                        <input type="text" value={setup.googlechatAudience} onChange={(event) => updateSetup(setup, setSetup, { googlechatAudience: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>webhookPath</span>
                        <input type="text" value={setup.googlechatWebhookPath} onChange={(event) => updateSetup(setup, setSetup, { googlechatWebhookPath: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>botUser</span>
                        <input type="text" value={setup.googlechatBotUser} onChange={(event) => updateSetup(setup, setSetup, { googlechatBotUser: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>DM policy</span>
                        <DmPolicySelect value={setup.googlechatDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { googlechatDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>DM allowFrom</span>
                        <input type="text" value={setup.googlechatAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { googlechatAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.mattermostEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>Mattermost</strong>
                      <StatusBadge tone="warning">插件渠道</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field">
                        <span>baseUrl</span>
                        <input type="text" value={setup.mattermostBaseUrl} onChange={(event) => updateSetup(setup, setSetup, { mattermostBaseUrl: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>botToken</span>
                        <input type="password" value={setup.mattermostBotToken} onChange={(event) => updateSetup(setup, setSetup, { mattermostBotToken: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.mattermostDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { mattermostDmPolicy: next })} />
                      </label>
                      <label className="form-field">
                        <span>chatmode</span>
                        <select value={setup.mattermostChatmode} onChange={(event) => updateSetup(setup, setSetup, { mattermostChatmode: event.target.value as InstallerSetupPayload["mattermostChatmode"] })}>
                          <option value="oncall">oncall</option>
                          <option value="onmessage">onmessage</option>
                          <option value="onchar">onchar</option>
                        </select>
                      </label>
                      <label className="form-field form-field-wide">
                        <span>oncharPrefixes</span>
                        <input type="text" value={setup.mattermostOncharPrefixes} onChange={(event) => updateSetup(setup, setSetup, { mattermostOncharPrefixes: event.target.value })} placeholder="@claw, !claw" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.signalEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>Signal</strong>
                      <StatusBadge tone="warning">signal-cli</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field">
                        <span>account</span>
                        <input type="text" value={setup.signalAccount} onChange={(event) => updateSetup(setup, setSetup, { signalAccount: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>cliPath</span>
                        <input type="text" value={setup.signalCliPath} onChange={(event) => updateSetup(setup, setSetup, { signalCliPath: event.target.value })} placeholder="可选" />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.signalDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { signalDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>allowFrom</span>
                        <input type="text" value={setup.signalAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { signalAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.bluebubblesEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>BlueBubbles</strong>
                      <StatusBadge tone="warning">服务器接入</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field">
                        <span>serverUrl</span>
                        <input type="text" value={setup.bluebubblesServerUrl} onChange={(event) => updateSetup(setup, setSetup, { bluebubblesServerUrl: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>password</span>
                        <input type="password" value={setup.bluebubblesPassword} onChange={(event) => updateSetup(setup, setSetup, { bluebubblesPassword: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>webhookPath</span>
                        <input type="text" value={setup.bluebubblesWebhookPath} onChange={(event) => updateSetup(setup, setSetup, { bluebubblesWebhookPath: event.target.value })} placeholder="可选" />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.bluebubblesDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { bluebubblesDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>allowFrom</span>
                        <input type="text" value={setup.bluebubblesAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { bluebubblesAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {setup.imessageEnabled ? (
                  <div className="subform-card">
                    <div className="subform-header">
                      <strong>iMessage</strong>
                      <StatusBadge tone="warning">legacy</StatusBadge>
                    </div>
                    <div className="compact-form-grid">
                      <label className="form-field">
                        <span>cliPath</span>
                        <input type="text" value={setup.imessageCliPath} onChange={(event) => updateSetup(setup, setSetup, { imessageCliPath: event.target.value })} />
                      </label>
                      <label className="form-field">
                        <span>dbPath</span>
                        <input type="text" value={setup.imessageDbPath} onChange={(event) => updateSetup(setup, setSetup, { imessageDbPath: event.target.value })} placeholder="可选" />
                      </label>
                      <label className="form-field">
                        <span>remoteHost</span>
                        <input type="text" value={setup.imessageRemoteHost} onChange={(event) => updateSetup(setup, setSetup, { imessageRemoteHost: event.target.value })} placeholder="可选" />
                      </label>
                      <label className="form-field">
                        <span>dmPolicy</span>
                        <DmPolicySelect value={setup.imessageDmPolicy} onChange={(next) => updateSetup(setup, setSetup, { imessageDmPolicy: next })} />
                      </label>
                      <label className="form-field form-field-wide">
                        <span>allowFrom</span>
                        <input type="text" value={setup.imessageAllowFrom} onChange={(event) => updateSetup(setup, setSetup, { imessageAllowFrom: event.target.value })} placeholder="逗号分隔" />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="empty-copy">当前没有启用渠道。你可以直接去下一步确认写入。</p>
            )}

            <div className="subform-card">
              <div className="subform-header">
                <strong>运行方式</strong>
                <StatusBadge tone="active">本轮安装</StatusBadge>
              </div>
              <div className="compact-form-grid runtime-grid">
                <label className="checkbox-field">
                  <input type="checkbox" checked={setup.installDaemon} onChange={(event) => updateSetup(setup, setSetup, { installDaemon: event.target.checked })} />
                  <span>安装 daemon</span>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" checked={setup.skipSkills} onChange={(event) => updateSetup(setup, setSetup, { skipSkills: event.target.checked })} />
                  <span>首次安装跳过 Skills</span>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" checked={setup.skipHealth} onChange={(event) => updateSetup(setup, setSetup, { skipHealth: event.target.checked })} />
                  <span>跳过健康检查</span>
                </label>
                <label className="form-field">
                  <span>node manager</span>
                  <select value={setup.nodeManager} onChange={(event) => updateSetup(setup, setSetup, { nodeManager: event.target.value as InstallerSetupPayload["nodeManager"] })}>
                    <option value="npm">npm</option>
                    <option value="pnpm">pnpm</option>
                    <option value="bun">bun</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {substep === "review" ? (
          <div className="wizard-step-shell">
            <div className="message-inline">
              <strong>确认后就会真正写入</strong>
              <p>这一步会调用官方 `openclaw onboard --non-interactive`，随后补写配置并自动启用已选渠道的 stock plugin。</p>
            </div>

            <div className="fact-grid review-grid">
              <article className="fact-card">
                <span>核心模式</span>
                <strong>{setup.mode === "local" ? "Local" : "Remote"}</strong>
                <p>{setup.flow} / {setup.existingConfig === "reset" ? `reset:${setup.resetScope}` : setup.existingConfig}</p>
              </article>
              <article className="fact-card">
                <span>workspace</span>
                <strong>{setup.workspace || "未填写"}</strong>
                <p>{setup.repoRoot ? `repoRoot: ${setup.repoRoot}` : "repoRoot 未设置"}</p>
              </article>
              <article className="fact-card">
                <span>Gateway</span>
                <strong>{setup.mode === "local" ? `${setup.gatewayBind}:${setup.gatewayPort}` : setup.remoteUrl || "未填写"}</strong>
                <p>{setup.mode === "local" ? `auth: ${setup.gatewayAuth}` : setup.remoteToken ? "带 token 连接" : "无 token"}</p>
              </article>
              <article className="fact-card">
                <span>认证</span>
                <strong>{setup.authChoice}</strong>
                <p>
                  {setup.authChoice === "skip"
                    ? "本轮先不写模型凭证"
                    : setup.authChoice === "openai-codex"
                      ? "会使用 ChatGPT / Codex OAuth 登录"
                      : "会随官方向导一起处理"}
                </p>
              </article>
              <article className="fact-card">
                <span>搜索</span>
                <strong>{setup.searchProvider}</strong>
                <p>{setup.searchProvider === "none" ? "未启用 Web Search" : "写入后可直接在工具里使用"}</p>
              </article>
              <article className="fact-card">
                <span>渠道</span>
                <strong>{joinSummary(selectedChannels)}</strong>
                <p>{selectedChannels.length > 0 ? "写入后会尝试自动启用对应 stock plugin。" : "本轮不启用任何渠道。"}</p>
              </article>
              <article className="fact-card">
                <span>运行方式</span>
                <strong>{setup.installDaemon ? "安装 daemon" : "不装 daemon"}</strong>
                <p>{setup.skipSkills ? "跳过 Skills" : `Skills 使用 ${setup.nodeManager}`}</p>
              </article>
              <article className="fact-card">
                <span>健康检查</span>
                <strong>{setup.skipHealth ? "跳过" : "执行"}</strong>
                <p>{setup.skipChannels ? "跳过官方渠道向导" : "保留渠道设置"}</p>
              </article>
              <article className="fact-card">
                <span>写入目标</span>
                <strong>{configState.path}</strong>
                <p>成功后就可以进入下一步，按需继续交互式 Onboarding。</p>
              </article>
            </div>

            <div className="wizard-primary-actions">
              <IntentButton intent="applyInstallerSetup" fallbackLabel="一键写入 OpenClaw" variant="primary" {...controls} />
              <IntentButton intent="openTerminalOnboarding" fallbackLabel="改用交互式 Onboarding" {...controls} />
              <IntentButton intent="revealConfigPath" fallbackLabel="打开配置位置" {...controls} />
            </div>
          </div>
        ) : null}

        <div className="wizard-nav">
          <button className="ghost-button" onClick={goPrev} disabled={currentIndex === 0}>
            上一步
          </button>
          {substep !== "review" ? (
            <button className="primary-button" onClick={goNext} disabled={substep === "core" && coreIssues.length > 0}>
              {substep === "core" ? "继续到可选集成" : "继续到确认写入"}
            </button>
          ) : (
            <button className="ghost-button" onClick={() => jumpToSubstep("integrations")}>
              返回修改
            </button>
          )}
        </div>
    </div>
  );
}
