import type { CodexAgentModel, CodexAgentStatus } from '../../shared/codex-agent';
import type { CopilotAgentModel, CopilotAgentStatus } from '../../shared/copilot-agent';
import { loadAgentModelPref, saveAgentModelPref } from '../persist/sessionPrefs';
import {
  LLM_PROVIDER_PRESETS,
  defaultModelForProvider,
  llmProviderConfigNames,
  type LlmProvider,
  type OpenAiApiMode,
} from '../../shared/llm-providers';
import {
  MODEL_CAPABILITY_OVERRIDES_KEY,
  parseModelCapabilityOverrides,
  resolveModelCapabilities,
  type ModelCapabilities,
  type ModelCapabilityOverride,
  type ModelIdentity,
} from '../../shared/model-capabilities';
import { setLlmConfig } from './providerConfig';

interface KeyStateLike {
  readonly configured: boolean;
}

export interface AgentModelChoice {
  readonly id: string;
  readonly backend: 'api' | 'codex' | 'copilot';
  readonly provider: LlmProvider;
  readonly providerLabel: string;
  readonly model: string;
  readonly requestModel?: string;
  readonly openAiApiMode?: OpenAiApiMode;
  readonly reasoningEffort?: string;
  readonly capabilities: ModelCapabilities;
}

export interface AgentModelSnapshot {
  readonly choices: readonly AgentModelChoice[];
  readonly activeId: string;
  readonly loaded: boolean;
}

let snapshot: AgentModelSnapshot = { choices: [], activeId: '', loaded: false };
let capabilityOverrides: readonly ModelCapabilityOverride[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(
  choices: readonly AgentModelChoice[],
  activeId: string,
  loaded = snapshot.loaded,
): void {
  snapshot = { choices, activeId, loaded };
  const active = choices.find((choice) => choice.id === activeId);
  if (active) setLlmConfig('gemini', active.model);
  emit();
}

function safeOverrides(raw: unknown): readonly ModelCapabilityOverride[] {
  try {
    return parseModelCapabilityOverrides(raw);
  } catch {
    return [];
  }
}

function geminiChoice(
  keys: Record<string, KeyStateLike>,
  models: Record<string, string>,
): AgentModelChoice | null {
  const preset = LLM_PROVIDER_PRESETS.find((candidate) => candidate.id === 'gemini');
  if (!preset) return null;

  const names = llmProviderConfigNames('gemini');
  if (!keys[names.apiKey]?.configured) return null;

  const model = models[names.model]?.trim() || defaultModelForProvider('gemini');
  const identity: ModelIdentity = { backend: 'api', provider: 'gemini', modelId: model };

  return {
    id: `gemini:${model}`,
    backend: 'api',
    provider: 'gemini',
    providerLabel: 'Google · Gemini',
    model,
    capabilities: resolveModelCapabilities(identity, capabilityOverrides),
  };
}

export function applyAgentModelStatus(
  keys: Record<string, KeyStateLike>,
  models: Record<string, string>,
): void {
  capabilityOverrides = safeOverrides(models[MODEL_CAPABILITY_OVERRIDES_KEY]);
  const choice = geminiChoice(keys, models);
  const choices: readonly AgentModelChoice[] = choice ? [choice] : [];
  const preferred = loadAgentModelPref();
  const activeId = choices.some((candidate) => candidate.id === preferred)
    ? preferred
    : choice?.id ?? '';
  commit(choices, activeId, true);
}

/**
 * MiniCut intentionally ignores Codex status because the built-in Agent is
 * Gemini-only. The function remains exported so upstream callers stay source
 * compatible.
 */
export function applyCodexAgentStatus(
  _status: CodexAgentStatus,
  _savedModel?: string,
  _savedReasoningEffort?: string,
  _discoveredModels?: readonly CodexAgentModel[],
): void {
  // Gemini-only by design.
}

/**
 * MiniCut intentionally ignores Copilot status because the built-in Agent is
 * Gemini-only. The function remains exported so upstream callers stay source
 * compatible.
 */
export function applyCopilotAgentStatus(
  _status: CopilotAgentStatus,
  _savedModel?: string,
  _savedReasoningEffort?: string,
  _discoveredModels?: readonly CopilotAgentModel[],
): void {
  // Gemini-only by design.
}

export function getAgentModelSnapshot(): AgentModelSnapshot {
  return snapshot;
}

export function subscribeAgentModels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAgentModelReady(state: AgentModelSnapshot = snapshot): boolean {
  return state.loaded
    && Boolean(state.activeId)
    && state.choices.some((choice) => choice.id === state.activeId);
}

export function getActiveAgentModelChoice(): AgentModelChoice | undefined {
  return snapshot.choices.find((choice) => choice.id === snapshot.activeId);
}

export function selectAgentModel(id: string): void {
  const choice = snapshot.choices.find((candidate) => candidate.id === id);
  if (!choice || choice.provider !== 'gemini') return;
  commit(snapshot.choices, choice.id);
  saveAgentModelPref(choice.id);
}
