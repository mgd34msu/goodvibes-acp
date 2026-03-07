/**
 * @module plugins/agents/types
 * @layer L3 — plugin
 *
 * Agent type configurations — predefined descriptions and default settings
 * for each AgentType role in the GoodVibes ACP runtime.
 */

import type { AgentType } from '../../types/agent.js';

// ---------------------------------------------------------------------------
// Agent type configuration
// ---------------------------------------------------------------------------

/** Static configuration for a given agent type */
export type AgentTypeConfig = {
  /** The agent type this config applies to */
  type: AgentType;
  /** Human-readable description of this agent role */
  description: string;
  /** Default model identifier */
  defaultModel: string;
  /** System prompt prefix injected before the task */
  systemPromptPrefix: string;
  /** Default timeout in milliseconds */
  defaultTimeoutMs: number;
  /** Maximum number of agentic turns before the loop is forced to stop */
  maxTurns: number;
};

// ---------------------------------------------------------------------------
// Type config registry
// ---------------------------------------------------------------------------

export const AGENT_TYPE_CONFIGS: Record<AgentType, AgentTypeConfig> = {
  engineer: {
    type: 'engineer',
    description: 'Full-stack engineer — implements features, writes code, and modifies files',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are a full-stack engineer. Implement the requested task completely and correctly, following existing patterns in the codebase.',
    defaultTimeoutMs: 300_000,
    maxTurns: 50,
  },
  reviewer: {
    type: 'reviewer',
    description: 'Code review specialist — evaluates implementation quality and provides scored feedback',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are a code review specialist. Evaluate the implementation thoroughly across correctness, style, security, and maintainability. Provide a scored review.',
    defaultTimeoutMs: 180_000,
    maxTurns: 10,
  },
  tester: {
    type: 'tester',
    description: 'Testing specialist — writes and runs tests to verify correctness',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are a testing specialist. Write comprehensive tests covering the happy path, edge cases, and error conditions.',
    defaultTimeoutMs: 300_000,
    maxTurns: 30,
  },
  architect: {
    type: 'architect',
    description: 'Architecture specialist — designs systems, schemas, and high-level structures',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are an architecture specialist. Design clean, scalable, and maintainable solutions with clear rationale for each decision.',
    defaultTimeoutMs: 120_000,
    maxTurns: 15,
  },
  deployer: {
    type: 'deployer',
    description: 'Deployment specialist — manages CI/CD, infrastructure, and release processes',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are a deployment specialist. Configure and execute deployment pipelines safely, verifying each step before proceeding.',
    defaultTimeoutMs: 300_000,
    maxTurns: 25,
  },
  integrator: {
    type: 'integrator',
    description: 'Integration specialist — connects services, APIs, and external systems',
    defaultModel: 'claude-sonnet-4-6',
    systemPromptPrefix:
      'You are an integration specialist. Wire together services and APIs reliably, handling authentication, error recovery, and data mapping.',
    defaultTimeoutMs: 300_000,
    maxTurns: 30,
  },
};
