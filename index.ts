/**
 * index.ts — ACP agent entry point
 *
 * Delegates to src/main.ts which contains the full ACP composition root:
 * - Creates AgentSideConnection over stdio (subprocess mode) or TCP (daemon mode)
 * - Wires L0 types → L1 core → L2 extensions → L3 plugins
 * - Handles initialize, session/new, session/prompt, and graceful shutdown
 */
import './src/main.js';
