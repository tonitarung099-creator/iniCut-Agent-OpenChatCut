import {
  defaultModelForProvider,
  normalizeLlmProvider,
  normalizeOpenAiApiMode,
  requireLlmProvider,
} from '../../shared/llm-providers';
import { resolveLlmProviderConfig } from '../llm-config';
import { getKey, type KeyName } from '../keystore';
import { copilotProviderForModel } from '../../shared/model-capabilities';
import { serverRunBackend, type ServerRunInput } from './executor';
import type { ValidatedCreateInput } from './request';
import { digestValue } from './store-values';
import { resolveServerRunToolCatalog } from './tool-policy';

export function resolveRunExecution(
  body: Record<string, unknown>,
  input: ValidatedCreateInput,
  origin: string,
  askOnly: boolean,
): ServerRunInput {
  // MiniCut is intentionally Gemini-only for Agent execution. Ignore stale
  // provider/backend preferences from older builds so they cannot re-enable
  // Anthropic, OpenAI, Codex, Copilot, or another upstream Agent backend.
  const requestedModel = input.model;
  const backend = 'api' as const;
  const readKey = (name: string): string => getKey(name as KeyName);
  const config = resolveLlmProviderConfig('gemini', readKey);
  const effectiveProvider = 'gemini' as const;
  const effectiveModel = requestedModel.startsWith('gemini-')
    ? requestedModel
    : config.model || defaultModelForProvider('gemini');
  const openAiApiMode = normalizeOpenAiApiMode(body.openAiApiMode);
  const tools = resolveServerRunToolCatalog(input.tools, askOnly);
  return {
    messages: input.messages,
    backend,
    provider: effectiveProvider,
    model: effectiveModel,

    openAiApiMode,
    cacheMode: input.cacheMode,
    maxOutputTokens: input.maxOutputTokens,
    autonomousAcceptance: input.autonomousAcceptance,
    maxAcceptanceIterations: input.maxAcceptanceIterations,
    origin,
    tools,
    instructions: input.instructions,
  };
}

export function runRequestDigests(
  input: ValidatedCreateInput,
  execution: ServerRunInput,
  askOnly: boolean,
  sessionGeneration: string,
): { readonly userInputDigest: string; readonly requestShapeHash: string } {
  const userInputDigest = digestValue(input.messages);
  return {
    userInputDigest,
    requestShapeHash: digestValue({
      projectId: input.projectId,
      sessionGeneration,
      userInputDigest,
      askOnly,
      references: input.references,
      externalSessionId: input.externalSessionId,
      context: input.context,
      provider: execution.provider,
      model: execution.model,
      ...(execution.backend === 'copilot'
        ? { backend: execution.backend, reasoningEffort: execution.reasoningEffort ?? null } : {}),
      openAiApiMode: execution.openAiApiMode,
      cacheMode: execution.cacheMode,
      maxOutputTokens: execution.maxOutputTokens,
      autonomousAcceptance: execution.autonomousAcceptance,
      maxAcceptanceIterations: execution.maxAcceptanceIterations,
      tools: execution.tools,
      instructions: execution.instructions,
    }),
  };
}
