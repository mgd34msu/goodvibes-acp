# Architecture
Source: https://agentclientprotocol.com/get-started/architecture

Overview of the Agent Client Protocol architecture.

The Agent Client Protocol defines a standard interface for communication between AI agents and client applications. The architecture is designed to be flexible, extensible, and platform-agnostic.

## Design Philosophy

The protocol architecture follows several key principles:

1. **MCP-friendly**: The protocol is built on JSON-RPC, and re-uses MCP types where possible so that integrators don't need to build yet-another representation for common data types.
2. **UX-first**: It is designed to solve the UX challenges of interacting with AI agents; ensuring there's enough flexibility to render clearly the agents intent, but is no more abstract than it needs to be.
3. **Trusted**: ACP works when you're using a code editor to talk to a model you trust. You still have controls over the agent's tool calls, but the code editor gives the agent access to local files and MCP servers.

## Setup

When the user tries to connect to an agent, the editor boots the agent sub-process on demand, and all communication happens over stdin/stdout.

Each connection can support several concurrent sessions, so you can have multiple trains of thought going on at once.

<img alt="Server Client setup" />

ACP makes heavy use of JSON-RPC notifications to allow the agent to stream updates to the UI in real-time. It also uses JSON-RPC's bidirectional requests to allow the agent to make requests of the code editor: for example to request permissions for a tool call.

## MCP

Commonly the code editor will have user-configured MCP servers. When forwarding the prompt from the user, it passes configuration for these to the agent. This allows the agent to connect directly to the MCP server.

<img alt="MCP Server connection" />

The code editor may itself also wish to export MCP based tools. Instead of trying to run MCP and ACP on the same socket, the code editor can provide its own MCP server as configuration. As agents may only support MCP over stdio, the code editor can provide a small proxy that tunnels requests back to itself:

<img alt="MCP connection to self" />


# Clients
Source: https://agentclientprotocol.com/get-started/clients

Clients, frameworks, connectors, and related tools around the Agent Client Protocol.

The following projects implement ACP directly, connect ACP agents to other environments, or support adjacent coding-agent workflows.

## Editors and IDEs

* [Chrome ACP](https://github.com/Areo-Joe/chrome-acp) (Chrome extension / PWA)
* Emacs via [agent-shell.el](https://github.com/xenodium/agent-shell)
* [JetBrains](https://www.jetbrains.com/help/ai-assistant/acp.html)
* [neovim](https://neovim.io)
  * through the [CodeCompanion](https://github.com/olimorris/codecompanion.nvim) plugin
  * through the [carlos-algms/agentic.nvim](https://github.com/carlos-algms/agentic.nvim) plugin
  * through the [yetone/avante.nvim](https://github.com/yetone/avante.nvim) plugin
* [Obsidian](https://obsidian.md) — through the [Agent Client](https://github.com/RAIT-09/obsidian-agent-client) plugin
* [Unity Agent Client](https://github.com/nuskey8/UnityAgentClient) (Unity editor)
* Visual Studio Code — through the [ACP Client](https://github.com/formulahendry/vscode-acp) extension
* [Zed](https://zed.dev/docs/ai/external-agents)

## Clients and apps

* [ACP UI](https://github.com/formulahendry/acp-ui)
* [acpx (CLI)](https://github.com/openclaw/acpx)
* [Agent Studio](https://github.com/sxhxliang/agent-studio)
* [AionUi](https://github.com/iOfficeAI/AionUi)
* [aizen](https://aizen.win)
* [DeepChat](https://github.com/ThinkInAIXYZ/deepchat)
* [fabriqa.ai](https://fabriqa.ai)
* [Harnss](https://github.com/OpenSource03/harnss)
* [Minion Mind](https://minion-mind.nebulame.com/) — through the [Agent Client](https://github.com/RAIT-09/obsidian-agent-client) plugin
* [Mitto](https://github.com/inercia/mitto)
* [Nori CLI](https://github.com/tilework-tech/nori-cli)
* [Ngent](https://github.com/beyond5959/ngent)
* [RayClaw](https://github.com/rayclaw/rayclaw?tab=readme-ov-file#acp-agent-client-protocol)
* [RLM Code](https://github.com/SuperagenticAI/rlm-code)
* [Sidequery *(coming soon)*](https://sidequery.dev)
* [Tidewave](https://tidewave.ai/)
* [Toad](https://www.batrachian.ai/)
* [Web Browser with AI SDK](https://github.com/mcpc-tech/ai-elements-remix-template) (powered by [@mcpc/acp-ai-provider](https://github.com/mcpc-tech/mcpc/tree/main/packages/acp-ai-provider))

## Notebook and data tools

* [agent-client-kernel](https://github.com/wiki3-ai/agent-client-kernel) (Jupyter notebooks)
* DuckDB — through the [sidequery/duckdb-acp](https://github.com/sidequery/duckdb-acp) extension
* [marimo notebook](https://github.com/marimo-team/marimo)

## Mobile clients

These mobile-first tools bring ACP and related coding-agent workflows to phones and tablets:

* [Agmente](https://agmente.halliharp.com) ([GitHub](https://github.com/rebornix/Agmente)) (iOS)
* [Happy](https://happy.engineering/) ([GitHub](https://github.com/slopus/happy)) (iOS, Android, Web)

## Messaging

* [Juan](https://github.com/DiscreteTom/juan) (Slack)
* [Telegram ACP Bot](https://github.com/mgaitan/telegram-acp-bot) (Telegram) — through the [`telegram-acp-bot`](https://github.com/mgaitan/telegram-acp-bot) connector

## Frameworks

These frameworks add ACP support through dedicated integrations or adapters:

* [AgentPool](https://phil65.github.io/agentpool/) — with built-in ACP integration for IDEs and external ACP agents
* [fast-agent](https://fast-agent.ai/acp/) — through [`fast-agent-acp`](https://fast-agent.ai/acp/)
* [Koog](https://docs.koog.ai/agent-client-protocol/) — through the [`agents-features-acp`](https://github.com/JetBrains/koog/tree/develop/examples/notebooks/acp) integration
* [LangChain / LangGraph](https://docs.langchain.com/oss/python/deepagents/acp) — through [Deep Agents ACP](https://docs.langchain.com/oss/python/deepagents/acp)
* [LlamaIndex](https://github.com/AstraBert/workflows-acp) — through the [`workflows-acp`](https://github.com/AstraBert/workflows-acp) adapter for Agent Workflows
* [LLMling-Agent](https://github.com/phil65/llmling-agent) — with built-in ACP support for running agents through ACP clients

## Connectors

These connectors bridge ACP into other environments and transport layers:

* [Aptove Bridge](https://github.com/aptove/bridge) — bridges stdio-based ACP agents to the Aptove mobile client over WebSocket
* [OpenClaw](https://docs.openclaw.ai/cli/acp) — through the [`openclaw acp`](https://docs.openclaw.ai/cli/acp) bridge to an OpenClaw Gateway


# Introduction
Source: https://agentclientprotocol.com/get-started/introduction

Get started with the Agent Client Protocol.

The Agent Client Protocol (ACP) standardizes communication between code editors/IDEs and coding agents and is suitable for both local and remote scenarios.

## Why ACP?

AI coding agents and editors are tightly coupled but interoperability isn't the default. Each editor must build custom integrations for every agent they want to support, and agents must implement editor-specific APIs to reach users.
This creates several problems:

* Integration overhead: Every new agent-editor combination requires custom work
* Limited compatibility: Agents work with only a subset of available editors
* Developer lock-in: Choosing an agent often means accepting their available interfaces

ACP solves this by providing a standardized protocol for agent-editor communication, similar to how the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/) standardized language server integration.

Agents that implement ACP work with any compatible editor. Editors that support ACP gain access to the entire ecosystem of ACP-compatible agents.
This decoupling allows both sides to innovate independently while giving developers the freedom to choose the best tools for their workflow.

## Overview

ACP assumes that the user is primarily in their editor, and wants to reach out and use agents to assist them with specific tasks.

ACP is suitable for both local and remote scenarios:

* **Local agents** run as sub-processes of the code editor, communicating via JSON-RPC over stdio.
* **Remote agents** can be hosted in the cloud or on separate infrastructure, communicating over HTTP or WebSocket

<Info>
  Full support for remote agents is a work in progress. We are actively
  collaborating with agentic platforms to ensure the protocol addresses the
  specific requirements of cloud-hosted and remote deployment scenarios.
</Info>

The protocol re-uses the JSON representations used in MCP where possible, but includes custom types for useful agentic coding UX elements, like displaying diffs.

The default format for user-readable text is Markdown, which allows enough flexibility to represent rich formatting without requiring that the code editor is capable of rendering HTML.


# ACP Registry
Source: https://agentclientprotocol.com/get-started/registry

The easiest way to find and install ACP-compatible agents.

## Overview

The ACP Registry is an easy way for developers to distribute their ACP-compatible agents to any client that speaks the protocol.

At the moment, this is a curated set of agents, including only the ones that [support authentication](/rfds/auth-methods).

Visit [the registry repository on GitHub](https://github.com/agentclientprotocol/registry) to learn more about it.

<Warning>
  The registry is under active development, so expect its format and contents to
  change.
</Warning>

## Available Agents

<CardGroup>
  <Card
    title="Amp"
    href="https://github.com/tao12345666333/amp-acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.9197 13.61L17.3816 26.566L14.242 27.4049L11.2645 16.2643L0.119926 13.2906L0.957817 10.15L13.9197 13.61Z"
      fill="currentColor"
    />
    <path
      d="M13.7391 16.0892L4.88169 24.9056L2.58872 22.6019L11.4461 13.7865L13.7391 16.0892Z"
      fill="currentColor"
    />
    <path
      d="M18.9386 8.58315L22.4005 21.5392L19.2609 22.3781L16.2833 11.2374L5.13879 8.26381L5.97668 5.12318L18.9386 8.58315Z"
      fill="currentColor"
    />
    <path
      d="M23.9803 3.55632L27.4422 16.5124L24.3025 17.3512L21.325 6.21062L10.1805 3.23698L11.0183 0.0963593L23.9803 3.55632Z"
      fill="currentColor"
    />
  </svg>
}
  >
    ACP wrapper for Amp - the frontier coding agent

    <p>
      <code>0.7.0</code>
    </p>
  </Card>

  <Card
    title="Auggie CLI"
    href="https://github.com/augmentcode/auggie-zed-extension"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 16"
  >
    <path
      fill="currentColor"
      d="M9.972 13.193h2.577q.187 0 .277-.09t.091-.294V10.47q0-.324.133-.59.135-.27.36-.424a1 1 0 0 1 .099-.06 1 1 0 0 1-.1-.058 1.1 1.1 0 0 1-.359-.424 1.3 1.3 0 0 1-.133-.59v-2.33q0-.202-.091-.293t-.277-.089H9.972a.38.38 0 0 1-.294-.124.4.4 0 0 1-.108-.281q.002-.176.131-.293a.46.46 0 0 1 .313-.111h2.775c.36 0 .642.097.836.288q.293.29.294.832V8.24q0 .39.152.562.148.168.555.178a.4.4 0 0 1 .27.128.41.41 0 0 1 .104.287.44.44 0 0 1-.1.282.34.34 0 0 1-.277.132c-.266.006-.452.066-.55.177q-.151.174-.152.573v2.318c0 .235-.043.44-.128.607a.85.85 0 0 1-.389.387 1.3 1.3 0 0 1-.534.124V14h-2.854a.45.45 0 0 1-.315-.118.38.38 0 0 1-.129-.286q0-.164.109-.282a.38.38 0 0 1 .293-.123zM1.103 9.108a.4.4 0 0 1 .276-.128q.4-.008.55-.177.15-.173.151-.562V5.923q.002-.543.294-.832c.195-.191.477-.288.836-.288h2.775q.188 0 .313.111a.37.37 0 0 1 .131.293.4.4 0 0 1-.108.281.38.38 0 0 1-.293.123H3.45q-.186 0-.277.09t-.092.292v2.33c0 .213-.044.413-.133.59a1.1 1.1 0 0 1-.359.424 1 1 0 0 1-.1.059 1 1 0 0 1 .1.059q.225.156.359.423t.133.59v2.34q0 .203.092.293.088.09.277.089h2.577a.38.38 0 0 1 .294.123q.108.12.108.281a.38.38 0 0 1-.13.286.45.45 0 0 1-.314.118l-2.775-.003a1.4 1.4 0 0 1-.613-.126.87.87 0 0 1-.388-.387 1.34 1.34 0 0 1-.129-.608v-2.318q0-.4-.151-.572-.151-.168-.55-.177a.35.35 0 0 1-.278-.132.42.42 0 0 1-.102-.28q0-.173.103-.287"
    />
    <path
      fill="currentColor"
      d="M5.437 10.36a.986.986 0 0 1-.994-.975c0-.538.446-.976.994-.976s.994.438.994.976a.986.986 0 0 1-.994.976M10.562 8.41c.548 0 .994.437.994.975a.986.986 0 0 1-.994.976.986.986 0 0 1-.994-.976c0-.538.446-.976.994-.976M8.74 2c.37 0 .446.15.446.275v.034q0 .034-.009.201-.01.162-.017.549-.018.378-.044 1.06c0 .106-.065.233-.375.233-.311 0-.376-.126-.376-.23l-.07-1.835v-.003c0-.13.078-.284.446-.284M7.256 2c.369 0 .446.15.446.275v.034q0 .034-.01.201-.007.162-.017.549-.017.378-.043 1.06c0 .106-.065.233-.376.233-.31 0-.375-.126-.375-.23l-.07-1.835v-.003C6.81 2.154 6.887 2 7.256 2"
    />
  </svg>
}
  >
    Augment Code's powerful software agent, backed by industry-leading
    context engine

    <p>
      <code>0.18.1</code>
    </p>
  </Card>

  <Card
    title="Autohand Code"
    href="https://github.com/autohandai/autohand-acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.66949 9.56637C4.66949 8.92122 4.13288 8.39823 3.47094 8.39823C2.809 8.39823 2.2724 8.92122 2.2724 9.56637C2.2724 10.2115 2.809 10.7345 3.47094 10.7345V11C2.65856 11 2 10.3581 2 9.56637C2 8.7746 2.65856 8.13274 3.47094 8.13274C4.28332 8.13274 4.94189 8.7746 4.94189 9.56637C4.94189 10.3581 4.28332 11 3.47094 11V10.7345C4.13288 10.7345 4.66949 10.2115 4.66949 9.56637Z"
      fill="currentColor"
    />
    <path
      d="M3.90678 9.59292C3.90678 9.81286 3.72385 9.99115 3.49818 9.99115C3.27252 9.99115 3.08959 9.81286 3.08959 9.59292C3.08959 9.37298 3.27252 9.19469 3.49818 9.19469C3.72385 9.19469 3.90678 9.37298 3.90678 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M3.8523 9.59292C3.8523 9.40231 3.69376 9.24779 3.49818 9.24779C3.30261 9.24779 3.14407 9.40231 3.14407 9.59292C3.14407 9.78353 3.30261 9.93805 3.49818 9.93805V9.99115C3.27252 9.99115 3.08959 9.81286 3.08959 9.59292C3.08959 9.37298 3.27252 9.19469 3.49818 9.19469C3.72385 9.19469 3.90678 9.37298 3.90678 9.59292C3.90678 9.81286 3.72385 9.99115 3.49818 9.99115V9.93805C3.69376 9.93805 3.8523 9.78353 3.8523 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M4.66949 6.43363C4.66949 5.78848 4.13288 5.26549 3.47094 5.26549C2.809 5.26549 2.2724 5.78848 2.2724 6.43363C2.2724 7.07878 2.809 7.60177 3.47094 7.60177V7.86726C2.65856 7.86726 2 7.2254 2 6.43363C2 5.64186 2.65856 5 3.47094 5C4.28332 5 4.94189 5.64186 4.94189 6.43363C4.94189 7.2254 4.28332 7.86726 3.47094 7.86726V7.60177C4.13288 7.60177 4.66949 7.07878 4.66949 6.43363Z"
      fill="currentColor"
    />
    <path
      d="M3.90678 6.46018C3.90678 6.68011 3.72385 6.85841 3.49818 6.85841C3.27252 6.85841 3.08959 6.68011 3.08959 6.46018C3.08959 6.24024 3.27252 6.06195 3.49818 6.06195C3.72385 6.06195 3.90678 6.24024 3.90678 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M3.8523 6.46018C3.8523 6.26957 3.69376 6.11504 3.49818 6.11504C3.30261 6.11504 3.14407 6.26957 3.14407 6.46018C3.14407 6.65079 3.30261 6.80531 3.49818 6.80531V6.85841C3.27252 6.85841 3.08959 6.68011 3.08959 6.46018C3.08959 6.24024 3.27252 6.06195 3.49818 6.06195C3.72385 6.06195 3.90678 6.24024 3.90678 6.46018C3.90678 6.68011 3.72385 6.85841 3.49818 6.85841V6.80531C3.69376 6.80531 3.8523 6.65079 3.8523 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M8.04722 9.56637C8.04722 8.92122 7.51061 8.39823 6.84867 8.39823C6.18673 8.39823 5.65012 8.92122 5.65012 9.56637C5.65012 10.2115 6.18673 10.7345 6.84867 10.7345V11C6.03629 11 5.37772 10.3581 5.37772 9.56637C5.37772 8.7746 6.03629 8.13274 6.84867 8.13274C7.66105 8.13274 8.31961 8.7746 8.31961 9.56637C8.31961 10.3581 7.66105 11 6.84867 11V10.7345C7.51061 10.7345 8.04722 10.2115 8.04722 9.56637Z"
      fill="currentColor"
    />
    <path
      d="M7.2845 9.59292C7.2845 9.81286 7.10157 9.99115 6.87591 9.99115C6.65025 9.99115 6.46731 9.81286 6.46731 9.59292C6.46731 9.37298 6.65025 9.19469 6.87591 9.19469C7.10157 9.19469 7.2845 9.37298 7.2845 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M7.23002 9.59292C7.23002 9.40231 7.07148 9.24779 6.87591 9.24779C6.68033 9.24779 6.52179 9.40231 6.52179 9.59292C6.52179 9.78353 6.68033 9.93805 6.87591 9.93805V9.99115C6.65025 9.99115 6.46731 9.81286 6.46731 9.59292C6.46731 9.37298 6.65025 9.19469 6.87591 9.19469C7.10157 9.19469 7.2845 9.37298 7.2845 9.59292C7.2845 9.81286 7.10157 9.99115 6.87591 9.99115V9.93805C7.07148 9.93805 7.23002 9.78353 7.23002 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M8.04722 6.43363C8.04722 5.78848 7.51061 5.26549 6.84867 5.26549C6.18673 5.26549 5.65012 5.78848 5.65012 6.43363C5.65012 7.07878 6.18673 7.60177 6.84867 7.60177V7.86726C6.03629 7.86726 5.37772 7.2254 5.37772 6.43363C5.37772 5.64186 6.03629 5 6.84867 5C7.66105 5 8.31961 5.64186 8.31961 6.43363C8.31961 7.2254 7.66105 7.86726 6.84867 7.86726V7.60177C7.51061 7.60177 8.04722 7.07878 8.04722 6.43363Z"
      fill="currentColor"
    />
    <path
      d="M7.2845 6.46018C7.2845 6.68011 7.10157 6.85841 6.87591 6.85841C6.65025 6.85841 6.46731 6.68011 6.46731 6.46018C6.46731 6.24024 6.65025 6.06195 6.87591 6.06195C7.10157 6.06195 7.2845 6.24024 7.2845 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M7.23002 6.46018C7.23002 6.26957 7.07148 6.11504 6.87591 6.11504C6.68033 6.11504 6.52179 6.26957 6.52179 6.46018C6.52179 6.65079 6.68033 6.80531 6.87591 6.80531V6.85841C6.65025 6.85841 6.46731 6.68011 6.46731 6.46018C6.46731 6.24024 6.65025 6.06195 6.87591 6.06195C7.10157 6.06195 7.2845 6.24024 7.2845 6.46018C7.2845 6.68011 7.10157 6.85841 6.87591 6.85841V6.80531C7.07148 6.80531 7.23002 6.65079 7.23002 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M11.207 9.56637C11.207 8.92122 10.6704 8.39823 10.0085 8.39823C9.34653 8.39823 8.80993 8.92122 8.80993 9.56637C8.80993 10.2115 9.34653 10.7345 10.0085 10.7345V11C9.19609 11 8.53753 10.3581 8.53753 9.56637C8.53753 8.7746 9.19609 8.13274 10.0085 8.13274C10.8209 8.13274 11.4794 8.7746 11.4794 9.56637C11.4794 10.3581 10.8209 11 10.0085 11V10.7345C10.6704 10.7345 11.207 10.2115 11.207 9.56637Z"
      fill="currentColor"
    />
    <path
      d="M10.4443 9.59292C10.4443 9.81286 10.2614 9.99115 10.0357 9.99115C9.81005 9.99115 9.62712 9.81286 9.62712 9.59292C9.62712 9.37298 9.81005 9.19469 10.0357 9.19469C10.2614 9.19469 10.4443 9.37298 10.4443 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M10.3898 9.59292C10.3898 9.40231 10.2313 9.24779 10.0357 9.24779C9.84014 9.24779 9.6816 9.40231 9.6816 9.59292C9.6816 9.78353 9.84014 9.93805 10.0357 9.93805V9.99115C9.81005 9.99115 9.62712 9.81286 9.62712 9.59292C9.62712 9.37298 9.81005 9.19469 10.0357 9.19469C10.2614 9.19469 10.4443 9.37298 10.4443 9.59292C10.4443 9.81286 10.2614 9.99115 10.0357 9.99115V9.93805C10.2313 9.93805 10.3898 9.78353 10.3898 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M11.207 6.43363C11.207 5.78848 10.6704 5.26549 10.0085 5.26549C9.34653 5.26549 8.80993 5.78848 8.80993 6.43363C8.80993 7.07878 9.34653 7.60177 10.0085 7.60177V7.86726C9.19609 7.86726 8.53753 7.2254 8.53753 6.43363C8.53753 5.64186 9.19609 5 10.0085 5C10.8209 5 11.4794 5.64186 11.4794 6.43363C11.4794 7.2254 10.8209 7.86726 10.0085 7.86726V7.60177C10.6704 7.60177 11.207 7.07878 11.207 6.43363Z"
      fill="currentColor"
    />
    <path
      d="M10.4443 6.46018C10.4443 6.68011 10.2614 6.85841 10.0357 6.85841C9.81005 6.85841 9.62712 6.68011 9.62712 6.46018C9.62712 6.24024 9.81005 6.06195 10.0357 6.06195C10.2614 6.06195 10.4443 6.24024 10.4443 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M10.3898 6.46018C10.3898 6.26957 10.2313 6.11504 10.0357 6.11504C9.84014 6.11504 9.6816 6.26957 9.6816 6.46018C9.6816 6.65079 9.84014 6.80531 10.0357 6.80531V6.85841C9.81005 6.85841 9.62712 6.68011 9.62712 6.46018C9.62712 6.24024 9.81005 6.06195 10.0357 6.06195C10.2614 6.06195 10.4443 6.24024 10.4443 6.46018C10.4443 6.68011 10.2614 6.85841 10.0357 6.85841V6.80531C10.2313 6.80531 10.3898 6.65079 10.3898 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M14.5847 9.56637C14.5847 8.92122 14.0481 8.39823 13.3862 8.39823C12.7243 8.39823 12.1877 8.92122 12.1877 9.56637C12.1877 10.2115 12.7243 10.7345 13.3862 10.7345V11C12.5738 11 11.9153 10.3581 11.9153 9.56637C11.9153 8.7746 12.5738 8.13274 13.3862 8.13274C14.1986 8.13274 14.8571 8.7746 14.8571 9.56637C14.8571 10.3581 14.1986 11 13.3862 11V10.7345C14.0481 10.7345 14.5847 10.2115 14.5847 9.56637Z"
      fill="currentColor"
    />
    <path
      d="M13.822 9.59292C13.822 9.81286 13.6391 9.99115 13.4134 9.99115C13.1878 9.99115 13.0048 9.81286 13.0048 9.59292C13.0048 9.37298 13.1878 9.19469 13.4134 9.19469C13.6391 9.19469 13.822 9.37298 13.822 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M13.7676 9.59292C13.7676 9.40231 13.609 9.24779 13.4134 9.24779C13.2179 9.24779 13.0593 9.40231 13.0593 9.59292C13.0593 9.78353 13.2179 9.93805 13.4134 9.93805V9.99115C13.1878 9.99115 13.0048 9.81286 13.0048 9.59292C13.0048 9.37298 13.1878 9.19469 13.4134 9.19469C13.6391 9.19469 13.822 9.37298 13.822 9.59292C13.822 9.81286 13.6391 9.99115 13.4134 9.99115V9.93805C13.609 9.93805 13.7676 9.78353 13.7676 9.59292Z"
      fill="currentColor"
    />
    <path
      d="M14.5847 6.43363C14.5847 5.78848 14.0481 5.26549 13.3862 5.26549C12.7243 5.26549 12.1877 5.78848 12.1877 6.43363C12.1877 7.07878 12.7243 7.60177 13.3862 7.60177V7.86726C12.5738 7.86726 11.9153 7.2254 11.9153 6.43363C11.9153 5.64186 12.5738 5 13.3862 5C14.1986 5 14.8571 5.64186 14.8571 6.43363C14.8571 7.2254 14.1986 7.86726 13.3862 7.86726V7.60177C14.0481 7.60177 14.5847 7.07878 14.5847 6.43363Z"
      fill="currentColor"
    />
    <path
      d="M13.822 6.46018C13.822 6.68011 13.6391 6.85841 13.4134 6.85841C13.1878 6.85841 13.0048 6.68011 13.0048 6.46018C13.0048 6.24024 13.1878 6.06195 13.4134 6.06195C13.6391 6.06195 13.822 6.24024 13.822 6.46018Z"
      fill="currentColor"
    />
    <path
      d="M13.7676 6.46018C13.7676 6.26957 13.609 6.11504 13.4134 6.11504C13.2179 6.11504 13.0593 6.26957 13.0593 6.46018C13.0593 6.65079 13.2179 6.80531 13.4134 6.80531V6.85841C13.1878 6.85841 13.0048 6.68011 13.0048 6.46018C13.0048 6.24024 13.1878 6.06195 13.4134 6.06195C13.6391 6.06195 13.822 6.24024 13.822 6.46018C13.822 6.68011 13.6391 6.85841 13.4134 6.85841V6.80531C13.609 6.80531 13.7676 6.65079 13.7676 6.46018Z"
      fill="currentColor"
    />
  </svg>
}
  >
    Autohand Code - AI coding agent powered by Autohand AI

    <p>
      <code>0.2.1</code>
    </p>
  </Card>

  <Card
    title="Claude Agent"
    href="https://github.com/zed-industries/claude-agent-acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1200 1200"
  >
    <path
      fill="currentColor"
      d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 467.194672 444.64447 L 468.080597 441.020203 L 459.946411 427.409485 L 392.617493 305.718323 L 320.778564 181.932983 L 288.80542 130.630859 L 280.348999 99.865845 C 277.369171 87.221436 275.194641 76.590698 275.194641 63.624268 L 312.322174 13.20813 L 332.8591 6.604126 L 382.389313 13.20813 L 403.248352 31.328979 L 434.013519 101.71814 L 483.865753 212.537048 L 561.181274 363.221497 L 583.812134 407.919434 L 595.892639 449.315491 L 600.40271 461.959839 L 608.214783 461.959839 L 608.214783 454.711609 L 614.577271 369.825623 L 626.335632 265.61084 L 637.771851 131.516846 L 641.718201 93.745117 L 660.402832 48.483276 L 697.530334 24.000122 L 726.52356 37.852417 L 750.362549 72 L 747.060486 94.067139 L 732.886047 186.201416 L 705.100708 330.52356 L 686.979919 427.167847 L 697.530334 427.167847 L 709.61084 415.087341 L 758.496704 350.174561 L 840.644348 247.490051 L 876.885925 206.738342 L 919.167847 161.71814 L 946.308838 140.29541 L 997.61084 140.29541 L 1035.38269 196.429626 L 1018.469849 254.416199 L 965.637634 321.422852 L 921.825562 378.201538 L 859.006714 462.765259 L 819.785278 530.41626 L 823.409424 535.812073 L 832.75177 534.92627 L 974.657776 504.724915 L 1051.328979 490.872559 L 1142.818848 475.167786 L 1184.214844 494.496582 L 1188.724854 514.147644 L 1172.456421 554.335693 L 1074.604126 578.496765 L 959.838989 601.449829 L 788.939636 641.879272 L 786.845764 643.409485 L 789.261841 646.389343 L 866.255127 653.637634 L 899.194702 655.409424 L 979.812134 655.409424 L 1129.932861 666.604187 L 1169.154419 692.537109 L 1192.671265 724.268677 L 1188.724854 748.429688 L 1128.322144 779.194641 L 1046.818848 759.865845 L 856.590759 714.604126 L 791.355774 698.335754 L 782.335693 698.335754 L 782.335693 703.731567 L 836.69812 756.885986 L 936.322205 846.845581 L 1061.073975 962.81897 L 1067.436279 991.490112 L 1051.409424 1014.120911 L 1034.496704 1011.704712 L 924.885986 929.234924 L 882.604126 892.107544 L 786.845764 811.48999 L 780.483276 811.48999 L 780.483276 819.946289 L 802.550415 852.241699 L 919.087341 1027.409424 L 925.127625 1081.127686 L 916.671204 1098.604126 L 886.469849 1109.154419 L 853.288696 1103.114136 L 785.073914 1007.355835 L 714.684631 899.516785 L 657.906067 802.872498 L 650.979858 806.81897 L 617.476624 1167.704834 L 601.771851 1186.147705 L 565.530212 1200 L 535.328857 1177.046997 L 519.302124 1139.919556 L 535.328857 1066.550537 L 554.657776 970.792053 L 570.362488 894.68457 L 584.536926 800.134277 L 592.993347 768.724976 L 592.429626 766.630859 L 585.503479 767.516968 L 514.22821 865.369263 L 405.825531 1011.865906 L 320.053711 1103.677979 L 299.516815 1111.812256 L 263.919525 1093.369263 L 267.221497 1060.429688 L 287.114136 1031.114136 L 405.825531 880.107361 L 477.422913 786.52356 L 523.651062 732.483276 L 523.328918 724.671265 L 520.590698 724.671265 L 205.288605 929.395935 L 149.154434 936.644409 L 124.993355 914.01355 L 127.973183 876.885986 L 139.409409 864.80542 L 234.201385 799.570435 L 233.879227 799.8927 Z"
    />
  </svg>
}
  >
    ACP wrapper for Anthropic's Claude

    <p>
      <code>0.21.0</code>
    </p>
  </Card>

  <Card
    title="Cline"
    href="https://github.com/cline/cline"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 92 96"
    fill="currentColor"
  >
    <path
      d="M65.45 16.3c10.89 0 19.71 8.86 19.71 19.8v6.6l5.74 11.46a4.48 4.48 0 0 1-.01 3.6L85.16 69.1v6.6c0 10.94-8.83 19.8-19.71 19.8H26.02c-10.89 0-19.71-8.86-19.71-19.8v-6.6L.45 57.8a4.48 4.48 0 0 1-.01-3.67L6.31 42.7v-6.6c0-10.94 8.83-19.8 19.71-19.8h39.43zm-2.52 5.7H29.19c-9.32 0-16.87 7.56-16.87 16.88v5.62l-4.88 9.46a4.48 4.48 0 0 0 .01 3.68l4.87 9.36v5.62c0 9.32 7.55 16.88 16.87 16.88h33.74c9.32 0 16.87-7.55 16.87-16.88V67l4.77-9.39a4.48 4.48 0 0 0 0-3.61L79.8 44.5v-5.62C79.8 29.56 72.25 22 62.93 22z"
      fillRule="nonzero"
    />
    <circle cx="45.73" cy="11" r="11" />
    <rect stroke="currentColor" strokeWidth="8" x="31" y="44.5" rx="2.5" />
    <rect stroke="currentColor" strokeWidth="8" x="55" y="44.5" rx="2.5" />
  </svg>
}
  >
    Autonomous coding agent CLI - capable of creating/editing files, running
    commands, using the browser, and more

    <p>
      <code>2.6.1</code>
    </p>
  </Card>

  <Card
    title="Codebuddy Code"
    href="https://www.codebuddy.cn/cli/"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
  >
    <path
      fill="currentColor"
      d="M12.13 1.25c.15-.14.16-.14.28-.15.18 0 .36.08.64.34.68.62 1.61 1.89 2.2 2.97l.22.42.32.16c.3.16.81.48 1.02.65.09.08.11.08.21.04.45-.18 1.09.05 1.65.6.51.49 1 1.33 1.18 2.03.03.11.06.36.07.54.04.64-.16 1.14-.55 1.37-.08.04-.08.06-.08.26.02.95-.23 1.89-.74 2.82-.58 1.04-1.6 2.11-2.98 3.12-.74.55-2.5 1.58-3.3 1.95-1.9.86-3.43 1.2-4.76 1.03-.79-.09-1.69-.41-2.22-.77-.14-.1-.16-.1-.27-.07-.57.16-1.31-.18-1.94-.88-.25-.28-.66-.98-.79-1.35-.3-.87-.25-1.65.16-2.12.11-.12.09-.33.09-.33-.04-.33-.05-.82-.04-1.14v-.3l-.43-.79c-.68-1.23-1.12-2.25-1.28-3.04-.09-.43-.09-.62.02-.77.07-.09.28-.18.54-.22.66-.12 2.09-.01 3.69.27l.16.03.36-.32c.61-.54 1.01-.84 1.75-1.31.77-.48 1.64-.89 2.62-1.2l.32-.1.17-.46c.62-1.65 1.25-2.86 1.71-3.27h0Zm-5.19 8.45c-.7.41-1.05.61-1.3.84-1.04.93-1.43 2.39-.99 3.71.11.33.31.68.71 1.39.41.71.61 1.06.83 1.32.92 1.05 2.37 1.45 3.68 1 .32-.11.68-.31 1.38-.72l4.02-2.34c.7-.41 1.05-.61 1.3-.84 1.04-.93 1.43-2.39.99-3.71-.11-.33-.31-.68-.71-1.39s-.61-1.06-.83-1.32c-.92-1.05-2.37-1.45-3.68-1-.32.11-.67.31-1.38.72l-4.02 2.34Z"
    />
    <path
      fill="currentColor"
      fillOpacity="0.4"
      d="M8.02 12.13c.38-.22.87-.09 1.09.29l.86 1.5c.22.38.09.88-.29 1.09-.38.22-.86.09-1.09-.29l-.86-1.5c-.22-.38-.09-.87.29-1.09Z"
    />
    <path
      fill="currentColor"
      fillOpacity="0.4"
      d="M12.31 9.64c.38-.22.87-.09 1.09.29l.86 1.5c.22.38.09.87-.29 1.09s-.87.09-1.09-.29l-.86-1.5c-.22-.38-.09-.88.29-1.09Z"
    />
  </svg>
}
  >
    Tencent Cloud's official intelligent coding tool

    <p>
      <code>2.56.1</code>
    </p>
  </Card>

  <Card
    title="Codex CLI"
    href="https://github.com/zed-industries/codex-acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
    />
  </svg>
}
  >
    ACP adapter for OpenAI's coding assistant

    <p>
      <code>0.9.5</code>
    </p>
  </Card>

  <Card
    title="Corust Agent"
    href="https://github.com/Corust-ai/corust-agent-release"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 12 12"
  >
    <g
      transform="matrix(0.00160555,0,0,-0.0014599,-0.26812129,11.08482)"
      fill="currentColor"
    >
      <path d="m 297,6493 c -4,-3 -7,-1357 -7,-3008 0,-2390 3,-3005 12,-3012 13,-10 1199,-9 1224,1 11,4 13,61 10,295 -2,159 -7,294 -10,299 -4,7 -112,11 -312,11 -168,0 -309,3 -314,6 -12,7 -13,4775 -2,4792 6,10 85,13 317,15 l 310,3 v 600 l -611,3 c -336,1 -614,-1 -617,-5 z" />
      <path d="m 6287,6493 c -4,-3 -7,-136 -7,-294 0,-219 3,-290 13,-296 6,-4 152,-10 322,-13 l 310,-5 3,-2394 c 1,-1545 -1,-2398 -8,-2405 -6,-6 -127,-9 -316,-7 -246,2 -309,0 -315,-11 -5,-7 -9,-145 -9,-305 V 470 l 23,-1 c 158,-4 1192,-2 1200,3 14,9 22,5964 7,6002 l -10,26 h -603 c -332,0 -607,-3 -610,-7 z" />
      <g transform="matrix(1.0249,0,0,1.0566,-429.39,51.322)">
        <path d="m 2476.7,5111.6 c -64.95,-6.2305 -71.077,-28.66 -73.528,-325.23 -3.6765,-261.68 4.9018,-351.4 36.764,-371.34 7.3528,-4.9844 583.32,-12.461 1276.9,-16.199 l 1262.2,-6.2306 73.528,-34.891 c 191.17,-90.966 300.24,-292.84 284.31,-527.1 -15.931,-223.05 -134.8,-392.52 -314.95,-449.85 -61.274,-19.938 -133.58,-21.184 -727.93,-18.692 -607.83,3.7384 -661.75,2.4922 -682.59,-17.446 -22.058,-19.938 -23.284,-43.614 -23.284,-331.47 0,-190.65 4.9019,-320.25 12.255,-335.2 11.029,-21.184 26.96,-23.676 123.77,-23.676 h 110.29 l 66.176,-63.552 c 36.764,-34.891 125,-125.86 198.53,-201.87 72.303,-76.013 322.3,-333.96 555.14,-571.96 l 424.01,-434.89 519.6,3.7383 c 390.93,2.4922 520.83,7.4767 520.83,18.692 0,7.4766 -223.04,249.22 -496.32,534.58 -562.49,589.41 -666.66,701.56 -660.53,707.79 2.451,2.4922 52.695,8.7227 111.52,13.707 322.3,24.922 593.13,194.39 790.43,495.95 129.9,199.38 187.5,391.28 196.08,660.44 8.5783,245.48 -14.706,368.85 -116.42,600.63 -123.77,286.61 -328.43,492.21 -596.8,601.87 -232.84,95.95 -167.89,92.212 -1574.7,93.458 -691.17,1.2462 -1274.5,1.2462 -1295.3,-1.2461 z" />
        <path d="m 2430.1,3942.7 c -24.509,-18.692 -24.509,-33.645 -24.509,-1254.8 0,-1163.9 1.2255,-1238.6 22.058,-1271 l 20.833,-33.645 h 337 c 289.21,0 338.23,2.4922 354.16,19.938 18.382,17.446 19.608,145.79 18.382,1267.3 -1.2255,1115.3 -2.4509,1251.1 -19.608,1271 -18.382,18.692 -50.244,21.184 -351.71,21.184 -276.96,-1.2461 -335.78,-3.7383 -356.61,-19.938 z" />
      </g>
    </g>
  </svg>
}
  >
    Co-building with a seasoned Rust partner.

    <p>
      <code>0.3.7</code>
    </p>
  </Card>

  <Card
    title="crow-cli"
    href="https://github.com/crow-cli/crow-cli"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 366 368"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="currentColor"
      d="m 26,275.93574 c 0.65,-9.32 8.46,-15.43 15,-20.96 15.43,-13.04 35.67,-21.92 53,-32.71 20.67,-12.88 61.58,-40.31 80,-55.03 0,0 21,-18.39 21,-18.39 0,0 28,-23.91 28,-23.91 10,-8.33 14.1,-11.65 25,-18.92 7.42,-4.94 19.07,-12.550001 24.52,-19.330001 7.17,-8.93 4.16,-18.82 -4.53,-25.45 -5.67,-4.32 -23.5,-8.94 -30.99,-10.66 -3.1,-0.72 -11.45,-1.57 -13.38,-3.62 -3.22,-3.43 1.67,-6.99 4.38,-8.45 6.61,-3.54 17.51,-5.73 25,-5.82 0,0 4,0 4,0 16.51,-0.2 18.85,-12.47 40,-11.99 9.26,0.21 21.16,2.48 29,7.54 7.87,5.07 12.2,11.73 17.05,19.45 6.31,10.05 12.35,21.16 14.49,33 1.42,7.88 -0.45,13.62 -0.54,21.000001 -0.28,24.26 6.68,37.92 -2.44,63 -5.9,16.24 -14.87,35.36 -23.98,50 -9.34,15 -20.81,30.64 -35.58,40.64 0,0 -16,9.36 -16,9.36 -3.3,1.9 -6.18,2.94 -6.64,7.04 -0.68,2.83 -0.16,7.11 0,9.96 0,0 1.29,8 1.29,8 1.62,5.16 8.51,12.15 12.35,16 3.36,3.37 6.84,7.82 12,7.89 4.2,0.06 8.14,-2.87 12,-4.44 5.24,-2.13 11.35,-3.55 17,-3.94 6.33,-0.43 17.05,1.85 14,10.49 -2.84,-3.54 -6.09,-6.36 -11,-5.57 -2.47,0.4 -10.06,3.6 -8.09,7.08 1.19,2.08 7.67,3.01 10.09,3.88 6.26,2.25 10.83,5.76 14,11.61 0,0 -17,-6.33 -17,-6.33 -9.74,-2.08 -18.73,0.62 -28,3.33 5.49,3.71 8.06,5.51 12,11 -8.23,-1.96 -13.6,-7.46 -26,-6.96 -9.64,0.39 -11.89,4.13 -27,3.96 -9.42,-0.11 -17.78,-4.36 -27,-3.96 -9.45,0.41 -13.16,5.64 -21,8.96 3.16,-14.88 19.73,-16 32,-16 -7.31,-10.21 -20.46,-18.11 -23.28,-26 -0.7,-1.97 -0.69,-3.94 -0.71,-6 0,0 0,-14 0,-14 0.23,-2.35 1.13,-5.62 0,-7.73 -1.66,-2.77 -8.94,-4.64 -12.01,-5.55 -20.1,-5.96 -24.58,-0.84 -43,2.01 0,0 -14,2.11 -14,2.11 -9.78,1.06 -18.83,0.92 -28,5.02 0,0 -15,7.88 -15,7.88 -16.76,8.6 -42.02,22.27 -59,27.93 -9.14,3.04 -16.2,6.24 -26,6.33 0,0 5,-10 5,-10 -3.92,0.18 -15.76,3.08 -17.92,-0.51 -2.44,-4.07 5.28,-9.01 7.92,-10.91 0,0 36,-24.58 36,-24.58 0,0 -19,3.25 -19,3.25 z m 227,1.75 c -2.98,0.84 -11.45,3.61 -12.96,6.27 -0.95,1.89 -0.18,5.54 0,7.73 0.04,2.47 -0.13,4.56 0.61,7 1.52,5.07 11.84,17.33 16.35,19.88 3.38,1.91 15.93,0.11 20,-0.88 -4.12,-8.71 -16.66,-15.05 -21.99,-24 -3.43,-5.75 -0.8,-10.06 -2.01,-16 z"
    />
  </svg>
}
  >
    Minimal ACP Native Coding Agent

    <p>
      <code>0.1.14</code>
    </p>
  </Card>

  <Card
    title="Cursor"
    href="https://cursor.com/docs/cli/acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 466.73 532.09"
  >
    <path
      fill="currentColor"
      d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"
    />
  </svg>
}
  >
    Cursor's coding agent

    <p>
      <code>0.1.0</code>
    </p>
  </Card>

  <Card
    title="DimCode"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.12109 11.0078H1.99902V5.49316H3.12109V11.0078ZM3.7041 5.49316C4.91979 5.49316 5.31142 5.57449 5.80762 5.7373C6.50208 5.97365 6.85299 6.40958 6.86133 7.04492V9.45605C6.86125 10.207 6.37767 10.6797 5.41016 10.874C4.95546 10.9633 4.69632 11.0078 3.7041 11.0078V10.6064C4.72131 10.6064 4.95994 10.5507 5.34863 10.4404C5.91072 10.2671 6.19576 9.93907 6.2041 9.45605V7.04492C6.20402 6.4883 5.83211 6.13886 5.08789 5.99707C4.74057 5.93405 4.58897 5.89978 3.7041 5.89453V5.49316ZM9.16797 5.49316V11.0078H8.0459V5.49316H9.16797ZM14 6.79297V11.0078H12.8779V8.0791L13.8877 6.79297H14ZM14 5.49316V5.7373L11.3594 8.97852H10.7852L9.74219 6.94531V6.07812H9.86719L11.0723 8.33203L13.4258 5.49316H14Z"
      fill="currentColor"
    />
  </svg>
}
  >
    A coding agent that puts leading models at your command.

    <p>
      <code>0.0.16</code>
    </p>
  </Card>

  <Card
    title="Factory Droid"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 900 900"
    fill="none"
  >
    <path
      fill="currentColor"
      d="M622.037 192.524a10.58 10.58 0 0 1-4.056-2.001 10.573 10.573 0 0 1-3.98-7.89 10.595 10.595 0 0 1 .804-4.452c20.214-49.194 29.134-88.555 14.74-105.033-38.123-43.716-191.004 43.219-239.75 72.663a10.596 10.596 0 0 1-10.841.041 10.576 10.576 0 0 1-4.396-5.07c-20.491-49.089-42.031-83.233-63.865-84.714-57.871-3.96-104.516 165.624-118.17 220.895a10.574 10.574 0 0 1-1.993 4.057 10.572 10.572 0 0 1-7.884 3.977 10.586 10.586 0 0 1-4.447-.802c-49.194-20.215-88.572-29.134-105.033-14.74-43.717 38.123 43.202 191.005 72.644 239.75a10.553 10.553 0 0 1 1.454 4.279 10.573 10.573 0 0 1-6.481 10.958c-49.072 20.491-83.216 42.031-84.715 63.864-3.944 57.871 165.624 104.516 220.913 118.171a10.566 10.566 0 0 1 5.658 3.601 10.57 10.57 0 0 1 2.355 6.281 10.58 10.58 0 0 1-.799 4.442c-20.214 49.194-29.134 88.572-14.739 105.033 38.121 43.717 191.021-43.202 239.767-72.644a10.566 10.566 0 0 1 15.238 5.027c20.489 49.072 42.013 83.216 63.862 84.715 57.871 3.944 104.516-165.624 118.153-220.913a10.603 10.603 0 0 1 9.895-8.021 10.566 10.566 0 0 1 4.449.808c49.193 20.214 88.553 29.116 105.032 14.738 43.718-38.121-43.219-191.022-72.663-239.767a10.602 10.602 0 0 1 1.326-12.655 10.604 10.604 0 0 1 3.703-2.582c49.089-20.49 83.233-42.031 84.714-63.863 3.96-57.871-165.624-104.516-220.895-118.153Zm-66.394-55.478c11.123 19.938-46.196 152.797-88.83 245.724a8.36 8.36 0 0 1-8.239 4.855 8.374 8.374 0 0 1-7.412-6.043c-17.219-60.42-36.899-131.411-57.957-191.675a10.557 10.557 0 0 1 4.924-12.759c52.586-28.721 142.568-66.86 157.514-40.102ZM303.635 153.49c21.953 6.233 75.365 140.709 110.92 236.564a8.364 8.364 0 0 1-2.394 9.249 8.364 8.364 0 0 1-9.504.978c-54.943-30.493-119.013-66.824-176.522-94.546a10.565 10.565 0 0 1-5.528-12.501c16.926-57.44 53.532-148.095 83.028-139.744ZM137.064 343.322c19.921-11.123 152.795 46.197 245.707 88.83a8.369 8.369 0 0 1-1.189 15.652c-60.401 17.219-131.411 36.899-191.675 57.957a10.552 10.552 0 0 1-12.742-4.925c-28.668-52.584-66.876-142.568-40.101-157.514Zm16.443 252.009c6.217-21.953 140.709-75.365 236.564-110.921a8.368 8.368 0 0 1 10.227 11.898c-30.511 54.945-66.842 119.014-94.563 176.507a10.548 10.548 0 0 1-5.229 5.075 10.544 10.544 0 0 1-7.271.468c-57.441-16.822-148.095-53.531-139.728-83.027ZM343.34 761.902c-11.14-19.922 46.197-152.796 88.829-245.707a8.383 8.383 0 0 1 5.713-4.66 8.38 8.38 0 0 1 7.182 1.664 8.371 8.371 0 0 1 2.758 4.184c17.217 60.403 36.898 131.412 57.957 191.675a10.558 10.558 0 0 1-4.942 12.743c-52.568 28.668-142.568 66.875-157.445 40.101h-.052Zm252.009-16.443c-21.971-6.216-75.383-140.709-110.939-236.564a8.37 8.37 0 0 1 11.916-10.228c54.926 30.494 119.014 66.842 176.506 94.563a10.538 10.538 0 0 1 5.527 12.502c-16.909 57.526-53.515 148.094-83.01 139.727Zm166.57-189.834c-19.938 11.141-152.796-46.197-245.724-88.83a8.367 8.367 0 0 1-2.993-12.892 8.378 8.378 0 0 1 4.182-2.759c60.419-17.218 131.41-36.899 191.675-57.958a10.577 10.577 0 0 1 12.758 4.943c28.652 52.568 66.86 142.569 40.102 157.496Zm-16.444-252.009c-6.232 21.971-140.709 75.383-236.562 110.94a8.371 8.371 0 0 1-10.229-11.917c30.495-54.926 66.825-119.012 94.547-176.505a10.555 10.555 0 0 1 12.5-5.528c57.441 16.909 148.096 53.516 139.744 83.01Z"
    />
  </svg>
}
  >
    Factory Droid - AI coding agent powered by Factory AI

    <p>
      <code>0.70.0</code>
    </p>
  </Card>

  <Card
    title="fast-agent"
    href="https://github.com/evalstate/fast-agent"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 360 360"
  >
    <g fill="currentColor">
      <circle cx="100.50" cy="40.50" r="4.50" />
      <circle cx="112.50" cy="40.50" r="4.50" />
      <circle cx="124.50" cy="40.50" r="4.50" />
      <circle cx="136.50" cy="40.50" r="4.50" />
      <circle cx="148.50" cy="40.50" r="4.50" />
      <circle cx="76.50" cy="52.50" r="4.50" />
      <circle cx="88.50" cy="52.50" r="4.50" />
      <circle cx="100.50" cy="52.50" r="4.50" />
      <circle cx="136.50" cy="52.50" r="4.50" />
      <circle cx="148.50" cy="52.50" r="4.50" />
      <circle cx="160.50" cy="52.50" r="4.50" />
      <circle cx="64.50" cy="64.50" r="4.50" />
      <circle cx="76.50" cy="64.50" r="4.50" />
      <circle cx="88.50" cy="64.50" r="4.50" />
      <circle cx="100.50" cy="64.50" r="4.50" />
      <circle cx="136.50" cy="64.50" r="4.50" />
      <circle cx="148.50" cy="64.50" r="4.50" />
      <circle cx="160.50" cy="64.50" r="4.50" />
      <circle cx="172.50" cy="64.50" r="4.50" />
      <circle cx="52.50" cy="76.50" r="4.50" />
      <circle cx="64.50" cy="76.50" r="4.50" />
      <circle cx="76.50" cy="76.50" r="4.50" />
      <circle cx="88.50" cy="76.50" r="4.50" />
      <circle cx="100.50" cy="76.50" r="4.50" />
      <circle cx="136.50" cy="76.50" r="4.50" />
      <circle cx="148.50" cy="76.50" r="4.50" />
      <circle cx="160.50" cy="76.50" r="4.50" />
      <circle cx="52.50" cy="88.50" r="4.50" />
      <circle cx="64.50" cy="88.50" r="4.50" />
      <circle cx="76.50" cy="88.50" r="4.50" />
      <circle cx="88.50" cy="88.50" r="4.50" />
      <circle cx="100.50" cy="88.50" r="4.50" />
      <circle cx="148.50" cy="88.50" r="4.50" />
      <circle cx="52.50" cy="100.50" r="4.50" />
      <circle cx="64.50" cy="100.50" r="4.50" />
      <circle cx="76.50" cy="100.50" r="4.50" />
      <circle cx="88.50" cy="100.50" r="4.50" />
      <circle cx="100.50" cy="100.50" r="4.50" />
      <circle cx="52.50" cy="112.50" r="4.50" />
      <circle cx="64.50" cy="112.50" r="4.50" />
      <circle cx="76.50" cy="112.50" r="4.50" />
      <circle cx="88.50" cy="112.50" r="4.50" />
      <circle cx="100.50" cy="112.50" r="4.50" />
      <circle cx="52.50" cy="124.50" r="4.50" />
      <circle cx="64.50" cy="124.50" r="4.50" />
      <circle cx="76.50" cy="124.50" r="4.50" />
      <circle cx="88.50" cy="124.50" r="4.50" />
      <circle cx="100.50" cy="124.50" r="4.50" />
      <circle cx="232.50" cy="124.50" r="4.50" />
      <circle cx="244.50" cy="124.50" r="4.50" />
      <circle cx="256.50" cy="124.50" r="4.50" />
      <circle cx="28.50" cy="136.50" r="4.50" />
      <circle cx="40.50" cy="136.50" r="4.50" />
      <circle cx="52.50" cy="136.50" r="4.50" />
      <circle cx="64.50" cy="136.50" r="4.50" />
      <circle cx="76.50" cy="136.50" r="4.50" />
      <circle cx="88.50" cy="136.50" r="4.50" />
      <circle cx="100.50" cy="136.50" r="4.50" />
      <circle cx="112.50" cy="136.50" r="4.50" />
      <circle cx="124.50" cy="136.50" r="4.50" />
      <circle cx="196.50" cy="136.50" r="4.50" />
      <circle cx="208.50" cy="136.50" r="4.50" />
      <circle cx="220.50" cy="136.50" r="4.50" />
      <circle cx="232.50" cy="136.50" r="4.50" />
      <circle cx="244.50" cy="136.50" r="4.50" />
      <circle cx="256.50" cy="136.50" r="4.50" />
      <circle cx="268.50" cy="136.50" r="4.50" />
      <circle cx="280.50" cy="136.50" r="4.50" />
      <circle cx="28.50" cy="148.50" r="4.50" />
      <circle cx="40.50" cy="148.50" r="4.50" />
      <circle cx="52.50" cy="148.50" r="4.50" />
      <circle cx="64.50" cy="148.50" r="4.50" />
      <circle cx="76.50" cy="148.50" r="4.50" />
      <circle cx="88.50" cy="148.50" r="4.50" />
      <circle cx="100.50" cy="148.50" r="4.50" />
      <circle cx="112.50" cy="148.50" r="4.50" />
      <circle cx="124.50" cy="148.50" r="4.50" />
      <circle cx="172.50" cy="148.50" r="4.50" />
      <circle cx="184.50" cy="148.50" r="4.50" />
      <circle cx="196.50" cy="148.50" r="4.50" />
      <circle cx="256.50" cy="148.50" r="4.50" />
      <circle cx="268.50" cy="148.50" r="4.50" />
      <circle cx="280.50" cy="148.50" r="4.50" />
      <circle cx="292.50" cy="148.50" r="4.50" />
      <circle cx="52.50" cy="160.50" r="4.50" />
      <circle cx="64.50" cy="160.50" r="4.50" />
      <circle cx="76.50" cy="160.50" r="4.50" />
      <circle cx="88.50" cy="160.50" r="4.50" />
      <circle cx="100.50" cy="160.50" r="4.50" />
      <circle cx="160.50" cy="160.50" r="4.50" />
      <circle cx="172.50" cy="160.50" r="4.50" />
      <circle cx="184.50" cy="160.50" r="4.50" />
      <circle cx="196.50" cy="160.50" r="4.50" />
      <circle cx="256.50" cy="160.50" r="4.50" />
      <circle cx="268.50" cy="160.50" r="4.50" />
      <circle cx="280.50" cy="160.50" r="4.50" />
      <circle cx="292.50" cy="160.50" r="4.50" />
      <circle cx="304.50" cy="160.50" r="4.50" />
      <circle cx="52.50" cy="172.50" r="4.50" />
      <circle cx="64.50" cy="172.50" r="4.50" />
      <circle cx="76.50" cy="172.50" r="4.50" />
      <circle cx="88.50" cy="172.50" r="4.50" />
      <circle cx="100.50" cy="172.50" r="4.50" />
      <circle cx="160.50" cy="172.50" r="4.50" />
      <circle cx="172.50" cy="172.50" r="4.50" />
      <circle cx="184.50" cy="172.50" r="4.50" />
      <circle cx="196.50" cy="172.50" r="4.50" />
      <circle cx="208.50" cy="172.50" r="4.50" />
      <circle cx="256.50" cy="172.50" r="4.50" />
      <circle cx="268.50" cy="172.50" r="4.50" />
      <circle cx="280.50" cy="172.50" r="4.50" />
      <circle cx="292.50" cy="172.50" r="4.50" />
      <circle cx="304.50" cy="172.50" r="4.50" />
      <circle cx="52.50" cy="184.50" r="4.50" />
      <circle cx="64.50" cy="184.50" r="4.50" />
      <circle cx="76.50" cy="184.50" r="4.50" />
      <circle cx="88.50" cy="184.50" r="4.50" />
      <circle cx="100.50" cy="184.50" r="4.50" />
      <circle cx="160.50" cy="184.50" r="4.50" />
      <circle cx="172.50" cy="184.50" r="4.50" />
      <circle cx="184.50" cy="184.50" r="4.50" />
      <circle cx="196.50" cy="184.50" r="4.50" />
      <circle cx="208.50" cy="184.50" r="4.50" />
      <circle cx="256.50" cy="184.50" r="4.50" />
      <circle cx="268.50" cy="184.50" r="4.50" />
      <circle cx="280.50" cy="184.50" r="4.50" />
      <circle cx="292.50" cy="184.50" r="4.50" />
      <circle cx="304.50" cy="184.50" r="4.50" />
      <circle cx="52.50" cy="196.50" r="4.50" />
      <circle cx="64.50" cy="196.50" r="4.50" />
      <circle cx="76.50" cy="196.50" r="4.50" />
      <circle cx="88.50" cy="196.50" r="4.50" />
      <circle cx="100.50" cy="196.50" r="4.50" />
      <circle cx="172.50" cy="196.50" r="4.50" />
      <circle cx="184.50" cy="196.50" r="4.50" />
      <circle cx="196.50" cy="196.50" r="4.50" />
      <circle cx="256.50" cy="196.50" r="4.50" />
      <circle cx="268.50" cy="196.50" r="4.50" />
      <circle cx="280.50" cy="196.50" r="4.50" />
      <circle cx="292.50" cy="196.50" r="4.50" />
      <circle cx="304.50" cy="196.50" r="4.50" />
      <circle cx="52.50" cy="208.50" r="4.50" />
      <circle cx="64.50" cy="208.50" r="4.50" />
      <circle cx="76.50" cy="208.50" r="4.50" />
      <circle cx="88.50" cy="208.50" r="4.50" />
      <circle cx="100.50" cy="208.50" r="4.50" />
      <circle cx="244.50" cy="208.50" r="4.50" />
      <circle cx="256.50" cy="208.50" r="4.50" />
      <circle cx="268.50" cy="208.50" r="4.50" />
      <circle cx="280.50" cy="208.50" r="4.50" />
      <circle cx="292.50" cy="208.50" r="4.50" />
      <circle cx="304.50" cy="208.50" r="4.50" />
      <circle cx="52.50" cy="220.50" r="4.50" />
      <circle cx="64.50" cy="220.50" r="4.50" />
      <circle cx="76.50" cy="220.50" r="4.50" />
      <circle cx="88.50" cy="220.50" r="4.50" />
      <circle cx="100.50" cy="220.50" r="4.50" />
      <circle cx="220.50" cy="220.50" r="4.50" />
      <circle cx="232.50" cy="220.50" r="4.50" />
      <circle cx="256.50" cy="220.50" r="4.50" />
      <circle cx="268.50" cy="220.50" r="4.50" />
      <circle cx="280.50" cy="220.50" r="4.50" />
      <circle cx="292.50" cy="220.50" r="4.50" />
      <circle cx="304.50" cy="220.50" r="4.50" />
      <circle cx="52.50" cy="232.50" r="4.50" />
      <circle cx="64.50" cy="232.50" r="4.50" />
      <circle cx="76.50" cy="232.50" r="4.50" />
      <circle cx="88.50" cy="232.50" r="4.50" />
      <circle cx="100.50" cy="232.50" r="4.50" />
      <circle cx="196.50" cy="232.50" r="4.50" />
      <circle cx="208.50" cy="232.50" r="4.50" />
      <circle cx="220.50" cy="232.50" r="4.50" />
      <circle cx="256.50" cy="232.50" r="4.50" />
      <circle cx="268.50" cy="232.50" r="4.50" />
      <circle cx="280.50" cy="232.50" r="4.50" />
      <circle cx="292.50" cy="232.50" r="4.50" />
      <circle cx="304.50" cy="232.50" r="4.50" />
      <circle cx="52.50" cy="244.50" r="4.50" />
      <circle cx="64.50" cy="244.50" r="4.50" />
      <circle cx="76.50" cy="244.50" r="4.50" />
      <circle cx="88.50" cy="244.50" r="4.50" />
      <circle cx="100.50" cy="244.50" r="4.50" />
      <circle cx="184.50" cy="244.50" r="4.50" />
      <circle cx="196.50" cy="244.50" r="4.50" />
      <circle cx="208.50" cy="244.50" r="4.50" />
      <circle cx="256.50" cy="244.50" r="4.50" />
      <circle cx="268.50" cy="244.50" r="4.50" />
      <circle cx="280.50" cy="244.50" r="4.50" />
      <circle cx="292.50" cy="244.50" r="4.50" />
      <circle cx="304.50" cy="244.50" r="4.50" />
      <circle cx="52.50" cy="256.50" r="4.50" />
      <circle cx="64.50" cy="256.50" r="4.50" />
      <circle cx="76.50" cy="256.50" r="4.50" />
      <circle cx="88.50" cy="256.50" r="4.50" />
      <circle cx="100.50" cy="256.50" r="4.50" />
      <circle cx="172.50" cy="256.50" r="4.50" />
      <circle cx="184.50" cy="256.50" r="4.50" />
      <circle cx="196.50" cy="256.50" r="4.50" />
      <circle cx="208.50" cy="256.50" r="4.50" />
      <circle cx="256.50" cy="256.50" r="4.50" />
      <circle cx="268.50" cy="256.50" r="4.50" />
      <circle cx="280.50" cy="256.50" r="4.50" />
      <circle cx="292.50" cy="256.50" r="4.50" />
      <circle cx="304.50" cy="256.50" r="4.50" />
      <circle cx="52.50" cy="268.50" r="4.50" />
      <circle cx="64.50" cy="268.50" r="4.50" />
      <circle cx="76.50" cy="268.50" r="4.50" />
      <circle cx="88.50" cy="268.50" r="4.50" />
      <circle cx="100.50" cy="268.50" r="4.50" />
      <circle cx="160.50" cy="268.50" r="4.50" />
      <circle cx="172.50" cy="268.50" r="4.50" />
      <circle cx="184.50" cy="268.50" r="4.50" />
      <circle cx="196.50" cy="268.50" r="4.50" />
      <circle cx="256.50" cy="268.50" r="4.50" />
      <circle cx="268.50" cy="268.50" r="4.50" />
      <circle cx="280.50" cy="268.50" r="4.50" />
      <circle cx="292.50" cy="268.50" r="4.50" />
      <circle cx="304.50" cy="268.50" r="4.50" />
      <circle cx="52.50" cy="280.50" r="4.50" />
      <circle cx="64.50" cy="280.50" r="4.50" />
      <circle cx="76.50" cy="280.50" r="4.50" />
      <circle cx="88.50" cy="280.50" r="4.50" />
      <circle cx="100.50" cy="280.50" r="4.50" />
      <circle cx="160.50" cy="280.50" r="4.50" />
      <circle cx="172.50" cy="280.50" r="4.50" />
      <circle cx="184.50" cy="280.50" r="4.50" />
      <circle cx="196.50" cy="280.50" r="4.50" />
      <circle cx="208.50" cy="280.50" r="4.50" />
      <circle cx="256.50" cy="280.50" r="4.50" />
      <circle cx="268.50" cy="280.50" r="4.50" />
      <circle cx="280.50" cy="280.50" r="4.50" />
      <circle cx="292.50" cy="280.50" r="4.50" />
      <circle cx="304.50" cy="280.50" r="4.50" />
      <circle cx="52.50" cy="292.50" r="4.50" />
      <circle cx="64.50" cy="292.50" r="4.50" />
      <circle cx="76.50" cy="292.50" r="4.50" />
      <circle cx="88.50" cy="292.50" r="4.50" />
      <circle cx="100.50" cy="292.50" r="4.50" />
      <circle cx="160.50" cy="292.50" r="4.50" />
      <circle cx="172.50" cy="292.50" r="4.50" />
      <circle cx="184.50" cy="292.50" r="4.50" />
      <circle cx="196.50" cy="292.50" r="4.50" />
      <circle cx="208.50" cy="292.50" r="4.50" />
      <circle cx="220.50" cy="292.50" r="4.50" />
      <circle cx="232.50" cy="292.50" r="4.50" />
      <circle cx="244.50" cy="292.50" r="4.50" />
      <circle cx="256.50" cy="292.50" r="4.50" />
      <circle cx="268.50" cy="292.50" r="4.50" />
      <circle cx="280.50" cy="292.50" r="4.50" />
      <circle cx="292.50" cy="292.50" r="4.50" />
      <circle cx="304.50" cy="292.50" r="4.50" />
      <circle cx="52.50" cy="304.50" r="4.50" />
      <circle cx="64.50" cy="304.50" r="4.50" />
      <circle cx="76.50" cy="304.50" r="4.50" />
      <circle cx="88.50" cy="304.50" r="4.50" />
      <circle cx="100.50" cy="304.50" r="4.50" />
      <circle cx="160.50" cy="304.50" r="4.50" />
      <circle cx="172.50" cy="304.50" r="4.50" />
      <circle cx="184.50" cy="304.50" r="4.50" />
      <circle cx="196.50" cy="304.50" r="4.50" />
      <circle cx="208.50" cy="304.50" r="4.50" />
      <circle cx="220.50" cy="304.50" r="4.50" />
      <circle cx="232.50" cy="304.50" r="4.50" />
      <circle cx="256.50" cy="304.50" r="4.50" />
      <circle cx="268.50" cy="304.50" r="4.50" />
      <circle cx="280.50" cy="304.50" r="4.50" />
      <circle cx="292.50" cy="304.50" r="4.50" />
      <circle cx="304.50" cy="304.50" r="4.50" />
      <circle cx="316.50" cy="304.50" r="4.50" />
      <circle cx="328.50" cy="304.50" r="4.50" />
      <circle cx="28.50" cy="316.50" r="4.50" />
      <circle cx="40.50" cy="316.50" r="4.50" />
      <circle cx="52.50" cy="316.50" r="4.50" />
      <circle cx="64.50" cy="316.50" r="4.50" />
      <circle cx="76.50" cy="316.50" r="4.50" />
      <circle cx="88.50" cy="316.50" r="4.50" />
      <circle cx="100.50" cy="316.50" r="4.50" />
      <circle cx="112.50" cy="316.50" r="4.50" />
      <circle cx="124.50" cy="316.50" r="4.50" />
      <circle cx="172.50" cy="316.50" r="4.50" />
      <circle cx="184.50" cy="316.50" r="4.50" />
      <circle cx="196.50" cy="316.50" r="4.50" />
      <circle cx="208.50" cy="316.50" r="4.50" />
      <circle cx="220.50" cy="316.50" r="4.50" />
      <circle cx="268.50" cy="316.50" r="4.50" />
      <circle cx="280.50" cy="316.50" r="4.50" />
      <circle cx="292.50" cy="316.50" r="4.50" />
      <circle cx="304.50" cy="316.50" r="4.50" />
      <circle cx="316.50" cy="316.50" r="4.50" />
    </g>
  </svg>
}
  >
    Code and build agents with comprehensive multi-provider support

    <p>
      <code>0.5.9</code>
    </p>
  </Card>

  <Card
    title="Gemini CLI"
    href="https://github.com/google-gemini/gemini-cli"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
    />
  </svg>
}
  >
    Google's official CLI for Gemini

    <p>
      <code>0.32.1</code>
    </p>
  </Card>

  <Card
    title="GitHub Copilot"
    href="https://github.com/github/copilot-cli"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.99816 14.2779C12.0678 14.2779 14.9997 11.6274 14.9997 10.9574V9.3189C14.939 8.77306 14.4165 7.82349 13.6074 7.48636C13.5959 7.42498 13.5859 7.36153 13.5756 7.29542C13.5506 7.13548 13.5231 6.95977 13.4649 6.75954C13.6409 6.31508 13.6873 5.81187 13.6873 5.31135C13.6873 4.54947 13.5757 3.76321 13.0811 3.13712C12.5745 2.4959 11.7737 2.15372 10.6972 2.03411C9.64215 1.91688 8.71828 2.06409 8.12157 2.70342C8.07827 2.74981 8.0345 2.79812 7.99655 2.84746C7.95861 2.79812 7.91805 2.74981 7.87475 2.70342C7.27804 2.06409 6.35416 1.91688 5.29908 2.03411C4.22263 2.15372 3.42181 2.4959 2.91521 3.13712C2.42057 3.76321 2.30905 4.54947 2.30905 5.31135C2.30905 5.81187 2.35539 6.31508 2.53142 6.75954C2.47323 6.95977 2.44574 7.13542 2.42072 7.29536C2.41037 7.3615 2.40044 7.42496 2.38893 7.48636C1.57983 7.82349 1.05728 8.77306 0.996582 9.3189V10.9574C0.996582 11.6274 3.92849 14.2779 7.99816 14.2779ZM10.5523 3.33859C9.63863 3.23707 9.25001 3.41798 9.0811 3.59896C8.90273 3.79007 8.76738 4.19254 8.86971 5.0112C8.94909 5.64627 9.13423 6.08757 9.41018 6.36929C9.67188 6.63645 10.0966 6.8426 10.8435 6.8426C11.6506 6.8426 11.9631 6.66867 12.1051 6.51046C12.2619 6.33577 12.3748 6.00462 12.3748 5.31135C12.3748 4.64141 12.2675 4.22455 12.0513 3.95077C11.8469 3.69214 11.4446 3.43773 10.5523 3.33859ZM6.91639 3.59896C6.74748 3.41798 6.35886 3.23707 5.44518 3.33859C4.55289 3.43773 4.15058 3.69214 3.94624 3.95077C3.72994 4.22455 3.62271 4.64141 3.62271 5.31135C3.62271 6.00462 3.73563 6.33577 3.89239 6.51046C4.03436 6.66867 4.34693 6.8426 5.15396 6.8426C5.90092 6.8426 6.32561 6.63645 6.58731 6.36929C6.86326 6.08757 7.0484 5.64627 7.12778 5.0112C7.23011 4.19254 7.09476 3.79007 6.91639 3.59896ZM7.99818 12.9788C9.99307 12.9788 12.0088 12.0076 12.3748 11.7248V8.00133L12.3546 7.90026C11.9257 8.08369 11.4142 8.1551 10.8435 8.1551C9.84049 8.1551 9.04148 7.86851 8.47257 7.28773C8.28092 7.09208 8.12536 6.87308 7.99978 6.6378C7.8742 6.87308 7.71544 7.09208 7.52378 7.28773C6.95488 7.86851 6.15587 8.1551 5.15283 8.1551C4.58212 8.1551 4.07068 8.08369 3.6418 7.90026L3.62158 8.00133V11.7248C3.98755 12.0076 6.00329 12.9788 7.99818 12.9788Z"
      fill="currentColor"
    />
    <path
      d="M6.46854 9.0301C6.83097 9.0301 7.12479 9.32391 7.12479 9.68635V10.9988C7.12479 11.3613 6.83097 11.6551 6.46854 11.6551C6.1061 11.6551 5.81229 11.3613 5.81229 10.9988V9.68635C5.81229 9.32391 6.1061 9.0301 6.46854 9.0301Z"
      fill="currentColor"
    />
    <path
      d="M10.1873 9.68635C10.1873 9.32391 9.89347 9.0301 9.53104 9.0301C9.1686 9.0301 8.87479 9.32391 8.87479 9.68635V10.9988C8.87479 11.3613 9.1686 11.6551 9.53104 11.6551C9.89347 11.6551 10.1873 11.3613 10.1873 10.9988V9.68635Z"
      fill="currentColor"
    />
  </svg>
}
  >
    GitHub's AI pair programmer

    <p>
      <code>1.0.2</code>
    </p>
  </Card>

  <Card
    title="goose"
    href="https://github.com/block/goose"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M20.9093 19.3861L19.5185 18.2413C18.7624 17.619 18.1189 16.8713 17.6157 16.0313C16.9205 14.8706 15.9599 13.8912 14.8133 13.1735L14.2533 12.8475C14.0614 12.7141 13.9276 12.5062 13.9086 12.2716C13.8963 12.1204 13.9326 11.9852 14.0171 11.8662C14.3087 11.4553 15.896 9.74698 16.1722 9.51845C16.528 9.22442 16.9243 8.97987 17.2921 8.69986C17.3443 8.66 17.3968 8.62035 17.4485 8.57989C17.4503 8.57808 17.4529 8.57668 17.4545 8.57508C17.5725 8.48195 17.6838 8.383 17.7724 8.26563C18.2036 7.76631 18.195 7.3443 18.195 7.3443C18.195 7.3443 18.1954 7.3439 18.1956 7.3437C18.1497 7.23133 17.9847 6.88163 17.6492 6.71759C17.9458 6.71178 18.2805 6.82294 18.4323 6.97156C18.6148 6.68534 18.7328 6.49967 18.9162 6.18762C18.9599 6.11352 18.9831 5.97652 18.8996 5.89981C18.8996 5.89981 18.8992 5.89981 18.8988 5.89981C18.8988 5.89981 18.8988 5.8994 18.8988 5.899C18.8972 5.8974 18.8952 5.8962 18.8936 5.8946C18.892 5.893 18.891 5.89119 18.8892 5.88939C18.8892 5.88939 18.8888 5.88939 18.8884 5.88939C18.8884 5.88939 18.8884 5.88899 18.8884 5.88859C18.885 5.88518 18.8812 5.88258 18.8776 5.87938C18.8754 5.87717 18.8736 5.87457 18.8716 5.87217C18.8692 5.87016 18.8665 5.86836 18.8643 5.86616C18.8609 5.86275 18.8587 5.85855 18.8551 5.85534C18.8551 5.85534 18.8545 5.85514 18.8543 5.85534C18.8543 5.85534 18.8543 5.85494 18.8543 5.85454C18.8527 5.85294 18.8507 5.85174 18.8491 5.85013C18.8475 5.84853 18.8463 5.84653 18.8447 5.84493C18.8447 5.84493 18.8441 5.84473 18.8439 5.84493C18.8439 5.84493 18.8439 5.84453 18.8439 5.84413C18.7672 5.7606 18.6302 5.78384 18.5561 5.8275C18.1503 6.06625 17.7555 6.32322 17.3996 6.54855C17.3996 6.54855 16.9778 6.53973 16.4783 6.97116C16.3607 7.05989 16.2618 7.17125 16.1688 7.28902C16.167 7.29082 16.1654 7.29322 16.164 7.29503C16.1234 7.3465 16.0837 7.39898 16.0441 7.45145C15.7639 7.81939 15.5195 8.21556 15.2255 8.57128C14.9971 8.84768 13.2887 10.4348 12.8777 10.7264C12.7587 10.8109 12.6237 10.8474 12.4723 10.835C12.2379 10.8161 12.0298 10.6821 11.8965 10.4903L11.5704 9.93024C10.8527 8.78318 9.87332 7.82299 8.71264 7.12778C7.87262 6.62466 7.12514 5.98092 6.50264 5.22503L5.35778 3.83421C5.3013 3.76571 5.19314 3.77693 5.15268 3.85585C5.02249 4.10941 4.77393 4.64479 4.58346 5.36483C4.57885 5.38186 4.58286 5.39988 4.59407 5.4135C4.83082 5.69952 5.37901 6.32983 6.03196 6.863C6.07742 6.90005 6.04017 6.97336 5.98369 6.95774C5.42047 6.80432 4.87288 6.55796 4.46308 6.34805C4.42964 6.33103 4.38918 6.35226 4.38437 6.38951C4.32068 6.89985 4.30425 7.46027 4.37155 8.05112C4.37355 8.07035 4.38577 8.08697 4.4036 8.09479C4.87088 8.29808 5.61816 8.59311 6.40269 8.78078C6.45958 8.7944 6.45777 8.87632 6.40029 8.88733C5.78941 9.0023 5.14968 9.02794 4.62973 9.02113C4.59327 9.02073 4.56643 9.05518 4.57625 9.09023C4.6806 9.45896 4.822 9.8339 5.00847 10.2115C5.08559 10.3811 5.16951 10.5475 5.25944 10.7104C5.27486 10.7382 5.3047 10.7548 5.33655 10.7534C5.76577 10.7324 6.28452 10.6871 6.80608 10.595C6.89501 10.5794 6.94268 10.6964 6.86757 10.7466C6.51345 10.9834 6.13571 11.1873 5.7844 11.3551C5.73733 11.3777 5.72211 11.4378 5.75315 11.4797C5.96186 11.7625 6.19139 12.0301 6.44075 12.2794C6.44075 12.2794 7.66853 13.5441 7.70198 13.6432C8.41841 12.9096 9.59612 12.0964 10.8966 11.3864C9.15488 12.8036 8.18387 13.8499 7.69517 14.4444L7.35447 14.9225C7.17742 15.1708 7.02379 15.4346 6.89541 15.7112C6.46579 16.6356 5.75756 18.5051 5.75756 18.5051C5.70328 18.6515 5.74754 18.7959 5.84168 18.89C5.84388 18.8922 5.84609 18.8944 5.84849 18.8964C5.85069 18.8986 5.8527 18.901 5.8549 18.9032C5.94924 18.9976 6.09345 19.0416 6.23986 18.9874C6.23986 18.9874 8.10897 18.2791 9.03371 17.8495C9.31031 17.7211 9.57429 17.5673 9.82245 17.3905L10.349 17.0153C10.6278 16.8166 11.0096 16.8483 11.2517 17.0904L12.4655 18.3042C12.7148 18.5535 12.9824 18.7831 13.2652 18.9918C13.3073 19.0226 13.3672 19.0076 13.3898 18.9605C13.5579 18.6094 13.7618 18.2313 13.9983 17.8774C14.0486 17.8022 14.1657 17.8501 14.1499 17.9388C14.0576 18.4606 14.0127 18.9794 13.9915 19.4084C13.9899 19.44 14.0067 19.4701 14.0345 19.4855C14.1972 19.5756 14.3636 19.6595 14.5335 19.7364C14.911 19.9229 15.2862 20.0645 15.6547 20.1687C15.6897 20.1785 15.7242 20.1516 15.7238 20.1152C15.7168 19.595 15.7424 18.9553 15.8576 18.3446C15.8684 18.2869 15.9503 18.2851 15.9641 18.3422C16.1516 19.127 16.4466 19.8742 16.6501 20.3413C16.6579 20.3591 16.6744 20.3712 16.6938 20.3734C17.2847 20.4407 17.8451 20.4242 18.3554 20.3606C18.3929 20.3559 18.4141 20.3155 18.3969 20.2818C18.187 19.872 17.9406 19.3241 17.7872 18.7612C17.7718 18.7046 17.8449 18.6675 17.8819 18.713C18.4151 19.3659 19.0454 19.9141 19.3314 20.1508C19.345 20.1621 19.3633 20.1659 19.3801 20.1615C20.1003 19.9712 20.6357 19.7226 20.8891 19.5922C20.968 19.5518 20.9792 19.4436 20.9107 19.3871L20.9093 19.3861Z"
    />
  </svg>
}
  >
    A local, extensible, open source AI agent that automates engineering tasks

    <p>
      <code>1.27.2</code>
    </p>
  </Card>

  <Card
    title="Junie"
    href="https://github.com/JetBrains/junie"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    fill="none"
  >
    <path
      d="M25 15H35V16.75C35 29 30.5001 35 16.5001 35H15V25H16.5001C22.6251 25 25 22.875 25 16.75V15Z"
      fill="currentColor"
    />
    <rect x="5" y="15" fill="currentColor" />
    <rect x="15" y="5" fill="currentColor" />
  </svg>
}
  >
    AI Coding Agent by JetBrains

    <p>
      <code>888.180.0</code>
    </p>
  </Card>

  <Card
    title="Kilo"
    href="https://github.com/Kilo-Org/kilocode"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
  >
    <path
      fill="currentColor"
      d="M27.9998324,34.6666921h6.6666279v5.3333023h-8.3809037l-3.6190266-3.6190266v-8.3809037h5.3333023v6.6666279ZM39.9997627,26.2857884l-3.6190266-3.6190266h-8.3809037v5.3333023h6.6666279v6.6666279h5.3333023v-8.3809037ZM17.3332326,22.6667578h-5.3333023v5.3333023h5.3333023v-5.3333023ZM0,36.3809638l3.6190266,3.6190266h13.714206v-5.3333023H5.3333023v-11.9999302H0v13.714206ZM33.9600959,11.9999247V3.619021L30.3410693-.0000056h-7.6745392v5.3333023h5.9602634v6.6666279h-5.9602634v5.3333023h17.3332326v-5.3333023h-6.0396668ZM5.3333023,0H0v17.3332326h5.3333023v-5.9999651h6.6666279v5.9999651h5.3333023v-5.9999651l-5.3333023-5.3333023h-6.6666279V0ZM17.3332326,0h-5.3333023v5.9999651h5.3333023V0Z"
    />
  </svg>
}
  >
    The open source coding agent

    <p>
      <code>7.0.40</code>
    </p>
  </Card>

  <Card
    title="Kimi CLI"
    href="https://github.com/MoonshotAI/kimi-cli"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      fill="currentColor"
      d="M19.514 7.342C19.711 7.862 19.814 8.413 19.816 8.969C19.816 12.494 15.998 14.697 12.946 12.934C11.529 12.116 10.657 10.605 10.657 8.969C10.657 5.646 14.085 3.431 17.115 4.793C15.26 3.373 12.99 2.607 10.655 2.612C4.772 2.614 0.005 7.381 0 13.265C0.002 19.148 4.772 23.918 10.655 23.92C16.538 23.916 21.306 19.147 21.31 13.265C21.312 11.155 20.687 9.095 19.514 7.342ZM14.841 4.666C14.841 8.191 18.657 10.395 21.709 8.632C23.127 7.814 24 6.302 24 4.666C24 1.14 20.184-1.061 17.13 0.699C15.714 1.519 14.841 3.03 14.841 4.666"
    />
  </svg>
}
  >
    Moonshot AI's coding assistant

    <p>
      <code>1.18.0</code>
    </p>
  </Card>

  <Card
    title="Minion Code"
    href="https://github.com/femto/minion-code"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
  >
    <rect
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      x="4.5"
      y="2.5"
      rx="3.5"
    />
    <line
      stroke="currentColor"
      strokeWidth="1"
      x1="3"
      y1="5.5"
      x2="13"
      y2="5.5"
    />
    <circle
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      cx="6.5"
      cy="5.5"
      r="1.6"
    />
    <circle
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      cx="9.5"
      cy="5.5"
      r="1.6"
    />
    <circle fill="currentColor" cx="6.8" cy="5.6" r="0.55" />
    <circle fill="currentColor" cx="9.8" cy="5.6" r="0.55" />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="0.6"
      strokeLinecap="round"
      d="M7 8.3 Q8 9 9 8.3"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      d="M4.5 8 L3 9.5"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      d="M11.5 8 L13 9.5"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.7"
      x1="5"
      y1="9.5"
      x2="11"
      y2="9.5"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.9"
      x1="6.5"
      y1="12.5"
      x2="6.5"
      y2="14"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.9"
      x1="9.5"
      y1="12.5"
      x2="9.5"
      y2="14"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      x1="6.5"
      y1="14"
      x2="5.5"
      y2="14"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      x1="9.5"
      y1="14"
      x2="10.5"
      y2="14"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      x1="8"
      y1="2.5"
      x2="7.3"
      y2="0.8"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      x1="8"
      y1="2.5"
      x2="8"
      y2="0.5"
    />
    <line
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="round"
      x1="8"
      y1="2.5"
      x2="8.7"
      y2="0.8"
    />
  </svg>
}
  >
    An enhanced AI code assistant built on the Minion framework with rich
    development tools

    <p>
      <code>0.1.39</code>
    </p>
  </Card>

  <Card
    title="Mistral Vibe"
    href="https://github.com/mistralai/mistral-vibe"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.8147 5.35803H5.35791V8.46914H8.8147V5.35803Z"
      fill="currentColor"
    />
    <path
      d="M22.6419 5.35803H19.1851V8.46914H22.6419V5.35803Z"
      fill="currentColor"
    />
    <path
      d="M15.7283 15.7284H12.2715V18.8395H15.7283V15.7284Z"
      fill="currentColor"
    />
    <path
      d="M8.8147 15.7284H5.35791V18.8395H8.8147V15.7284Z"
      fill="currentColor"
    />
    <path
      d="M22.6419 15.7284H19.1851V18.8395H22.6419V15.7284Z"
      fill="currentColor"
    />
    <path
      d="M12.2715 8.81482H5.35791V11.9259H12.2715V8.81482Z"
      fill="currentColor"
    />
    <path
      d="M12.2718 19.1852H1.90137V22.2963H12.2718V19.1852Z"
      fill="currentColor"
    />
    <path
      d="M26.0989 19.1852H15.7285V22.2963H26.0989V19.1852Z"
      fill="currentColor"
    />
    <path
      d="M22.6419 12.2716H5.35791V15.3827H22.6419V12.2716Z"
      fill="currentColor"
    />
    <path
      d="M22.6421 8.81482H15.7285V11.9259H22.6421V8.81482Z"
      fill="currentColor"
    />
  </svg>
}
  >
    Mistral's open-source coding assistant

    <p>
      <code>2.4.0</code>
    </p>
  </Card>

  <Card
    title="Nova"
    href="https://github.com/Compass-Agentic-Platform/nova"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
  >
    <circle
      cx="8"
      cy="8"
      r="6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    />
    <circle
      cx="8"
      cy="8"
      r="4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.3"
      opacity="0.5"
    />
    <line
      x1="8"
      y1="8"
      x2="13.5"
      y2="13.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <polygon points="14.5,14.5 12.3,13.5 13.5,12.3" fill="currentColor" />
    <line
      x1="8"
      y1="8"
      x2="2.5"
      y2="2.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <polygon points="1.5,1.5 3.7,2.5 2.5,3.7" fill="currentColor" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    <circle
      cx="8"
      cy="8"
      r="0.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.5"
      opacity="0.7"
    />
  </svg>
}
  >
    Nova by Compass AI - a fully-fledged software engineer at your command

    <p>
      <code>1.0.74</code>
    </p>
  </Card>

  <Card
    title="OpenCode"
    href="https://github.com/anomalyco/opencode"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13 14H3V2H13V14ZM10.5 4.4H5.5V11.6H10.5V4.4Z"
      fill="currentColor"
    />
  </svg>
}
  >
    The open source coding agent

    <p>
      <code>1.2.24</code>
    </p>
  </Card>

  <Card
    title="pi ACP"
    href="https://github.com/svkozak/pi-acp"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 1H11.7692V7.9999H8.17942V11.4999H4.58982V15H1V1ZM4.58982 4.50005V7.9999H8.17942V4.50005H4.58982Z"
      fill="currentColor"
    />
    <path d="M11.7692 7.46154H15V15H11.7692V7.46154Z" fill="currentColor" />
  </svg>
}
  >
    ACP adapter for pi coding agent

    <p>
      <code>0.0.22</code>
    </p>
  </Card>

  <Card
    title="Qoder CLI"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
  >
    <path
      fill="currentColor"
      d="M8 1C4.134 1 1 4.134 1 8s3.134 7 7 7c1.5 0 2.9-.47 4.05-1.28l1.12 1.12a.75.75 0 1 0 1.06-1.06l-1.12-1.12A6.97 6.97 0 0 0 15 8c0-3.866-3.134-7-7-7Zm0 2c2.761 0 5 2.239 5 5s-2.239 5-5 5-5-2.239-5-5 2.239-5 5-5Z"
    />
  </svg>
}
  >
    AI coding assistant with agentic capabilities

    <p>
      <code>0.1.30</code>
    </p>
  </Card>

  <Card
    title="Qwen Code"
    href="https://github.com/QwenLM/qwen-code"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    data-name="图层 2"
    viewBox="0 0 141.38 140"
  >
    <path
      fill="currentColor"
      d="m140.93 85-16.35-28.33-1.93-3.34 8.66-15a3.323 3.323 0 0 0 0-3.34l-9.62-16.67c-.3-.51-.72-.93-1.22-1.22s-1.07-.45-1.67-.45H82.23l-8.66-15a3.33 3.33 0 0 0-2.89-1.67H51.43c-.59 0-1.17.16-1.66.45-.5.29-.92.71-1.22 1.22L32.19 29.98l-1.92 3.33H12.96c-.59 0-1.17.16-1.66.45-.5.29-.93.71-1.22 1.22L.45 51.66a3.323 3.323 0 0 0 0 3.34l18.28 31.67-8.66 15a3.32 3.32 0 0 0 0 3.34l9.62 16.67c.3.51.72.93 1.22 1.22s1.07.45 1.67.45h36.56l8.66 15a3.35 3.35 0 0 0 2.89 1.67h19.25a3.34 3.34 0 0 0 2.89-1.67l18.28-31.67h17.32c.6 0 1.17-.16 1.67-.45s.92-.71 1.22-1.22l9.62-16.67a3.323 3.323 0 0 0 0-3.34ZM51.44 3.33 61.07 20l-9.63 16.66h76.98l-9.62 16.66H45.67l-11.54-20zM57.21 120H22.58l9.63-16.67h19.25l-38.5-66.67h19.25l9.62 16.67L68.78 100l-11.55 20Zm61.59-33.34-9.62-16.67-38.49 66.67-9.63-16.67 9.63-16.66 26.94-46.67h23.1l17.32 30z"
      data-name="图层 1"
    />
  </svg>
}
  >
    Alibaba's Qwen coding assistant

    <p>
      <code>0.12.0</code>
    </p>
  </Card>

  <Card
    title="Stakpak"
    href="https://github.com/stakpak/agent"
    icon={
  <svg
    width="20"
    height="20"
    className="agent-icon"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
  >
    <path
      fill="currentColor"
      d="M6.53 4.412h5.883v3.587H9.471v3.588H3.588V7.999H6.53Z"
    />
  </svg>
}
  >
    Open-source DevOps agent in Rust with enterprise-grade security

    <p>
      <code>0.3.66</code>
    </p>
  </Card>
</CardGroup>

## Using the Registry

Clients can fetch the registry programmatically:

```bash theme={null}
curl https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
```

The registry JSON contains all agent metadata including distribution information for automatic installation.

## Submit your Agent

To add your agent to the registry:

1. Fork the [registry repository on GitHub](https://github.com/agentclientprotocol/registry)
2. Create a folder with your agent's ID (lowercase, hyphens allowed)
3. Add an `agent.json` file following [the schema](https://github.com/agentclientprotocol/registry/blob/main/agent.schema.json)
4. Optionally add an `icon.svg` (16x16 recommended)
5. Submit a pull request

See the [contributing guide](https://github.com/agentclientprotocol/registry/blob/main/CONTRIBUTING.md) for details.


# Community
Source: https://agentclientprotocol.com/libraries/community

Community managed libraries for the Agent Client Protocol

## Dart

* [acp\_dart](https://github.com/SkrOYC/acp-dart)

## Emacs

* [acp.el](https://github.com/xenodium/acp.el)

## Go

* [acp-go-sdk](https://github.com/coder/acp-go-sdk)

## React

* [use-acp](https://github.com/marimo-team/use-acp)

## Swift

* [swift-acp](https://github.com/wiedymi/swift-acp)
* [swift-sdk](https://github.com/aptove/swift-sdk)
* [acp-swift-sdk](https://github.com/rebornix/acp-swift-sdk)


# Kotlin
Source: https://agentclientprotocol.com/libraries/kotlin

Kotlin library for the Agent Client Protocol

The [kotlin-sdk](https://github.com/agentclientprotocol/kotlin-sdk) provides implementations of both sides of the Agent Client Protocol that
you can use to build your own agent server or client.

**It currently supports JVM, other targets are in progress.**

To get started, add the repository to your build file:

```kotlin theme={null}
repositories {
    mavenCentral()
}
```

Add the dependency:

```kotlin theme={null}
dependencies {
    implementation("com.agentclientprotocol:acp:0.1.0-SNAPSHOT")
}
```

The [sample](https://github.com/agentclientprotocol/kotlin-sdk/tree/master/samples/kotlin-acp-client-sample) demonstrates how to implement both sides of the protocol.


# Python
Source: https://agentclientprotocol.com/libraries/python

Python library for the Agent Client Protocol

The [agentclientprotocol/python-sdk](https://github.com/agentclientprotocol/python-sdk)
repository packages Pydantic models, async base classes, and JSON-RPC plumbing
so you can build ACP-compatible agents and clients in Python. It mirrors the
official ACP schema and ships helper utilities for both sides of the protocol.

To get started, add the SDK to your project:

```bash theme={null}
pip install agent-client-protocol
```

(Using [uv](https://github.com/astral-sh/uv)? Run `uv add agent-client-protocol`.)

The repository includes runnable examples for agents, clients, Gemini CLI
bridges, and dual-agent/client demos under
[`examples/`](https://github.com/agentclientprotocol/python-sdk/tree/main/examples).

Browse the full documentation—including the quickstart, contrib helpers, and API
reference—at
[agentclientprotocol.github.io/python-sdk](https://agentclientprotocol.github.io/python-sdk/).


# Rust
Source: https://agentclientprotocol.com/libraries/rust

Rust library for the Agent Client Protocol

The [agent-client-protocol](https://crates.io/crates/agent-client-protocol) Rust
crate provides implementations of both sides of the Agent Client Protocol that
you can use to build your own agent server or client.

To get started, add the crate as a dependency to your project's `Cargo.toml`:

```bash theme={null}
cargo add agent-client-protocol
```

Depending on what kind of tool you're building, you'll need to implement either
the
[Agent](https://docs.rs/agent-client-protocol/latest/agent_client_protocol/trait.Agent.html)
trait or the
[Client](https://docs.rs/agent-client-protocol/latest/agent_client_protocol/trait.Client.html)
trait to define the interaction with the ACP counterpart.

The
[agent](https://github.com/agentclientprotocol/rust-sdk/blob/main/examples/agent.rs)
and
[client](https://github.com/agentclientprotocol/rust-sdk/blob/main/examples/client.rs)
example binaries provide runnable examples of how to do this, which you can use
as a starting point.

You can read the full documentation for the `agent-client-protocol` crate on
[docs.rs](https://docs.rs/agent-client-protocol/latest/agent_client_protocol/).

## Users

The `agent-client-protocol` crate powers the integration with external agents in
the [Zed](https://zed.dev) editor.


# TypeScript
Source: https://agentclientprotocol.com/libraries/typescript

TypeScript library for the Agent Client Protocol

The [@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk) npm
package provides implementations of both sides of the Agent Client Protocol that
you can use to build your own agent server or client.

To get started, add the package as a dependency to your project:

```bash theme={null}
npm install @agentclientprotocol/sdk
```

Depending on what kind of tool you're building, you'll need to use either the
[AgentSideConnection](https://agentclientprotocol.github.io/typescript-sdk/classes/AgentSideConnection.html)
class or the
[ClientSideConnection](https://agentclientprotocol.github.io/typescript-sdk/classes/ClientSideConnection.html)
class to establish communication with the ACP counterpart.

You can find example implementations of both sides in the [main repository](https://github.com/agentclientprotocol/typescript-sdk/tree/main/src/examples). These can be run from your terminal or from an ACP Client like [Zed](https://zed.dev), making them great starting points for your own integration!

Browse the [TypeScript library reference](https://agentclientprotocol.github.io/typescript-sdk) for detailed API documentation.

For a complete, production-ready implementation of an ACP agent, check out [Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/zed-integration/zedIntegration.ts).


# Agent Plan
Source: https://agentclientprotocol.com/protocol/agent-plan

How Agents communicate their execution plans

Plans are execution strategies for complex tasks that require multiple steps.

Agents may share plans with Clients through [`session/update`](./prompt-turn#3-agent-reports-output) notifications, providing real-time visibility into their thinking and progress.

## Creating Plans

When the language model creates an execution plan, the Agent **SHOULD** report it to the Client:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "plan",
      "entries": [
        {
          "content": "Analyze the existing codebase structure",
          "priority": "high",
          "status": "pending"
        },
        {
          "content": "Identify components that need refactoring",
          "priority": "high",
          "status": "pending"
        },
        {
          "content": "Create unit tests for critical functions",
          "priority": "medium",
          "status": "pending"
        }
      ]
    }
  }
}
```

<ParamField type="PlanEntry[]">
  An array of [plan entries](#plan-entries) representing the tasks to be
  accomplished
</ParamField>

## Plan Entries

Each plan entry represents a specific task or goal within the overall execution strategy:

<ParamField type="string">
  A human-readable description of what this task aims to accomplish
</ParamField>

<ParamField type="PlanEntryPriority">
  The relative importance of this task.

  * `high`
  * `medium`
  * `low`
</ParamField>

<ParamField type="PlanEntryStatus">
  The current [execution status](#status) of this task

  * `pending`
  * `in_progress`
  * `completed`
</ParamField>

## Updating Plans

As the Agent progresses through the plan, it **SHOULD** report updates by sending more `session/update` notifications with the same structure.

The Agent **MUST** send a complete list of all plan entries in each update and their current status. The Client **MUST** replace the current plan completely.

### Dynamic Planning

Plans can evolve during execution. The Agent **MAY** add, remove, or modify plan entries as it discovers new requirements or completes tasks, allowing it to adapt based on what it learns.


# Content
Source: https://agentclientprotocol.com/protocol/content

Understanding content blocks in the Agent Client Protocol

Content blocks represent displayable information that flows through the Agent Client Protocol. They provide a structured way to handle various types of user-facing content—whether it's text from language models, images for analysis, or embedded resources for context.

Content blocks appear in:

* User prompts sent via [`session/prompt`](./prompt-turn#1-user-message)
* Language model output streamed through [`session/update`](./prompt-turn#3-agent-reports-output) notifications
* Progress updates and results from [tool calls](./tool-calls)

## Content Types

The Agent Client Protocol uses the same `ContentBlock` structure as the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/specification/2025-06-18/schema#contentblock).

This design choice enables Agents to seamlessly forward content from MCP tool outputs without transformation.

### Text Content

Plain text messages form the foundation of most interactions.

```json theme={null}
{
  "type": "text",
  "text": "What's the weather like today?"
}
```

All Agents **MUST** support text content blocks when included in prompts.

<ParamField type="string">
  The text content to display
</ParamField>

<ParamField type="Annotations">
  Optional metadata about how the content should be used or displayed. [Learn
  more](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations).
</ParamField>

### Image Content <Icon icon="asterisk" />

Images can be included for visual context or analysis.

```json theme={null}
{
  "type": "image",
  "mimeType": "image/png",
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."
}
```

<Icon icon="asterisk" /> Requires the `image` [prompt
capability](./initialization#prompt-capabilities) when included in prompts.

<ParamField type="string">
  Base64-encoded image data
</ParamField>

<ParamField type="string">
  The MIME type of the image (e.g., "image/png", "image/jpeg")
</ParamField>

<ParamField type="string">
  Optional URI reference for the image source
</ParamField>

<ParamField type="Annotations">
  Optional metadata about how the content should be used or displayed. [Learn
  more](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations).
</ParamField>

### Audio Content <Icon icon="asterisk" />

Audio data for transcription or analysis.

```json theme={null}
{
  "type": "audio",
  "mimeType": "audio/wav",
  "data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB..."
}
```

<Icon icon="asterisk" /> Requires the `audio` [prompt
capability](./initialization#prompt-capabilities) when included in prompts.

<ParamField type="string">
  Base64-encoded audio data
</ParamField>

<ParamField type="string">
  The MIME type of the audio (e.g., "audio/wav", "audio/mp3")
</ParamField>

<ParamField type="Annotations">
  Optional metadata about how the content should be used or displayed. [Learn
  more](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations).
</ParamField>

### Embedded Resource <Icon icon="asterisk" />

Complete resource contents embedded directly in the message.

```json theme={null}
{
  "type": "resource",
  "resource": {
    "uri": "file:///home/user/script.py",
    "mimeType": "text/x-python",
    "text": "def hello():\n    print('Hello, world!')"
  }
}
```

This is the preferred way to include context in prompts, such as when using @-mentions to reference files or other resources.

By embedding the content directly in the request, Clients can include context from sources that the Agent may not have direct access to.

<Icon icon="asterisk" /> Requires the `embeddedContext` [prompt
capability](./initialization#prompt-capabilities) when included in prompts.

<ParamField type="EmbeddedResourceResource">
  The embedded resource contents, which can be either:

  <Expandable title="Text Resource">
    <ParamField type="string">
      The URI identifying the resource
    </ParamField>

    <ParamField type="string">
      The text content of the resource
    </ParamField>

    <ParamField type="string">
      Optional MIME type of the text content
    </ParamField>
  </Expandable>

  <Expandable title="Blob Resource">
    <ParamField type="string">
      The URI identifying the resource
    </ParamField>

    <ParamField type="string">
      Base64-encoded binary data
    </ParamField>

    <ParamField type="string">
      Optional MIME type of the blob
    </ParamField>
  </Expandable>
</ParamField>

<ParamField type="Annotations">
  Optional metadata about how the content should be used or displayed. [Learn
  more](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations).
</ParamField>

### Resource Link

References to resources that the Agent can access.

```json theme={null}
{
  "type": "resource_link",
  "uri": "file:///home/user/document.pdf",
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1024000
}
```

<ParamField type="string">
  The URI of the resource
</ParamField>

<ParamField type="string">
  A human-readable name for the resource
</ParamField>

<ParamField type="string">
  The MIME type of the resource
</ParamField>

<ParamField type="string">
  Optional display title for the resource
</ParamField>

<ParamField type="string">
  Optional description of the resource contents
</ParamField>

<ParamField type="integer">
  Optional size of the resource in bytes
</ParamField>

<ParamField type="Annotations">
  Optional metadata about how the content should be used or displayed. [Learn
  more](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations).
</ParamField>


# Extensibility
Source: https://agentclientprotocol.com/protocol/extensibility

Adding custom data and capabilities

The Agent Client Protocol provides built-in extension mechanisms that allow implementations to add custom functionality while maintaining compatibility with the core protocol. These mechanisms ensure that Agents and Clients can innovate without breaking interoperability.

## The `_meta` Field

All types in the protocol include a `_meta` field with type `{ [key: string]: unknown }` that implementations can use to attach custom information. This includes requests, responses, notifications, and even nested types like content blocks, tool calls, plan entries, and capability objects.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      {
        "type": "text",
        "text": "Hello, world!"
      }
    ],
    "_meta": {
      "traceparent": "00-80e1afed08e019fc1110464cfa66635c-7a085853722dc6d2-01",
      "zed.dev/debugMode": true
    }
  }
}
```

Clients may propagate fields to the agent for correlation purposes, such as `requestId`. The following root-level keys in `_meta` **SHOULD** be reserved for [W3C trace context](https://www.w3.org/TR/trace-context/) to guarantee interop with existing MCP implementations and OpenTelemetry tooling:

* `traceparent`
* `tracestate`
* `baggage`

Implementations **MUST NOT** add any custom fields at the root of a type that's part of the specification. All possible names are reserved for future protocol versions.

## Extension Methods

The protocol reserves any method name starting with an underscore (`_`) for custom extensions. This allows implementations to add new functionality without the risk of conflicting with future protocol versions.

Extension methods follow standard [JSON-RPC 2.0](https://www.jsonrpc.org/specification) semantics:

* **[Requests](https://www.jsonrpc.org/specification#request_object)** - Include an `id` field and expect a response
* **[Notifications](https://www.jsonrpc.org/specification#notification)** - Omit the `id` field and are one-way

### Custom Requests

In addition to the requests specified by the protocol, implementations **MAY** expose and call custom JSON-RPC requests as long as their name starts with an underscore (`_`).

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "_zed.dev/workspace/buffers",
  "params": {
    "language": "rust"
  }
}
```

Upon receiving a custom request, implementations **MUST** respond accordingly with the provided `id`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "buffers": [
      { "id": 0, "path": "/home/user/project/src/main.rs" },
      { "id": 1, "path": "/home/user/project/src/editor.rs" }
    ]
  }
}
```

If the receiving end doesn't recognize the custom method name, it should respond with the standard "Method not found" error:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

To avoid such cases, extensions **SHOULD** advertise their [custom capabilities](#advertising-custom-capabilities) so that callers can check their availability first and adapt their behavior or interface accordingly.

### Custom Notifications

Custom notifications are regular JSON-RPC notifications that start with an underscore (`_`). Like all notifications, they omit the `id` field:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "_zed.dev/file_opened",
  "params": {
    "path": "/home/user/project/src/editor.rs"
  }
}
```

Unlike with custom requests, implementations **SHOULD** ignore unrecognized notifications.

## Advertising Custom Capabilities

Implementations **SHOULD** use the `_meta` field in capability objects to advertise support for extensions and their methods:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "_meta": {
        "zed.dev": {
          "workspace": true,
          "fileNotifications": true
        }
      }
    }
  }
}
```

This allows implementations to negotiate custom features during initialization without breaking compatibility with standard Clients and Agents.


# File System
Source: https://agentclientprotocol.com/protocol/file-system

Client filesystem access methods

The filesystem methods allow Agents to read and write text files within the Client's environment. These methods enable Agents to access unsaved editor state and allow Clients to track file modifications made during agent execution.

## Checking Support

Before attempting to use filesystem methods, Agents **MUST** verify that the Client supports these capabilities by checking the [Client Capabilities](./initialization#client-capabilities) field in the `initialize` response:

```json highlight={8,9} theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      }
    }
  }
}
```

If `readTextFile` or `writeTextFile` is `false` or not present, the Agent **MUST NOT** attempt to call the corresponding filesystem method.

## Reading Files

The `fs/read_text_file` method allows Agents to read text file contents from the Client's filesystem, including unsaved changes in the editor.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "fs/read_text_file",
  "params": {
    "sessionId": "sess_abc123def456",
    "path": "/home/user/project/src/main.py",
    "line": 10,
    "limit": 50
  }
}
```

<ParamField type="SessionId">
  The [Session ID](./session-setup#session-id) for this request
</ParamField>

<ParamField type="string">
  Absolute path to the file to read
</ParamField>

<ParamField type="number">
  Optional line number to start reading from (1-based)
</ParamField>

<ParamField type="number">
  Optional maximum number of lines to read
</ParamField>

The Client responds with the file contents:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": "def hello_world():\n    print('Hello, world!')\n"
  }
}
```

## Writing Files

The `fs/write_text_file` method allows Agents to write or update text files in the Client's filesystem.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "fs/write_text_file",
  "params": {
    "sessionId": "sess_abc123def456",
    "path": "/home/user/project/config.json",
    "content": "{\n  \"debug\": true,\n  \"version\": \"1.0.0\"\n}"
  }
}
```

<ParamField type="SessionId">
  The [Session ID](./session-setup#session-id) for this request
</ParamField>

<ParamField type="string">
  Absolute path to the file to write.

  The Client **MUST** create the file if it doesn't exist.
</ParamField>

<ParamField type="string">
  The text content to write to the file
</ParamField>

The Client responds with an empty result on success:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": null
}
```


# Initialization
Source: https://agentclientprotocol.com/protocol/initialization

How all Agent Client Protocol connections begin

The Initialization phase allows [Clients](./overview#client) and [Agents](./overview#agent) to negotiate protocol versions, capabilities, and authentication methods.

<br />

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent

    Note over Client, Agent: Connection established
    Client->>Agent: initialize
    Note right of Agent: Negotiate protocol<br/>version & capabilities
    Agent-->>Client: initialize response
    Note over Client,Agent: Ready for session setup
```

<br />

Before a Session can be created, Clients **MUST** initialize the connection by calling the `initialize` method with:

* The latest [protocol version](#protocol-version) supported
* The [capabilities](#client-capabilities) supported

They **SHOULD** also provide a name and version to the Agent.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    },
    "clientInfo": {
      "name": "my-client",
      "title": "My Client",
      "version": "1.0.0"
    }
  }
}
```

The Agent **MUST** respond with the chosen [protocol version](#protocol-version) and the [capabilities](#agent-capabilities) it supports. It **SHOULD** also provide a name and version to the Client as well:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": true,
        "embeddedContext": true
      },
      "mcp": {
        "http": true,
        "sse": true
      }
    },
    "agentInfo": {
      "name": "my-agent",
      "title": "My Agent",
      "version": "1.0.0"
    },
    "authMethods": []
  }
}
```

## Protocol version

The protocol versions that appear in the `initialize` requests and responses are a single integer that identifies a **MAJOR** protocol version. This version is only incremented when breaking changes are introduced.

Clients and Agents **MUST** agree on a protocol version and act according to its specification.

See [Capabilities](#capabilities) to learn how non-breaking features are introduced.

### Version Negotiation

The `initialize` request **MUST** include the latest protocol version the Client supports.

If the Agent supports the requested version, it **MUST** respond with the same version. Otherwise, the Agent **MUST** respond with the latest version it supports.

If the Client does not support the version specified by the Agent in the `initialize` response, the Client **SHOULD** close the connection and inform the user about it.

## Capabilities

Capabilities describe features supported by the Client and the Agent.

All capabilities included in the `initialize` request are **OPTIONAL**. Clients and Agents **SHOULD** support all possible combinations of their peer's capabilities.

The introduction of new capabilities is not considered a breaking change. Therefore, Clients and Agents **MUST** treat all capabilities omitted in the `initialize` request as **UNSUPPORTED**.

Capabilities are high-level and are not attached to a specific base protocol concept.

Capabilities may specify the availability of protocol methods, notifications, or a subset of their parameters. They may also signal behaviors of the Agent or Client implementation.

Implementations can also [advertise custom capabilities](./extensibility#advertising-custom-capabilities) using the `_meta` field to indicate support for protocol extensions.

### Client Capabilities

The Client **SHOULD** specify whether it supports the following capabilities:

#### File System

<ParamField type="boolean">
  The `fs/read_text_file` method is available.
</ParamField>

<ParamField type="boolean">
  The `fs/write_text_file` method is available.
</ParamField>

<Card icon="file" href="./file-system">
  Learn more about File System methods
</Card>

#### Terminal

<ParamField type="boolean">
  All `terminal/*` methods are available, allowing the Agent to execute and
  manage shell commands.
</ParamField>

<Card icon="terminal" href="./terminals">
  Learn more about Terminals
</Card>

### Agent Capabilities

The Agent **SHOULD** specify whether it supports the following capabilities:

<ResponseField name="loadSession" type="boolean">
  The [`session/load`](./session-setup#loading-sessions) method is available.
</ResponseField>

<ResponseField name="promptCapabilities" type="PromptCapabilities Object">
  Object indicating the different types of [content](./content) that may be
  included in `session/prompt` requests.
</ResponseField>

#### Prompt capabilities

As a baseline, all Agents **MUST** support `ContentBlock::Text` and `ContentBlock::ResourceLink` in `session/prompt` requests.

Optionally, they **MAY** support richer types of [content](./content) by specifying the following capabilities:

<ResponseField name="image" type="boolean">
  The prompt may include `ContentBlock::Image`
</ResponseField>

<ResponseField name="audio" type="boolean">
  The prompt may include `ContentBlock::Audio`
</ResponseField>

<ResponseField name="embeddedContext" type="boolean">
  The prompt may include `ContentBlock::Resource`
</ResponseField>

#### MCP capabilities

<ResponseField name="http" type="boolean">
  The Agent supports connecting to MCP servers over HTTP.
</ResponseField>

<ResponseField name="sse" type="boolean">
  The Agent supports connecting to MCP servers over SSE.

  Note: This transport has been deprecated by the MCP spec.
</ResponseField>

#### Session Capabilities

As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.

Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.

<Note>
  `session/load` is still handled by the top-level `load_session` capability.
  This will be unified in future versions of the protocol.
</Note>

## Implementation Information

Both Clients and Agents **SHOULD** provide information about their implementation in the `clientInfo` and `agentInfo` fields respectively. Both take the following three fields:

<ParamField type="string">
  Intended for programmatic or logical use, but can be used as a display name
  fallback if title isn’t present.
</ParamField>

<ParamField type="string">
  Intended for UI and end-user contexts — optimized to be human-readable and
  easily understood. If not provided, the name should be used for display.
</ParamField>

<ParamField type="string">
  Version of the implementation. Can be displayed to the user or used for
  debugging or metrics purposes.
</ParamField>

<Info>
  Note: in future versions of the protocol, this information will be required.
</Info>

***

Once the connection is initialized, you're ready to [create a session](./session-setup) and begin the conversation with the Agent.


# Overview
Source: https://agentclientprotocol.com/protocol/overview

How the Agent Client Protocol works

The Agent Client Protocol allows [Agents](#agent) and [Clients](#client) to communicate by exposing methods that each side can call and sending notifications to inform each other of events.

## Communication Model

The protocol follows the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification with two types of messages:

* **Methods**: Request-response pairs that expect a result or error
* **Notifications**: One-way messages that don't expect a response

## Message Flow

A typical flow follows this pattern:

<Steps>
  <Step title="Initialization Phase">
    * Client → Agent: `initialize` to establish connection
    * Client → Agent: `authenticate` if required by the Agent
  </Step>

  <Step title="Session Setup - either:">
    * Client → Agent: `session/new` to create a new session
    * Client → Agent: `session/load` to resume an existing session if supported
  </Step>

  <Step title="Prompt Turn">
    * Client → Agent: `session/prompt` to send user message
    * Agent → Client: `session/update` notifications for progress updates
    * Agent → Client: File operations or permission requests as needed
    * Client → Agent: `session/cancel` to interrupt processing if needed
    * Turn ends and the Agent sends the `session/prompt` response with a stop reason
  </Step>
</Steps>

## Agent

Agents are programs that use generative AI to autonomously modify code. They typically run as subprocesses of the Client.

### Baseline Methods

<ResponseField name="initialize">
  [Negotiate versions and exchange capabilities.](./initialization).
</ResponseField>

<ResponseField name="authenticate">
  Authenticate with the Agent (if required).
</ResponseField>

<ResponseField name="session/new">
  [Create a new conversation session](./session-setup#creating-a-session).
</ResponseField>

<ResponseField name="session/prompt">
  [Send user prompts](./prompt-turn#1-user-message) to the Agent.
</ResponseField>

### Optional Methods

<ResponseField name="session/load">
  [Load an existing session](./session-setup#loading-sessions) (requires
  `loadSession` capability).
</ResponseField>

<ResponseField name="session/set_mode">
  [Switch between agent operating
  modes](./session-modes#setting-the-current-mode).
</ResponseField>

### Notifications

<ResponseField name="session/cancel">
  [Cancel ongoing operations](./prompt-turn#cancellation) (no response
  expected).
</ResponseField>

## Client

Clients provide the interface between users and agents. They are typically code editors (IDEs, text editors) but can also be other UIs for interacting with agents. Clients manage the environment, handle user interactions, and control access to resources.

### Baseline Methods

<ResponseField name="session/request_permission">
  [Request user authorization](./tool-calls#requesting-permission) for tool
  calls.
</ResponseField>

### Optional Methods

<ResponseField name="fs/read_text_file">
  [Read file contents](./file-system#reading-files) (requires `fs.readTextFile`
  capability).
</ResponseField>

<ResponseField name="fs/write_text_file">
  [Write file contents](./file-system#writing-files) (requires
  `fs.writeTextFile` capability).
</ResponseField>

<ResponseField name="terminal/create">
  [Create a new terminal](./terminals) (requires `terminal` capability).
</ResponseField>

<ResponseField name="terminal/output">
  Get terminal output and exit status (requires `terminal` capability).
</ResponseField>

<ResponseField name="terminal/release">
  Release a terminal (requires `terminal` capability).
</ResponseField>

<ResponseField name="terminal/wait_for_exit">
  Wait for terminal command to exit (requires `terminal` capability).
</ResponseField>

<ResponseField name="terminal/kill">
  Kill terminal command without releasing (requires `terminal` capability).
</ResponseField>

### Notifications

<ResponseField name="session/update">
  [Send session updates](./prompt-turn#3-agent-reports-output) to inform the
  Client of changes (no response expected). This includes: - [Message
  chunks](./content) (agent, user, thought) - [Tool calls and
  updates](./tool-calls) - [Plans](./agent-plan) - [Available commands
  updates](./slash-commands#advertising-commands) - [Mode
  changes](./session-modes#from-the-agent)
</ResponseField>

## Argument requirements

* All file paths in the protocol **MUST** be absolute.
* Line numbers are 1-based

## Error Handling

All methods follow standard JSON-RPC 2.0 [error handling](https://www.jsonrpc.org/specification#error_object):

* Successful responses include a `result` field
* Errors include an `error` object with `code` and `message`
* Notifications never receive responses (success or error)

## Extensibility

The protocol provides built-in mechanisms for adding custom functionality while maintaining compatibility:

* Add custom data using `_meta` fields
* Create custom methods by prefixing their name with underscore (`_`)
* Advertise custom capabilities during initialization

Learn about [protocol extensibility](./extensibility) to understand how to use these mechanisms.

## Next Steps

* Learn about [Initialization](./initialization) to understand version and capability negotiation
* Understand [Session Setup](./session-setup) for creating and loading sessions
* Review the [Prompt Turn](./prompt-turn) lifecycle
* Explore [Extensibility](./extensibility) to add custom features


# Prompt Turn
Source: https://agentclientprotocol.com/protocol/prompt-turn

Understanding the core conversation flow

A prompt turn represents a complete interaction cycle between the [Client](./overview#client) and [Agent](./overview#agent), starting with a user message and continuing until the Agent completes its response. This may involve multiple exchanges with the language model and tool invocations.

Before sending prompts, Clients **MUST** first complete the [initialization](./initialization) phase and [session setup](./session-setup).

## The Prompt Turn Lifecycle

A prompt turn follows a structured flow that enables rich interactions between the user, Agent, and any connected tools.

<br />

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent

    Note over Agent,Client: Session ready

    Note left of Client: User sends message
    Client->>Agent: session/prompt (user message)
    Note right of Agent: Process with LLM

    loop Until completion
        Note right of Agent: LLM responds with<br/>content/tool calls
        Agent->>Client: session/update (plan)
        Agent->>Client: session/update (agent_message_chunk)

        opt Tool calls requested
            Agent->>Client: session/update (tool_call)
            opt Permission required
                Agent->>Client: session/request_permission
                Note left of Client: User grants/denies
                Client-->>Agent: Permission response
            end
            Agent->>Client: session/update (tool_call status: in_progress)
            Note right of Agent: Execute tool
            Agent->>Client: session/update (tool_call status: completed)
            Note right of Agent: Send tool results<br/>back to LLM
        end

      opt User cancelled during execution
          Note left of Client: User cancels prompt
          Client->>Agent: session/cancel
          Note right of Agent: Abort operations
          Agent-->>Client: session/prompt response (cancelled)
      end
    end

    Agent-->>Client: session/prompt response (stopReason)

```

### 1. User Message

The turn begins when the Client sends a `session/prompt`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      {
        "type": "text",
        "text": "Can you analyze this code for potential issues?"
      },
      {
        "type": "resource",
        "resource": {
          "uri": "file:///home/user/project/main.py",
          "mimeType": "text/x-python",
          "text": "def process_data(items):\n    for item in items:\n        print(item)"
        }
      }
    ]
  }
}
```

<ParamField type="SessionId">
  The [ID](./session-setup#session-id) of the session to send this message to.
</ParamField>

<ParamField type="ContentBlock[]">
  The contents of the user message, e.g. text, images, files, etc.

  Clients **MUST** restrict types of content according to the [Prompt Capabilities](./initialization#prompt-capabilities) established during [initialization](./initialization).

  <Card icon="comments" href="./content">
    Learn more about Content
  </Card>
</ParamField>

### 2. Agent Processing

Upon receiving the prompt request, the Agent processes the user's message and sends it to the language model, which **MAY** respond with text content, tool calls, or both.

### 3. Agent Reports Output

The Agent reports the model's output to the Client via `session/update` notifications. This may include the Agent's plan for accomplishing the task:

```json expandable theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "plan",
      "entries": [
        {
          "content": "Check for syntax errors",
          "priority": "high",
          "status": "pending"
        },
        {
          "content": "Identify potential type issues",
          "priority": "medium",
          "status": "pending"
        },
        {
          "content": "Review error handling patterns",
          "priority": "medium",
          "status": "pending"
        },
        {
          "content": "Suggest improvements",
          "priority": "low",
          "status": "pending"
        }
      ]
    }
  }
}
```

<Card icon="lightbulb" href="./agent-plan">
  Learn more about Agent Plans
</Card>

The Agent then reports text responses from the model:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "I'll analyze your code for potential issues. Let me examine it..."
      }
    }
  }
}
```

If the model requested tool calls, these are also reported immediately:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Analyzing Python code",
      "kind": "other",
      "status": "pending"
    }
  }
}
```

### 4. Check for Completion

If there are no pending tool calls, the turn ends and the Agent **MUST** respond to the original `session/prompt` request with a `StopReason`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "stopReason": "end_turn"
  }
}
```

Agents **MAY** stop the turn at any point by returning the corresponding [`StopReason`](#stop-reasons).

### 5. Tool Invocation and Status Reporting

Before proceeding with execution, the Agent **MAY** request permission from the Client via the `session/request_permission` method.

Once permission is granted (if required), the Agent **SHOULD** invoke the tool and report a status update marking the tool as `in_progress`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "in_progress"
    }
  }
}
```

As the tool runs, the Agent **MAY** send additional updates, providing real-time feedback about tool execution progress.

While tools execute on the Agent, they **MAY** leverage Client capabilities such as the file system (`fs`) methods to access resources within the Client's environment.

When the tool completes, the Agent sends another update with the final status and any content:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "completed",
      "content": [
        {
          "type": "content",
          "content": {
            "type": "text",
            "text": "Analysis complete:\n- No syntax errors found\n- Consider adding type hints for better clarity\n- The function could benefit from error handling for empty lists"
          }
        }
      ]
    }
  }
}
```

<Card icon="hammer" href="./tool-calls">
  Learn more about Tool Calls
</Card>

### 6. Continue Conversation

The Agent sends the tool results back to the language model as another request.

The cycle returns to [step 2](#2-agent-processing), continuing until the language model completes its response without requesting additional tool calls or the turn gets stopped by the Agent or cancelled by the Client.

## Stop Reasons

When an Agent stops a turn, it must specify the corresponding `StopReason`:

<ResponseField name="end_turn">
  The language model finishes responding without requesting more tools
</ResponseField>

<ResponseField name="max_tokens">
  The maximum token limit is reached
</ResponseField>

<ResponseField name="max_turn_requests">
  The maximum number of model requests in a single turn is exceeded
</ResponseField>

<ResponseField name="refusal">The Agent refuses to continue</ResponseField>

<ResponseField name="cancelled">The Client cancels the turn</ResponseField>

## Cancellation

Clients **MAY** cancel an ongoing prompt turn at any time by sending a `session/cancel` notification:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": {
    "sessionId": "sess_abc123def456"
  }
}
```

The Client **SHOULD** preemptively mark all non-finished tool calls pertaining to the current turn as `cancelled` as soon as it sends the `session/cancel` notification.

The Client **MUST** respond to all pending `session/request_permission` requests with the `cancelled` outcome.

When the Agent receives this notification, it **SHOULD** stop all language model requests and all tool call invocations as soon as possible.

After all ongoing operations have been successfully aborted and pending updates have been sent, the Agent **MUST** respond to the original `session/prompt` request with the `cancelled` [stop reason](#stop-reasons).

<Warning>
  API client libraries and tools often throw an exception when their operation is aborted, which may propagate as an error response to `session/prompt`.

  Clients often display unrecognized errors from the Agent to the user, which would be undesirable for cancellations as they aren't considered errors.

  Agents **MUST** catch these errors and return the semantically meaningful `cancelled` stop reason, so that Clients can reliably confirm the cancellation.
</Warning>

The Agent **MAY** send `session/update` notifications with content or tool call updates after receiving the `session/cancel` notification, but it **MUST** ensure that it does so before responding to the `session/prompt` request.

The Client **SHOULD** still accept tool call updates received after sending `session/cancel`.

***

Once a prompt turn completes, the Client may send another `session/prompt` to continue the conversation, building on the context established in previous turns.


# Schema
Source: https://agentclientprotocol.com/protocol/schema

Schema definitions for the Agent Client Protocol

## Agent

Defines the interface that all ACP-compliant agents must implement.

Agents are programs that use generative AI to autonomously modify code. They handle
requests from clients and execute tasks using language models and tools.

### <span>authenticate</span>

Authenticates the client using the specified authentication method.

Called when the agent requires authentication before allowing session creation.
The client provides the authentication method ID that was advertised during initialization.

After successful authentication, the client can proceed to create sessions with
`new_session` without receiving an `auth_required` error.

See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)

#### <span>AuthenticateRequest</span>

Request parameters for the authenticate method.

Specifies which authentication method to use.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="methodId" type={"string"}>
  The ID of the authentication method to use.
  Must be one of the methods advertised in the initialize response.
</ResponseField>

#### <span>AuthenticateResponse</span>

Response to the `authenticate` method.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

### <span>initialize</span>

Establishes the connection with a client and negotiates protocol capabilities.

This method is called once at the beginning of the connection to:

* Negotiate the protocol version to use
* Exchange capability information between client and agent
* Determine available authentication methods

The agent should respond with its supported protocol version and capabilities.

See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)

#### <span>InitializeRequest</span>

Request parameters for the initialize method.

Sent by the client to establish connection and negotiate capabilities.

See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="clientCapabilities" type={<a href="#clientcapabilities">ClientCapabilities</a>}>
  Capabilities supported by the client.

  * Default: `{"fs":{"readTextFile":false,"writeTextFile":false},"terminal":false}`
</ResponseField>

<ResponseField name="clientInfo" type={<><span><a href="#implementation">Implementation</a></span><span> | null</span></>}>
  Information about the Client name and version sent to the Agent.

  Note: in future versions of the protocol, this will be required.
</ResponseField>

<ResponseField name="protocolVersion" type={<a href="#protocolversion">ProtocolVersion</a>}>
  The latest protocol version supported by the client.
</ResponseField>

#### <span>InitializeResponse</span>

Response to the `initialize` method.

Contains the negotiated protocol version and agent capabilities.

See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="agentCapabilities" type={<a href="#agentcapabilities">AgentCapabilities</a>}>
  Capabilities supported by the agent.

  * Default: `{"loadSession":false,"mcpCapabilities":{"http":false,"sse":false},"promptCapabilities":{"audio":false,"embeddedContext":false,"image":false},"sessionCapabilities":{}}`
</ResponseField>

<ResponseField name="agentInfo" type={<><span><a href="#implementation">Implementation</a></span><span> | null</span></>}>
  Information about the Agent name and version sent to the Client.

  Note: in future versions of the protocol, this will be required.
</ResponseField>

<ResponseField name="authMethods" type={<a href="#authmethod">AuthMethod[]</a>}>
  Authentication methods supported by the agent.

  * Default: `[]`
</ResponseField>

<ResponseField name="protocolVersion" type={<a href="#protocolversion">ProtocolVersion</a>}>
  The protocol version the client specified if supported by the agent,
  or the latest protocol version supported by the agent.

  The client should disconnect, if it doesn't support this version.
</ResponseField>

<a />

### <span>session/cancel</span>

Cancels ongoing operations for a session.

This is a notification sent by the client to cancel an ongoing prompt turn.

Upon receiving this notification, the Agent SHOULD:

* Stop all language model requests as soon as possible
* Abort all tool call invocations in progress
* Send any pending `session/update` notifications
* Respond to the original `session/prompt` request with `StopReason::Cancelled`

See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)

#### <span>CancelNotification</span>

Notification to cancel ongoing operations for a session.

See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session to cancel operations for.
</ResponseField>

<a />

### <span>session/load</span>

Loads an existing session to resume a previous conversation.

This method is only available if the agent advertises the `loadSession` capability.

The agent should:

* Restore the session context and conversation history
* Connect to the specified MCP servers
* Stream the entire conversation history back to the client via notifications

See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)

#### <span>LoadSessionRequest</span>

Request parameters for loading an existing session.

Only available if the Agent supports the `loadSession` capability.

See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="cwd" type={"string"}>
  The working directory for this session.
</ResponseField>

<ResponseField name="mcpServers" type={<a href="#mcpserver">McpServer[]</a>}>
  List of MCP servers to connect to for this session.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session to load.
</ResponseField>

#### <span>LoadSessionResponse</span>

Response from loading an existing session.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="configOptions" type={<><span><a href="#sessionconfigoption">SessionConfigOption[]</a></span><span> | null</span></>}>
  Initial session configuration options if supported by the Agent.
</ResponseField>

<ResponseField name="modes" type={<><span><a href="#sessionmodestate">SessionModeState</a></span><span> | null</span></>}>
  Initial mode state if supported by the Agent

  See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
</ResponseField>

<a />

### <span>session/new</span>

Creates a new conversation session with the agent.

Sessions represent independent conversation contexts with their own history and state.

The agent should:

* Create a new session context
* Connect to any specified MCP servers
* Return a unique session ID for future requests

May return an `auth_required` error if the agent requires authentication.

See protocol docs: [Session Setup](https://agentclientprotocol.com/protocol/session-setup)

#### <span>NewSessionRequest</span>

Request parameters for creating a new session.

See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="cwd" type={"string"}>
  The working directory for this session. Must be an absolute path.
</ResponseField>

<ResponseField name="mcpServers" type={<a href="#mcpserver">McpServer[]</a>}>
  List of MCP (Model Context Protocol) servers the agent should connect to.
</ResponseField>

#### <span>NewSessionResponse</span>

Response from creating a new session.

See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="configOptions" type={<><span><a href="#sessionconfigoption">SessionConfigOption[]</a></span><span> | null</span></>}>
  Initial session configuration options if supported by the Agent.
</ResponseField>

<ResponseField name="modes" type={<><span><a href="#sessionmodestate">SessionModeState</a></span><span> | null</span></>}>
  Initial mode state if supported by the Agent

  See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  Unique identifier for the created session.

  Used in all subsequent requests for this conversation.
</ResponseField>

<a />

### <span>session/prompt</span>

Processes a user prompt within a session.

This method handles the whole lifecycle of a prompt:

* Receives user messages with optional context (files, images, etc.)
* Processes the prompt using language models
* Reports language model content and tool calls to the Clients
* Requests permission to run tools
* Executes any requested tool calls
* Returns when the turn is complete with a stop reason

See protocol docs: [Prompt Turn](https://agentclientprotocol.com/protocol/prompt-turn)

#### <span>PromptRequest</span>

Request parameters for sending a user prompt to the agent.

Contains the user's message and any additional context.

See protocol docs: [User Message](https://agentclientprotocol.com/protocol/prompt-turn#1-user-message)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="prompt" type={<a href="#contentblock">ContentBlock[]</a>}>
  The blocks of content that compose the user's message.

  As a baseline, the Agent MUST support `ContentBlock::Text` and `ContentBlock::ResourceLink`,
  while other variants are optionally enabled via `PromptCapabilities`.

  The Client MUST adapt its interface according to `PromptCapabilities`.

  The client MAY include referenced pieces of context as either
  `ContentBlock::Resource` or `ContentBlock::ResourceLink`.

  When available, `ContentBlock::Resource` is preferred
  as it avoids extra round-trips and allows the message to include
  pieces of context from sources the agent may not have access to.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session to send this user message to
</ResponseField>

#### <span>PromptResponse</span>

Response from processing a user prompt.

See protocol docs: [Check for Completion](https://agentclientprotocol.com/protocol/prompt-turn#4-check-for-completion)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="stopReason" type={<a href="#stopreason">StopReason</a>}>
  Indicates why the agent stopped processing the turn.
</ResponseField>

<a />

### <span>session/set\_config\_option</span>

Sets the current value for a session configuration option.

#### <span>SetSessionConfigOptionRequest</span>

Request parameters for setting a session configuration option.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="configId" type={<a href="#sessionconfigid">SessionConfigId</a>}>
  The ID of the configuration option to set.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session to set the configuration option for.
</ResponseField>

<ResponseField name="value" type={<a href="#sessionconfigvalueid">SessionConfigValueId</a>}>
  The ID of the configuration option value to set.
</ResponseField>

#### <span>SetSessionConfigOptionResponse</span>

Response to `session/set_config_option` method.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="configOptions" type={<a href="#sessionconfigoption">SessionConfigOption[]</a>}>
  The full set of configuration options and their current values.
</ResponseField>

<a />

### <span>session/set\_mode</span>

Sets the current mode for a session.

Allows switching between different agent modes (e.g., "ask", "architect", "code")
that affect system prompts, tool availability, and permission behaviors.

The mode must be one of the modes advertised in `availableModes` during session
creation or loading. Agents may also change modes autonomously and notify the
client via `current_mode_update` notifications.

This method can be called at any time during a session, whether the Agent is
idle or actively generating a response.

See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)

#### <span>SetSessionModeRequest</span>

Request parameters for setting a session mode.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="modeId" type={<a href="#sessionmodeid">SessionModeId</a>}>
  The ID of the mode to set.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session to set the mode for.
</ResponseField>

#### <span>SetSessionModeResponse</span>

Response to `session/set_mode` method.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

## Client

Defines the interface that ACP-compliant clients must implement.

Clients are typically code editors (IDEs, text editors) that provide the interface
between users and AI agents. They manage the environment, handle user interactions,
and control access to resources.

<a />

### <span>fs/read\_text\_file</span>

Reads content from a text file in the client's file system.

Only available if the client advertises the `fs.readTextFile` capability.
Allows the agent to access file contents within the client's environment.

See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)

#### <span>ReadTextFileRequest</span>

Request to read content from a text file.

Only available if the client supports the `fs.readTextFile` capability.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="limit" type={"integer | null"}>
  Maximum number of lines to read.

  * Minimum: `0`
</ResponseField>

<ResponseField name="line" type={"integer | null"}>
  Line number to start reading from (1-based).

  * Minimum: `0`
</ResponseField>

<ResponseField name="path" type={"string"}>
  Absolute path to the file to read.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

#### <span>ReadTextFileResponse</span>

Response containing the contents of a text file.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={"string"} />

<a />

### <span>fs/write\_text\_file</span>

Writes content to a text file in the client's file system.

Only available if the client advertises the `fs.writeTextFile` capability.
Allows the agent to create or modify files within the client's environment.

See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)

#### <span>WriteTextFileRequest</span>

Request to write content to a text file.

Only available if the client supports the `fs.writeTextFile` capability.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={"string"}>
  The text content to write to the file.
</ResponseField>

<ResponseField name="path" type={"string"}>
  Absolute path to the file to write.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

#### <span>WriteTextFileResponse</span>

Response to `fs/write_text_file`

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<a />

### <span>session/request\_permission</span>

Requests permission from the user for a tool call operation.

Called by the agent when it needs user authorization before executing
a potentially sensitive operation. The client should present the options
to the user and return their decision.

If the client cancels the prompt turn via `session/cancel`, it MUST
respond to this request with `RequestPermissionOutcome::Cancelled`.

See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)

#### <span>RequestPermissionRequest</span>

Request for user permission to execute a tool call.

Sent when the agent needs authorization before performing a sensitive operation.

See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="options" type={<a href="#permissionoption">PermissionOption[]</a>}>
  Available permission options for the user to choose from.
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

<ResponseField name="toolCall" type={<a href="#toolcallupdate">ToolCallUpdate</a>}>
  Details about the tool call requiring permission.
</ResponseField>

#### <span>RequestPermissionResponse</span>

Response to a permission request.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="outcome" type={<a href="#requestpermissionoutcome">RequestPermissionOutcome</a>}>
  The user's decision on the permission request.
</ResponseField>

<a />

### <span>session/update</span>

Handles session update notifications from the agent.

This is a notification endpoint (no response expected) that receives
real-time updates about session progress, including message chunks,
tool calls, and execution plans.

Note: Clients SHOULD continue accepting tool call updates even after
sending a `session/cancel` notification, as the agent may send final
updates before responding with the cancelled stop reason.

See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)

#### <span>SessionNotification</span>

Notification containing a session update from the agent.

Used to stream real-time progress and results during prompt processing.

See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The ID of the session this update pertains to.
</ResponseField>

<ResponseField name="update" type={<a href="#sessionupdate">SessionUpdate</a>}>
  The actual update content.
</ResponseField>

<a />

### <span>terminal/create</span>

Executes a command in a new terminal

Only available if the `terminal` Client capability is set to `true`.

Returns a `TerminalId` that can be used with other terminal methods
to get the current output, wait for exit, and kill the command.

The `TerminalId` can also be used to embed the terminal in a tool call
by using the `ToolCallContent::Terminal` variant.

The Agent is responsible for releasing the terminal by using the `terminal/release`
method.

See protocol docs: [Terminals](https://agentclientprotocol.com/protocol/terminals)

#### <span>CreateTerminalRequest</span>

Request to create a new terminal and execute a command.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="args" type={<><span>"string"</span><span>[]</span></>}>
  Array of command arguments.
</ResponseField>

<ResponseField name="command" type={"string"}>
  The command to execute.
</ResponseField>

<ResponseField name="cwd" type={"string | null"}>
  Working directory for the command (absolute path).
</ResponseField>

<ResponseField name="env" type={<a href="#envvariable">EnvVariable[]</a>}>
  Environment variables for the command.
</ResponseField>

<ResponseField name="outputByteLimit" type={"integer | null"}>
  Maximum number of output bytes to retain.

  When the limit is exceeded, the Client truncates from the beginning of the output
  to stay within the limit.

  The Client MUST ensure truncation happens at a character boundary to maintain valid
  string output, even if this means the retained output is slightly less than the
  specified limit.

  * Minimum: `0`
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

#### <span>CreateTerminalResponse</span>

Response containing the ID of the created terminal.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="terminalId" type={"string"}>
  The unique identifier for the created terminal.
</ResponseField>

<a />

### <span>terminal/kill</span>

Kills the terminal command without releasing the terminal

While `terminal/release` will also kill the command, this method will keep
the `TerminalId` valid so it can be used with other methods.

This method can be helpful when implementing command timeouts which terminate
the command as soon as elapsed, and then get the final output so it can be sent
to the model.

Note: Call `terminal/release` when `TerminalId` is no longer needed.

See protocol docs: [Terminals](https://agentclientprotocol.com/protocol/terminals)

#### <span>KillTerminalRequest</span>

Request to kill a terminal without releasing it.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

<ResponseField name="terminalId" type={"string"}>
  The ID of the terminal to kill.
</ResponseField>

#### <span>KillTerminalResponse</span>

Response to `terminal/kill` method

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<a />

### <span>terminal/output</span>

Gets the terminal output and exit status

Returns the current content in the terminal without waiting for the command to exit.
If the command has already exited, the exit status is included.

See protocol docs: [Terminals](https://agentclientprotocol.com/protocol/terminals)

#### <span>TerminalOutputRequest</span>

Request to get the current output and status of a terminal.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

<ResponseField name="terminalId" type={"string"}>
  The ID of the terminal to get output from.
</ResponseField>

#### <span>TerminalOutputResponse</span>

Response containing the terminal output and exit status.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="exitStatus" type={<><span><a href="#terminalexitstatus">TerminalExitStatus</a></span><span> | null</span></>}>
  Exit status if the command has completed.
</ResponseField>

<ResponseField name="output" type={"string"}>
  The terminal output captured so far.
</ResponseField>

<ResponseField name="truncated" type={"boolean"}>
  Whether the output was truncated due to byte limits.
</ResponseField>

<a />

### <span>terminal/release</span>

Releases a terminal

The command is killed if it hasn't exited yet. Use `terminal/wait_for_exit`
to wait for the command to exit before releasing the terminal.

After release, the `TerminalId` can no longer be used with other `terminal/*` methods,
but tool calls that already contain it, continue to display its output.

The `terminal/kill` method can be used to terminate the command without releasing
the terminal, allowing the Agent to call `terminal/output` and other methods.

See protocol docs: [Terminals](https://agentclientprotocol.com/protocol/terminals)

#### <span>ReleaseTerminalRequest</span>

Request to release a terminal and free its resources.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

<ResponseField name="terminalId" type={"string"}>
  The ID of the terminal to release.
</ResponseField>

#### <span>ReleaseTerminalResponse</span>

Response to terminal/release method

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<a />

### <span>terminal/wait\_for\_exit</span>

Waits for the terminal command to exit and return its exit status

See protocol docs: [Terminals](https://agentclientprotocol.com/protocol/terminals)

#### <span>WaitForTerminalExitRequest</span>

Request to wait for a terminal command to exit.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="sessionId" type={<a href="#sessionid">SessionId</a>}>
  The session ID for this request.
</ResponseField>

<ResponseField name="terminalId" type={"string"}>
  The ID of the terminal to wait for.
</ResponseField>

#### <span>WaitForTerminalExitResponse</span>

Response containing the exit status of a terminal command.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="exitCode" type={"integer | null"}>
  The process exit code (may be null if terminated by signal).

  * Minimum: `0`
</ResponseField>

<ResponseField name="signal" type={"string | null"}>
  The signal that terminated the process (may be null if exited normally).
</ResponseField>

## <span>AgentCapabilities</span>

Capabilities supported by the agent.

Advertised during initialization to inform the client about
available features and content types.

See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="loadSession" type={"boolean"}>
  Whether the agent supports `session/load`.

  * Default: `false`
</ResponseField>

<ResponseField name="mcpCapabilities" type={<a href="#mcpcapabilities">McpCapabilities</a>}>
  MCP capabilities supported by the agent.

  * Default: `{"http":false,"sse":false}`
</ResponseField>

<ResponseField name="promptCapabilities" type={<a href="#promptcapabilities">PromptCapabilities</a>}>
  Prompt capabilities supported by the agent.

  * Default: `{"audio":false,"embeddedContext":false,"image":false}`
</ResponseField>

<ResponseField name="sessionCapabilities" type={<a href="#sessioncapabilities">SessionCapabilities</a>}>
  * Default: `{}`
</ResponseField>

## <span>Annotations</span>

Optional annotations for the client. The client can use annotations to inform how objects are used or displayed

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="audience" type={<><span><a href="#role">Role[]</a></span><span> | null</span></>} />

<ResponseField name="lastModified" type={"string | null"} />

<ResponseField name="priority" type={"number | null"} />

## <span>AudioContent</span>

Audio provided to or from an LLM.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

<ResponseField name="data" type={"string"} />

<ResponseField name="mimeType" type={"string"} />

## <span>AuthMethod</span>

Describes an available authentication method.

The `type` field acts as the discriminator in the serialized JSON form.
When no `type` is present, the method is treated as `agent`.

Agent handles authentication itself.

This is the default when no `type` is specified.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="description" type={"string | null"}>
  Optional description providing more details about this authentication method.
</ResponseField>

<ResponseField name="id" type={"string"}>
  Unique identifier for this authentication method.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable name of the authentication method.
</ResponseField>

## <span>AuthMethodAgent</span>

Agent handles authentication itself.

This is the default authentication method type.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="description" type={"string | null"}>
  Optional description providing more details about this authentication method.
</ResponseField>

<ResponseField name="id" type={"string"}>
  Unique identifier for this authentication method.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable name of the authentication method.
</ResponseField>

## <span>AvailableCommand</span>

Information about a command.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="description" type={"string"}>
  Human-readable description of what the command does.
</ResponseField>

<ResponseField name="input" type={<><span><a href="#availablecommandinput">AvailableCommandInput</a></span><span> | null</span></>}>
  Input for the command if required
</ResponseField>

<ResponseField name="name" type={"string"}>
  Command name (e.g., `create_plan`, `research_codebase`).
</ResponseField>

## <span>AvailableCommandInput</span>

The input specification for a command.

All text that was typed after the command name is provided as input.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="hint" type={"string"}>
  A hint to display when the input hasn't been provided yet
</ResponseField>

## <span>AvailableCommandsUpdate</span>

Available commands are ready or have changed

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="availableCommands" type={<a href="#availablecommand">AvailableCommand[]</a>}>
  Commands the agent can execute
</ResponseField>

## <span>BlobResourceContents</span>

Binary resource contents.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="blob" type={"string"} />

<ResponseField name="mimeType" type={"string | null"} />

<ResponseField name="uri" type={"string"} />

## <span>ClientCapabilities</span>

Capabilities supported by the client.

Advertised during initialization to inform the agent about
available features and methods.

See protocol docs: [Client Capabilities](https://agentclientprotocol.com/protocol/initialization#client-capabilities)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="fs" type={<a href="#filesystemcapabilities">FileSystemCapabilities</a>}>
  File system capabilities supported by the client.
  Determines which file operations the agent can request.

  * Default: `{"readTextFile":false,"writeTextFile":false}`
</ResponseField>

<ResponseField name="terminal" type={"boolean"}>
  Whether the Client support all `terminal/*` methods.

  * Default: `false`
</ResponseField>

## <span>ConfigOptionUpdate</span>

Session configuration options have been updated.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="configOptions" type={<a href="#sessionconfigoption">SessionConfigOption[]</a>}>
  The full set of configuration options and their current values.
</ResponseField>

## <span>Content</span>

Standard content block (text, images, resources).

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
  The actual content block.
</ResponseField>

## <span>ContentBlock</span>

Content blocks represent displayable information in the Agent Client Protocol.

They provide a structured way to handle various types of user-facing content—whether
it's text from language models, images for analysis, or embedded resources for context.

Content blocks appear in:

* User prompts sent via `session/prompt`
* Language model output streamed through `session/update` notifications
* Progress updates and results from tool calls

This structure is compatible with the Model Context Protocol (MCP), enabling
agents to seamlessly forward content from MCP tool outputs without transformation.

See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)

**Type:** Union

<ResponseField name="text" type="object">
  Text content. May be plain text or formatted with Markdown.

  All agents MUST support text content blocks in prompts.
  Clients SHOULD render this text as Markdown.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

    <ResponseField name="text" type={"string"} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"text"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="image" type="object">
  Images for visual context or analysis.

  Requires the `image` prompt capability when included in prompts.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

    <ResponseField name="data" type={"string"} />

    <ResponseField name="mimeType" type={"string"} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"image"`.
    </ResponseField>

    <ResponseField name="uri" type={"string | null"} />
  </Expandable>
</ResponseField>

<ResponseField name="audio" type="object">
  Audio data for transcription or analysis.

  Requires the `audio` prompt capability when included in prompts.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

    <ResponseField name="data" type={"string"} />

    <ResponseField name="mimeType" type={"string"} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"audio"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="resource_link" type="object">
  References to resources that the agent can access.

  All agents MUST support resource links in prompts.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

    <ResponseField name="description" type={"string | null"} />

    <ResponseField name="mimeType" type={"string | null"} />

    <ResponseField name="name" type={"string"} />

    <ResponseField name="size" type={"integer | null"} />

    <ResponseField name="title" type={"string | null"} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"resource_link"`.
    </ResponseField>

    <ResponseField name="uri" type={"string"} />
  </Expandable>
</ResponseField>

<ResponseField name="resource" type="object">
  Complete resource contents embedded directly in the message.

  Preferred for including context as it avoids extra round-trips.

  Requires the `embeddedContext` prompt capability when included in prompts.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

    <ResponseField name="resource" type={<a href="#embeddedresourceresource">EmbeddedResourceResource</a>} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"resource"`.
    </ResponseField>
  </Expandable>
</ResponseField>

## <span>ContentChunk</span>

A streamed item of content

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
  A single item of content
</ResponseField>

## <span>CurrentModeUpdate</span>

The current mode of the session has changed

See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="currentModeId" type={<a href="#sessionmodeid">SessionModeId</a>}>
  The ID of the current mode
</ResponseField>

## <span>Diff</span>

A diff representing file modifications.

Shows changes to files in a format suitable for display in the client UI.

See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="newText" type={"string"}>
  The new content after modification.
</ResponseField>

<ResponseField name="oldText" type={"string | null"}>
  The original content (None for new files).
</ResponseField>

<ResponseField name="path" type={"string"}>
  The file path being modified.
</ResponseField>

## <span>EmbeddedResource</span>

The contents of a resource, embedded into a prompt or tool call result.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

<ResponseField name="resource" type={<a href="#embeddedresourceresource">EmbeddedResourceResource</a>} />

## <span>EmbeddedResourceResource</span>

Resource content that can be embedded in a message.

**Type:** Union

<ResponseField name="TextResourceContents">
  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="mimeType" type={"string | null"} />

    <ResponseField name="text" type={"string"} />

    <ResponseField name="uri" type={"string"} />
  </Expandable>
</ResponseField>

<ResponseField name="BlobResourceContents">
  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="blob" type={"string"} />

    <ResponseField name="mimeType" type={"string | null"} />

    <ResponseField name="uri" type={"string"} />
  </Expandable>
</ResponseField>

## <span>EnvVariable</span>

An environment variable to set when launching an MCP server.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="name" type={"string"}>
  The name of the environment variable.
</ResponseField>

<ResponseField name="value" type={"string"}>
  The value to set for the environment variable.
</ResponseField>

## <span>Error</span>

JSON-RPC error object.

Represents an error that occurred during method execution, following the
JSON-RPC 2.0 error object specification with optional additional data.

See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)

**Type:** Object

**Properties:**

<ResponseField name="code" type={<a href="#errorcode">ErrorCode</a>}>
  A number indicating the error type that occurred. This must be an integer as
  defined in the JSON-RPC specification.
</ResponseField>

<ResponseField name="data" type={"object"}>
  Optional primitive or structured value that contains additional information
  about the error. This may include debugging information or context-specific
  details.
</ResponseField>

<ResponseField name="message" type={"string"}>
  A string providing a short description of the error. The message should be
  limited to a concise single sentence.
</ResponseField>

## <span>ErrorCode</span>

Predefined error codes for common JSON-RPC and ACP-specific errors.

These codes follow the JSON-RPC 2.0 specification for standard errors
and use the reserved range (-32000 to -32099) for protocol-specific errors.

**Type:** Union

<ResponseField name="-32700" type="int32">
  **Parse error**: Invalid JSON was received by the server. An error occurred on
  the server while parsing the JSON text.
</ResponseField>

<ResponseField name="-32600" type="int32">
  **Invalid request**: The JSON sent is not a valid Request object.
</ResponseField>

<ResponseField name="-32601" type="int32">
  **Method not found**: The method does not exist or is not available.
</ResponseField>

<ResponseField name="-32602" type="int32">
  **Invalid params**: Invalid method parameter(s).
</ResponseField>

<ResponseField name="-32603" type="int32">
  **Internal error**: Internal JSON-RPC error. Reserved for
  implementation-defined server errors.
</ResponseField>

<ResponseField name="-32000" type="int32">
  **Authentication required**: Authentication is required before this operation
  can be performed.
</ResponseField>

<ResponseField name="-32002" type="int32">
  **Resource not found**: A given resource, such as a file, was not found.
</ResponseField>

<ResponseField name="Other" type="int32">
  Other undefined error code.
</ResponseField>

## <span>ExtNotification</span>

Allows the Agent to send an arbitrary notification that is not part of the ACP spec.
Extension notifications provide a way to send one-way messages for custom functionality
while maintaining protocol compatibility.

See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)

## <span>ExtRequest</span>

Allows for sending an arbitrary request that is not part of the ACP spec.
Extension methods provide a way to add custom functionality while maintaining
protocol compatibility.

See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)

## <span>ExtResponse</span>

Allows for sending an arbitrary response to an `ExtRequest` that is not part of the ACP spec.
Extension methods provide a way to add custom functionality while maintaining
protocol compatibility.

See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)

## <span>FileSystemCapabilities</span>

File system capabilities that a client may support.

See protocol docs: [FileSystem](https://agentclientprotocol.com/protocol/initialization#filesystem)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="readTextFile" type={"boolean"}>
  Whether the Client supports `fs/read_text_file` requests.

  * Default: `false`
</ResponseField>

<ResponseField name="writeTextFile" type={"boolean"}>
  Whether the Client supports `fs/write_text_file` requests.

  * Default: `false`
</ResponseField>

## <span>HttpHeader</span>

An HTTP header to set when making requests to the MCP server.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="name" type={"string"}>
  The name of the HTTP header.
</ResponseField>

<ResponseField name="value" type={"string"}>
  The value to set for the HTTP header.
</ResponseField>

## <span>ImageContent</span>

An image provided to or from an LLM.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

<ResponseField name="data" type={"string"} />

<ResponseField name="mimeType" type={"string"} />

<ResponseField name="uri" type={"string | null"} />

## <span>Implementation</span>

Metadata about the implementation of the client or agent.
Describes the name and version of an MCP implementation, with an optional
title for UI representation.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="name" type={"string"}>
  Intended for programmatic or logical use, but can be used as a display
  name fallback if title isn’t present.
</ResponseField>

<ResponseField name="title" type={"string | null"}>
  Intended for UI and end-user contexts — optimized to be human-readable
  and easily understood.

  If not provided, the name should be used for display.
</ResponseField>

<ResponseField name="version" type={"string"}>
  Version of the implementation. Can be displayed to the user or used
  for debugging or metrics purposes. (e.g. "1.0.0").
</ResponseField>

## <span>McpCapabilities</span>

MCP capabilities supported by the agent

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="http" type={"boolean"}>
  Agent supports `McpServer::Http`.

  * Default: `false`
</ResponseField>

<ResponseField name="sse" type={"boolean"}>
  Agent supports `McpServer::Sse`.

  * Default: `false`
</ResponseField>

## <span>McpServer</span>

Configuration for connecting to an MCP (Model Context Protocol) server.

MCP servers provide tools and context that the agent can use when
processing prompts.

See protocol docs: [MCP Servers](https://agentclientprotocol.com/protocol/session-setup#mcp-servers)

**Type:** Union

<ResponseField name="http" type="object">
  HTTP transport configuration

  Only available when the Agent capabilities indicate `mcp_capabilities.http` is `true`.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="headers" type={<a href="#httpheader">HttpHeader[]</a>}>
      HTTP headers to set when making requests to the MCP server.
    </ResponseField>

    <ResponseField name="name" type={"string"}>
      Human-readable name identifying this MCP server.
    </ResponseField>

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"http"`.
    </ResponseField>

    <ResponseField name="url" type={"string"}>
      URL to the MCP server.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="sse" type="object">
  SSE transport configuration

  Only available when the Agent capabilities indicate `mcp_capabilities.sse` is `true`.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="headers" type={<a href="#httpheader">HttpHeader[]</a>}>
      HTTP headers to set when making requests to the MCP server.
    </ResponseField>

    <ResponseField name="name" type={"string"}>
      Human-readable name identifying this MCP server.
    </ResponseField>

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"sse"`.
    </ResponseField>

    <ResponseField name="url" type={"string"}>
      URL to the MCP server.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="stdio">
  Stdio transport configuration

  All Agents MUST support this transport.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="args" type={<><span>"string"</span><span>[]</span></>}>
      Command-line arguments to pass to the MCP server.
    </ResponseField>

    <ResponseField name="command" type={"string"}>
      Path to the MCP server executable.
    </ResponseField>

    <ResponseField name="env" type={<a href="#envvariable">EnvVariable[]</a>}>
      Environment variables to set when launching the MCP server.
    </ResponseField>

    <ResponseField name="name" type={"string"}>
      Human-readable name identifying this MCP server.
    </ResponseField>
  </Expandable>
</ResponseField>

## <span>McpServerHttp</span>

HTTP transport configuration for MCP.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="headers" type={<a href="#httpheader">HttpHeader[]</a>}>
  HTTP headers to set when making requests to the MCP server.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable name identifying this MCP server.
</ResponseField>

<ResponseField name="url" type={"string"}>
  URL to the MCP server.
</ResponseField>

## <span>McpServerSse</span>

SSE transport configuration for MCP.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="headers" type={<a href="#httpheader">HttpHeader[]</a>}>
  HTTP headers to set when making requests to the MCP server.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable name identifying this MCP server.
</ResponseField>

<ResponseField name="url" type={"string"}>
  URL to the MCP server.
</ResponseField>

## <span>McpServerStdio</span>

Stdio transport configuration for MCP.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="args" type={<><span>"string"</span><span>[]</span></>}>
  Command-line arguments to pass to the MCP server.
</ResponseField>

<ResponseField name="command" type={"string"}>
  Path to the MCP server executable.
</ResponseField>

<ResponseField name="env" type={<a href="#envvariable">EnvVariable[]</a>}>
  Environment variables to set when launching the MCP server.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable name identifying this MCP server.
</ResponseField>

## <span>PermissionOption</span>

An option presented to the user when requesting permission.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="kind" type={<a href="#permissionoptionkind">PermissionOptionKind</a>}>
  Hint about the nature of this permission option.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable label to display to the user.
</ResponseField>

<ResponseField name="optionId" type={<a href="#permissionoptionid">PermissionOptionId</a>}>
  Unique identifier for this permission option.
</ResponseField>

## <span>PermissionOptionId</span>

Unique identifier for a permission option.

**Type:** `string`

## <span>PermissionOptionKind</span>

The type of permission option being presented to the user.

Helps clients choose appropriate icons and UI treatment.

**Type:** Union

<ResponseField name="allow_once" type="string">
  Allow this operation only this time.
</ResponseField>

<ResponseField name="allow_always" type="string">
  Allow this operation and remember the choice.
</ResponseField>

<ResponseField name="reject_once" type="string">
  Reject this operation only this time.
</ResponseField>

<ResponseField name="reject_always" type="string">
  Reject this operation and remember the choice.
</ResponseField>

## <span>Plan</span>

An execution plan for accomplishing complex tasks.

Plans consist of multiple entries representing individual tasks or goals.
Agents report plans to clients to provide visibility into their execution strategy.
Plans can evolve during execution as the agent discovers new requirements or completes tasks.

See protocol docs: [Agent Plan](https://agentclientprotocol.com/protocol/agent-plan)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="entries" type={<a href="#planentry">PlanEntry[]</a>}>
  The list of tasks to be accomplished.

  When updating a plan, the agent must send a complete list of all entries
  with their current status. The client replaces the entire plan with each update.
</ResponseField>

## <span>PlanEntry</span>

A single entry in the execution plan.

Represents a task or goal that the assistant intends to accomplish
as part of fulfilling the user's request.
See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={"string"}>
  Human-readable description of what this task aims to accomplish.
</ResponseField>

<ResponseField name="priority" type={<a href="#planentrypriority">PlanEntryPriority</a>}>
  The relative importance of this task.
  Used to indicate which tasks are most critical to the overall goal.
</ResponseField>

<ResponseField name="status" type={<a href="#planentrystatus">PlanEntryStatus</a>}>
  Current execution status of this task.
</ResponseField>

## <span>PlanEntryPriority</span>

Priority levels for plan entries.

Used to indicate the relative importance or urgency of different
tasks in the execution plan.
See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)

**Type:** Union

<ResponseField name="high" type="string">
  High priority task - critical to the overall goal.
</ResponseField>

<ResponseField name="medium" type="string">
  Medium priority task - important but not critical.
</ResponseField>

<ResponseField name="low" type="string">
  Low priority task - nice to have but not essential.
</ResponseField>

## <span>PlanEntryStatus</span>

Status of a plan entry in the execution flow.

Tracks the lifecycle of each task from planning through completion.
See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)

**Type:** Union

<ResponseField name="pending" type="string">
  The task has not started yet.
</ResponseField>

<ResponseField name="in_progress" type="string">
  The task is currently being worked on.
</ResponseField>

<ResponseField name="completed" type="string">
  The task has been successfully completed.
</ResponseField>

## <span>PromptCapabilities</span>

Prompt capabilities supported by the agent in `session/prompt` requests.

Baseline agent functionality requires support for `ContentBlock::Text`
and `ContentBlock::ResourceLink` in prompt requests.

Other variants must be explicitly opted in to.
Capabilities for different types of content in prompt requests.

Indicates which content types beyond the baseline (text and resource links)
the agent can process.

See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="audio" type={"boolean"}>
  Agent supports `ContentBlock::Audio`.

  * Default: `false`
</ResponseField>

<ResponseField name="embeddedContext" type={"boolean"}>
  Agent supports embedded context in `session/prompt` requests.

  When enabled, the Client is allowed to include `ContentBlock::Resource`
  in prompt requests for pieces of context that are referenced in the message.

  * Default: `false`
</ResponseField>

<ResponseField name="image" type={"boolean"}>
  Agent supports `ContentBlock::Image`.

  * Default: `false`
</ResponseField>

## <span>ProtocolVersion</span>

Protocol version identifier.

This version is only bumped for breaking changes.
Non-breaking changes should be introduced via capabilities.

**Type:** `integer (uint16)`

| Constraint | Value   |
| ---------- | ------- |
| Minimum    | `0`     |
| Maximum    | `65535` |

## <span>RequestId</span>

JSON RPC Request Id

An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null \[1] and Numbers SHOULD NOT contain fractional parts \[2]

The Server MUST reply with the same value in the Response object if included. This member is used to correlate the context between the two objects.

\[1] The use of Null as a value for the id member in a Request object is discouraged, because this specification uses a value of Null for Responses with an unknown id. Also, because JSON-RPC 1.0 uses an id value of Null for Notifications this could cause confusion in handling.

\[2] Fractional parts may be problematic, since many decimal fractions cannot be represented exactly as binary fractions.

**Type:** Union

## <span>RequestPermissionOutcome</span>

The outcome of a permission request.

**Type:** Union

<ResponseField name="cancelled" type="object">
  The prompt turn was cancelled before the user responded.

  When a client sends a `session/cancel` notification to cancel an ongoing
  prompt turn, it MUST respond to all pending `session/request_permission`
  requests with this `Cancelled` outcome.

  See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)

  <Expandable title="Properties">
    <ResponseField name="outcome" type={"string"}>
      The discriminator value. Must be `"cancelled"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="selected" type="object">
  The user selected one of the provided options.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="optionId" type={<a href="#permissionoptionid">PermissionOptionId</a>}>
      The ID of the option the user selected.
    </ResponseField>

    <ResponseField name="outcome" type={"string"}>
      The discriminator value. Must be `"selected"`.
    </ResponseField>
  </Expandable>
</ResponseField>

## <span>ResourceLink</span>

A resource that the server is capable of reading, included in a prompt or tool call result.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

<ResponseField name="description" type={"string | null"} />

<ResponseField name="mimeType" type={"string | null"} />

<ResponseField name="name" type={"string"} />

<ResponseField name="size" type={"integer | null"} />

<ResponseField name="title" type={"string | null"} />

<ResponseField name="uri" type={"string"} />

## <span>Role</span>

The sender or recipient of messages and data in a conversation.

**Type:** Enumeration

| Value         |
| ------------- |
| `"assistant"` |
| `"user"`      |

## <span>SelectedPermissionOutcome</span>

The user selected one of the provided options.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="optionId" type={<a href="#permissionoptionid">PermissionOptionId</a>}>
  The ID of the option the user selected.
</ResponseField>

## <span>SessionCapabilities</span>

Session capabilities supported by the agent.

As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.

Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.

Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.

See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

## <span>SessionConfigGroupId</span>

Unique identifier for a session configuration option value group.

**Type:** `string`

## <span>SessionConfigId</span>

Unique identifier for a session configuration option.

**Type:** `string`

## <span>SessionConfigOption</span>

A session configuration option selector and its current state.

Single-value selector (dropdown).

**Type:** Object

**Properties:**

<ResponseField name="currentValue" type={<a href="#sessionconfigvalueid">SessionConfigValueId</a>}>
  The currently selected value.
</ResponseField>

<ResponseField name="options" type={<a href="#sessionconfigselectoptions">SessionConfigSelectOptions</a>}>
  The set of selectable options.
</ResponseField>

## <span>SessionConfigOptionCategory</span>

Semantic category for a session configuration option.

This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
categories gracefully.

Category names beginning with `_` are free for custom use, like other ACP extension methods.
Category names that do not begin with `_` are reserved for the ACP spec.

**Type:** Union

<ResponseField name="mode" type="string">
  Session mode selector.
</ResponseField>

<ResponseField name="model" type="string">
  Model selector.
</ResponseField>

<ResponseField name="thought_level" type="string">
  Thought/reasoning level selector.
</ResponseField>

<ResponseField name="other" type="string">
  Unknown / uncategorized selector.
</ResponseField>

## <span>SessionConfigSelect</span>

A single-value selector (dropdown) session configuration option payload.

**Type:** Object

**Properties:**

<ResponseField name="currentValue" type={<a href="#sessionconfigvalueid">SessionConfigValueId</a>}>
  The currently selected value.
</ResponseField>

<ResponseField name="options" type={<a href="#sessionconfigselectoptions">SessionConfigSelectOptions</a>}>
  The set of selectable options.
</ResponseField>

## <span>SessionConfigSelectGroup</span>

A group of possible values for a session configuration option.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="group" type={<a href="#sessionconfiggroupid">SessionConfigGroupId</a>}>
  Unique identifier for this group.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable label for this group.
</ResponseField>

<ResponseField name="options" type={<a href="#sessionconfigselectoption">SessionConfigSelectOption[]</a>}>
  The set of option values in this group.
</ResponseField>

## <span>SessionConfigSelectOption</span>

A possible value for a session configuration option.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="description" type={"string | null"}>
  Optional description for this option value.
</ResponseField>

<ResponseField name="name" type={"string"}>
  Human-readable label for this option value.
</ResponseField>

<ResponseField name="value" type={<a href="#sessionconfigvalueid">SessionConfigValueId</a>}>
  Unique identifier for this option value.
</ResponseField>

## <span>SessionConfigSelectOptions</span>

Possible values for a session configuration option.

**Type:** Union

<ResponseField name="Ungrouped" type="array">
  A flat list of options with no grouping.
</ResponseField>

<ResponseField name="Grouped" type="array">
  A list of options grouped under headers.
</ResponseField>

## <span>SessionConfigValueId</span>

Unique identifier for a session configuration option value.

**Type:** `string`

## <span>SessionId</span>

A unique identifier for a conversation session between a client and agent.

Sessions maintain their own context, conversation history, and state,
allowing multiple independent interactions with the same agent.

See protocol docs: [Session ID](https://agentclientprotocol.com/protocol/session-setup#session-id)

**Type:** `string`

## <span>SessionMode</span>

A mode the agent can operate in.

See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="description" type={"string | null"} />

<ResponseField name="id" type={<a href="#sessionmodeid">SessionModeId</a>} />

<ResponseField name="name" type={"string"} />

## <span>SessionModeId</span>

Unique identifier for a Session Mode.

**Type:** `string`

## <span>SessionModeState</span>

The set of modes and the one currently active.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="availableModes" type={<a href="#sessionmode">SessionMode[]</a>}>
  The set of modes that the Agent can operate in
</ResponseField>

<ResponseField name="currentModeId" type={<a href="#sessionmodeid">SessionModeId</a>}>
  The current mode the Agent is in.
</ResponseField>

## <span>SessionUpdate</span>

Different types of updates that can be sent during session processing.

These updates provide real-time feedback about the agent's progress.

See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)

**Type:** Union

<ResponseField name="user_message_chunk" type="object">
  A chunk of the user's message being streamed.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
      A single item of content
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"user_message_chunk"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="agent_message_chunk" type="object">
  A chunk of the agent's response being streamed.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
      A single item of content
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"agent_message_chunk"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="agent_thought_chunk" type="object">
  A chunk of the agent's internal reasoning being streamed.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
      A single item of content
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"agent_thought_chunk"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="tool_call" type="object">
  Notification that a new tool call has been initiated.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<a href="#toolcallcontent">ToolCallContent[]</a>}>
      Content produced by the tool call.
    </ResponseField>

    <ResponseField name="kind" type={<a href="#toolkind">ToolKind</a>}>
      The category of tool being invoked.
      Helps clients choose appropriate icons and UI treatment.
    </ResponseField>

    <ResponseField name="locations" type={<a href="#toolcalllocation">ToolCallLocation[]</a>}>
      File locations affected by this tool call.
      Enables "follow-along" features in clients.
    </ResponseField>

    <ResponseField name="rawInput" type={"object"}>
      Raw input parameters sent to the tool.
    </ResponseField>

    <ResponseField name="rawOutput" type={"object"}>
      Raw output returned by the tool.
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"tool_call"`.
    </ResponseField>

    <ResponseField name="status" type={<a href="#toolcallstatus">ToolCallStatus</a>}>
      Current execution status of the tool call.
    </ResponseField>

    <ResponseField name="title" type={"string"}>
      Human-readable title describing what the tool is doing.
    </ResponseField>

    <ResponseField name="toolCallId" type={<a href="#toolcallid">ToolCallId</a>}>
      Unique identifier for this tool call within the session.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="tool_call_update" type="object">
  Update on the status or results of a tool call.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<><span><a href="#toolcallcontent">ToolCallContent[]</a></span><span> | null</span></>}>
      Replace the content collection.
    </ResponseField>

    <ResponseField name="kind" type={<><span><a href="#toolkind">ToolKind</a></span><span> | null</span></>}>
      Update the tool kind.
    </ResponseField>

    <ResponseField name="locations" type={<><span><a href="#toolcalllocation">ToolCallLocation[]</a></span><span> | null</span></>}>
      Replace the locations collection.
    </ResponseField>

    <ResponseField name="rawInput" type={"object"}>
      Update the raw input.
    </ResponseField>

    <ResponseField name="rawOutput" type={"object"}>
      Update the raw output.
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"tool_call_update"`.
    </ResponseField>

    <ResponseField name="status" type={<><span><a href="#toolcallstatus">ToolCallStatus</a></span><span> | null</span></>}>
      Update the execution status.
    </ResponseField>

    <ResponseField name="title" type={"string | null"}>
      Update the human-readable title.
    </ResponseField>

    <ResponseField name="toolCallId" type={<a href="#toolcallid">ToolCallId</a>}>
      The ID of the tool call being updated.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="plan" type="object">
  The agent's execution plan for complex tasks.
  See protocol docs: [Agent Plan](https://agentclientprotocol.com/protocol/agent-plan)

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="entries" type={<a href="#planentry">PlanEntry[]</a>}>
      The list of tasks to be accomplished.

      When updating a plan, the agent must send a complete list of all entries
      with their current status. The client replaces the entire plan with each update.
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"plan"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="available_commands_update" type="object">
  Available commands are ready or have changed

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="availableCommands" type={<a href="#availablecommand">AvailableCommand[]</a>}>
      Commands the agent can execute
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"available_commands_update"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="current_mode_update" type="object">
  The current mode of the session has changed

  See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="currentModeId" type={<a href="#sessionmodeid">SessionModeId</a>}>
      The ID of the current mode
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"current_mode_update"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="config_option_update" type="object">
  Session configuration options have been updated.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="configOptions" type={<a href="#sessionconfigoption">SessionConfigOption[]</a>}>
      The full set of configuration options and their current values.
    </ResponseField>

    <ResponseField name="sessionUpdate" type={"string"}>
      The discriminator value. Must be `"config_option_update"`.
    </ResponseField>
  </Expandable>
</ResponseField>

## <span>StopReason</span>

Reasons why an agent stops processing a prompt turn.

See protocol docs: [Stop Reasons](https://agentclientprotocol.com/protocol/prompt-turn#stop-reasons)

**Type:** Union

<ResponseField name="end_turn" type="string">
  The turn ended successfully.
</ResponseField>

<ResponseField name="max_tokens" type="string">
  The turn ended because the agent reached the maximum number of tokens.
</ResponseField>

<ResponseField name="max_turn_requests" type="string">
  The turn ended because the agent reached the maximum number of allowed agent
  requests between user turns.
</ResponseField>

<ResponseField name="refusal" type="string">
  The turn ended because the agent refused to continue. The user prompt and
  everything that comes after it won't be included in the next prompt, so this
  should be reflected in the UI.
</ResponseField>

<ResponseField name="cancelled" type="string">
  The turn was cancelled by the client via `session/cancel`.

  This stop reason MUST be returned when the client sends a `session/cancel`
  notification, even if the cancellation causes exceptions in underlying operations.
  Agents should catch these exceptions and return this semantically meaningful
  response to confirm successful cancellation.
</ResponseField>

## <span>Terminal</span>

Embed a terminal created with `terminal/create` by its id.

The terminal must be added before calling `terminal/release`.

See protocol docs: [Terminal](https://agentclientprotocol.com/protocol/terminals)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="terminalId" type={"string"} />

## <span>TerminalExitStatus</span>

Exit status of a terminal command.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="exitCode" type={"integer | null"}>
  The process exit code (may be null if terminated by signal).

  * Minimum: `0`
</ResponseField>

<ResponseField name="signal" type={"string | null"}>
  The signal that terminated the process (may be null if exited normally).
</ResponseField>

## <span>TextContent</span>

Text provided to or from an LLM.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="annotations" type={<><span><a href="#annotations">Annotations</a></span><span> | null</span></>} />

<ResponseField name="text" type={"string"} />

## <span>TextResourceContents</span>

Text-based resource contents.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="mimeType" type={"string | null"} />

<ResponseField name="text" type={"string"} />

<ResponseField name="uri" type={"string"} />

## <span>ToolCall</span>

Represents a tool call that the language model has requested.

Tool calls are actions that the agent executes on behalf of the language model,
such as reading files, executing code, or fetching data from external sources.

See protocol docs: [Tool Calls](https://agentclientprotocol.com/protocol/tool-calls)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={<a href="#toolcallcontent">ToolCallContent[]</a>}>
  Content produced by the tool call.
</ResponseField>

<ResponseField name="kind" type={<a href="#toolkind">ToolKind</a>}>
  The category of tool being invoked.
  Helps clients choose appropriate icons and UI treatment.
</ResponseField>

<ResponseField name="locations" type={<a href="#toolcalllocation">ToolCallLocation[]</a>}>
  File locations affected by this tool call.
  Enables "follow-along" features in clients.
</ResponseField>

<ResponseField name="rawInput" type={"object"}>
  Raw input parameters sent to the tool.
</ResponseField>

<ResponseField name="rawOutput" type={"object"}>
  Raw output returned by the tool.
</ResponseField>

<ResponseField name="status" type={<a href="#toolcallstatus">ToolCallStatus</a>}>
  Current execution status of the tool call.
</ResponseField>

<ResponseField name="title" type={"string"}>
  Human-readable title describing what the tool is doing.
</ResponseField>

<ResponseField name="toolCallId" type={<a href="#toolcallid">ToolCallId</a>}>
  Unique identifier for this tool call within the session.
</ResponseField>

## <span>ToolCallContent</span>

Content produced by a tool call.

Tool calls can produce different types of content including
standard content blocks (text, images) or file diffs.

See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)

**Type:** Union

<ResponseField name="content" type="object">
  Standard content block (text, images, resources).

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="content" type={<a href="#contentblock">ContentBlock</a>}>
      The actual content block.
    </ResponseField>

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"content"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="diff" type="object">
  File modification shown as a diff.

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="newText" type={"string"}>
      The new content after modification.
    </ResponseField>

    <ResponseField name="oldText" type={"string | null"}>
      The original content (None for new files).
    </ResponseField>

    <ResponseField name="path" type={"string"}>
      The file path being modified.
    </ResponseField>

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"diff"`.
    </ResponseField>
  </Expandable>
</ResponseField>

<ResponseField name="terminal" type="object">
  Embed a terminal created with `terminal/create` by its id.

  The terminal must be added before calling `terminal/release`.

  See protocol docs: [Terminal](https://agentclientprotocol.com/protocol/terminals)

  <Expandable title="Properties">
    <ResponseField name="_meta" type={"object | null"}>
      The \_meta property is reserved by ACP to allow clients and agents to attach additional
      metadata to their interactions. Implementations MUST NOT make assumptions about values at
      these keys.

      See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
    </ResponseField>

    <ResponseField name="terminalId" type={"string"} />

    <ResponseField name="type" type={"string"}>
      The discriminator value. Must be `"terminal"`.
    </ResponseField>
  </Expandable>
</ResponseField>

## <span>ToolCallId</span>

Unique identifier for a tool call within a session.

**Type:** `string`

## <span>ToolCallLocation</span>

A file location being accessed or modified by a tool.

Enables clients to implement "follow-along" features that track
which files the agent is working with in real-time.

See protocol docs: [Following the Agent](https://agentclientprotocol.com/protocol/tool-calls#following-the-agent)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="line" type={"integer | null"}>
  Optional line number within the file.

  * Minimum: `0`
</ResponseField>

<ResponseField name="path" type={"string"}>
  The file path being accessed or modified.
</ResponseField>

## <span>ToolCallStatus</span>

Execution status of a tool call.

Tool calls progress through different statuses during their lifecycle.

See protocol docs: [Status](https://agentclientprotocol.com/protocol/tool-calls#status)

**Type:** Union

<ResponseField name="pending" type="string">
  The tool call hasn't started running yet because the input is either streaming
  or we're awaiting approval.
</ResponseField>

<ResponseField name="in_progress" type="string">
  The tool call is currently running.
</ResponseField>

<ResponseField name="completed" type="string">
  The tool call completed successfully.
</ResponseField>

<ResponseField name="failed" type="string">
  The tool call failed with an error.
</ResponseField>

## <span>ToolCallUpdate</span>

An update to an existing tool call.

Used to report progress and results as tools execute. All fields except
the tool call ID are optional - only changed fields need to be included.

See protocol docs: [Updating](https://agentclientprotocol.com/protocol/tool-calls#updating)

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="content" type={<><span><a href="#toolcallcontent">ToolCallContent[]</a></span><span> | null</span></>}>
  Replace the content collection.
</ResponseField>

<ResponseField name="kind" type={<><span><a href="#toolkind">ToolKind</a></span><span> | null</span></>}>
  Update the tool kind.
</ResponseField>

<ResponseField name="locations" type={<><span><a href="#toolcalllocation">ToolCallLocation[]</a></span><span> | null</span></>}>
  Replace the locations collection.
</ResponseField>

<ResponseField name="rawInput" type={"object"}>
  Update the raw input.
</ResponseField>

<ResponseField name="rawOutput" type={"object"}>
  Update the raw output.
</ResponseField>

<ResponseField name="status" type={<><span><a href="#toolcallstatus">ToolCallStatus</a></span><span> | null</span></>}>
  Update the execution status.
</ResponseField>

<ResponseField name="title" type={"string | null"}>
  Update the human-readable title.
</ResponseField>

<ResponseField name="toolCallId" type={<a href="#toolcallid">ToolCallId</a>}>
  The ID of the tool call being updated.
</ResponseField>

## <span>ToolKind</span>

Categories of tools that can be invoked.

Tool kinds help clients choose appropriate icons and optimize how they
display tool execution progress.

See protocol docs: [Creating](https://agentclientprotocol.com/protocol/tool-calls#creating)

**Type:** Union

<ResponseField name="read" type="string">
  Reading files or data.
</ResponseField>

<ResponseField name="edit" type="string">
  Modifying files or content.
</ResponseField>

<ResponseField name="delete" type="string">
  Removing files or data.
</ResponseField>

<ResponseField name="move" type="string">
  Moving or renaming files.
</ResponseField>

<ResponseField name="search" type="string">
  Searching for information.
</ResponseField>

<ResponseField name="execute" type="string">
  Running commands or code.
</ResponseField>

<ResponseField name="think" type="string">
  Internal reasoning or planning.
</ResponseField>

<ResponseField name="fetch" type="string">
  Retrieving external data.
</ResponseField>

<ResponseField name="switch_mode" type="string">
  Switching the current session mode.
</ResponseField>

<ResponseField name="other" type="string">
  Other tool types (default).
</ResponseField>

## <span>UnstructuredCommandInput</span>

All text that was typed after the command name is provided as input.

**Type:** Object

**Properties:**

<ResponseField name="_meta" type={"object | null"}>
  The \_meta property is reserved by ACP to allow clients and agents to attach additional
  metadata to their interactions. Implementations MUST NOT make assumptions about values at
  these keys.

  See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
</ResponseField>

<ResponseField name="hint" type={"string"}>
  A hint to display when the input hasn't been provided yet
</ResponseField>


# Session Config Options
Source: https://agentclientprotocol.com/protocol/session-config-options

Flexible configuration selectors for agent sessions

Agents can provide an arbitrary list of configuration options for a session, allowing Clients to offer users customizable selectors for things like models, modes, reasoning levels, and more.

<Info>
  Session Config Options are the preferred way to expose session-level
  configuration. If an Agent provides `configOptions`, Clients **SHOULD** use
  them instead of the [`modes`](./session-modes) field. Modes will be removed in
  a future version of the protocol.
</Info>

## Initial State

During [Session Setup](./session-setup) the Agent **MAY** return a list of configuration options and their current values:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "configOptions": [
      {
        "id": "mode",
        "name": "Session Mode",
        "description": "Controls how the agent requests permission",
        "category": "mode",
        "type": "select",
        "currentValue": "ask",
        "options": [
          {
            "value": "ask",
            "name": "Ask",
            "description": "Request permission before making any changes"
          },
          {
            "value": "code",
            "name": "Code",
            "description": "Write and modify code with full tool access"
          }
        ]
      },
      {
        "id": "model",
        "name": "Model",
        "category": "model",
        "type": "select",
        "currentValue": "model-1",
        "options": [
          {
            "value": "model-1",
            "name": "Model 1",
            "description": "The fastest model"
          },
          {
            "value": "model-2",
            "name": "Model 2",
            "description": "The most powerful model"
          }
        ]
      }
    ]
  }
}
```

<ResponseField name="configOptions" type="ConfigOption[]">
  The list of configuration options available for this session. The order of
  this array represents the Agent's preferred priority. Clients **SHOULD**
  respect this ordering when displaying options.
</ResponseField>

### ConfigOption

<ResponseField name="id" type="string">
  Unique identifier for this configuration option. Used when setting values.
</ResponseField>

<ResponseField name="name" type="string">
  Human-readable label for the option
</ResponseField>

<ResponseField name="description" type="string">
  Optional description providing more details about what this option controls
</ResponseField>

<ResponseField name="category" type="ConfigOptionCategory">
  Optional [semantic category](#option-categories) to help Clients provide
  consistent UX.
</ResponseField>

<ResponseField name="type" type="ConfigOptionType">
  The type of input control. Currently only `select` is supported.
</ResponseField>

<ResponseField name="currentValue" type="string">
  The currently selected value for this option
</ResponseField>

<ResponseField name="options" type="ConfigOptionValue[]">
  The available values for this option
</ResponseField>

### ConfigOptionValue

<ResponseField name="value" type="string">
  The value identifier used when setting this option
</ResponseField>

<ResponseField name="name" type="string">
  Human-readable name to display
</ResponseField>

<ResponseField name="description" type="string">
  Optional description of what this value does
</ResponseField>

## Option Categories

Each config option **MAY** include a `category` field. Categories are semantic metadata intended to help Clients provide consistent UX, such as attaching keyboard shortcuts, choosing icons, or deciding placement.

<Warning>
  Categories are for UX purposes only and **MUST NOT** be required for
  correctness. Clients **MUST** handle missing or unknown categories gracefully.
</Warning>

Category names beginning with `_` are free for custom use (e.g., `_my_custom_category`). Category names that do not begin with `_` are reserved for the ACP spec.

| Category        | Description                      |
| --------------- | -------------------------------- |
| `mode`          | Session mode selector            |
| `model`         | Model selector                   |
| `thought_level` | Thought/reasoning level selector |

When multiple options share the same category, Clients **SHOULD** use the array ordering to resolve ties, preferring earlier options in the list for prominent placement or keyboard shortcuts.

## Option Ordering

The order of the `configOptions` array is significant. Agents **SHOULD** place higher-priority options first in the list.

Clients **SHOULD**:

* Display options in the order provided by the Agent
* Use ordering to resolve ties when multiple options share the same category
* If displaying a limited number of options, prefer those at the beginning of the list

## Default Values and Graceful Degradation

Agents **MUST** always provide a default value for every configuration option. This ensures the Agent can operate correctly even if:

* The Client doesn't support configuration options
* The Client chooses not to display certain options
* The Client receives an option type it doesn't recognize

If a Client receives an option with an unrecognized `type`, it **SHOULD** ignore that option. The Agent will continue using its default value.

## Setting a Config Option

The current value of a config option can be changed at any point during a session, whether the Agent is idle or generating a response.

### From the Client

Clients can change a config option value by calling the `session/set_config_option` method:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_config_option",
  "params": {
    "sessionId": "sess_abc123def456",
    "configId": "mode",
    "value": "code"
  }
}
```

<ParamField type="SessionId">
  The ID of the session
</ParamField>

<ParamField type="string">
  The `id` of the configuration option to change
</ParamField>

<ParamField type="string">
  The new value to set. Must be one of the values listed in the option's
  `options` array.
</ParamField>

The Agent **MUST** respond with the complete list of all configuration options and their current values:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "configOptions": [
      {
        "id": "mode",
        "name": "Session Mode",
        "type": "select",
        "currentValue": "code",
        "options": [...]
      },
      {
        "id": "model",
        "name": "Model",
        "type": "select",
        "currentValue": "model-1",
        "options": [...]
      }
    ]
  }
}
```

<Note>
  The response always contains the **complete** configuration state. This allows
  Agents to reflect dependent changes. For example, if changing the model
  affects available reasoning options, or if an option's available values change
  based on another selection.
</Note>

### From the Agent

The Agent can also change configuration options and notify the Client by sending a `config_options_update` session notification:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "config_options_update",
      "configOptions": [
        {
          "id": "mode",
          "name": "Session Mode",
          "type": "select",
          "currentValue": "code",
          "options": [...]
        },
        {
          "id": "model",
          "name": "Model",
          "type": "select",
          "currentValue": "model-2",
          "options": [...]
        }
      ]
    }
  }
}
```

This notification also contains the complete configuration state. Common reasons an Agent might update configuration options include:

* Switching modes after completing a planning phase
* Falling back to a different model due to rate limits or errors
* Adjusting available options based on context discovered during execution

## Relationship to Session Modes

Session Config Options supersede the older [Session Modes](./session-modes) API. However, during the transition period, Agents that provide mode-like configuration **SHOULD** send both:

* `configOptions` with a `category: "mode"` option for Clients that support config options
* `modes` for Clients that only support the older API

If an Agent provides both `configOptions` and `modes` in the session response:

* Clients that support config options **SHOULD** use `configOptions` exclusively and ignore `modes`
* Clients that don't support config options **SHOULD** fall back to `modes`
* Agents **SHOULD** keep both in sync to ensure consistent behavior regardless of which field the Client uses

<Card icon="gears" href="../session-modes">
  Learn about the Session Modes API
</Card>


# Session Modes
Source: https://agentclientprotocol.com/protocol/session-modes

Switch between different agent operating modes

<Note>
  You can now use [Session Config Options](./session-config-options). Dedicated
  session mode methods will be removed in a future version of the protocol.
  Until then, you can offer both to clients for backwards compatibility.
</Note>

Agents can provide a set of modes they can operate in. Modes often affect the system prompts used, the availability of tools, and whether they request permission before running.

## Initial state

During [Session Setup](./session-setup) the Agent **MAY** return a list of modes it can operate in and the currently active mode:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "modes": {
      "currentModeId": "ask",
      "availableModes": [
        {
          "id": "ask",
          "name": "Ask",
          "description": "Request permission before making any changes"
        },
        {
          "id": "architect",
          "name": "Architect",
          "description": "Design and plan software systems without implementation"
        },
        {
          "id": "code",
          "name": "Code",
          "description": "Write and modify code with full tool access"
        }
      ]
    }
  }
}
```

<ResponseField name="modes" type="SessionModeState">
  The current mode state for the session
</ResponseField>

### SessionModeState

<ResponseField name="currentModeId" type="SessionModeId">
  The ID of the mode that is currently active
</ResponseField>

<ResponseField name="availableModes" type="SessionMode[]">
  The set of modes that the Agent can operate in
</ResponseField>

### SessionMode

<ResponseField name="id" type="SessionModeId">
  Unique identifier for this mode
</ResponseField>

<ResponseField name="name" type="string">
  Human-readable name of the mode
</ResponseField>

<ResponseField name="description" type="string">
  Optional description providing more details about what this mode does
</ResponseField>

## Setting the current mode

The current mode can be changed at any point during a session, whether the Agent is idle or generating a response.

### From the Client

Typically, Clients display the available modes to the user and allow them to change the current one, which they can do by calling the [`session/set_mode`](./schema#session%2Fset-mode) method.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_mode",
  "params": {
    "sessionId": "sess_abc123def456",
    "modeId": "code"
  }
}
```

<ParamField type="SessionId">
  The ID of the session to set the mode for
</ParamField>

<ParamField type="SessionModeId">
  The ID of the mode to switch to. Must be one of the modes listed in
  `availableModes`
</ParamField>

### From the Agent

The Agent can also change its own mode and let the Client know by sending the `current_mode_update` session notification:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "current_mode_update",
      "modeId": "code"
    }
  }
}
```

#### Exiting plan modes

A common case where an Agent might switch modes is from within a special "exit mode" tool that can be provided to the language model during plan/architect modes. The language model can call this tool when it determines it's ready to start implementing a solution.

This "switch mode" tool will usually request permission before running, which it can do just like any other tool:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "toolCall": {
      "toolCallId": "call_switch_mode_001",
      "title": "Ready for implementation",
      "kind": "switch_mode",
      "status": "pending",
      "content": [
        {
          "type": "text",
          "text": "## Implementation Plan..."
        }
      ]
    },
    "options": [
      {
        "optionId": "code",
        "name": "Yes, and auto-accept all actions",
        "kind": "allow_always"
      },
      {
        "optionId": "ask",
        "name": "Yes, and manually accept actions",
        "kind": "allow_once"
      },
      {
        "optionId": "reject",
        "name": "No, stay in architect mode",
        "kind": "reject_once"
      }
    ]
  }
}
```

When an option is chosen, the tool runs, setting the mode and sending the `current_mode_update` notification mentioned above.

<Card icon="shield-check" href="./tool-calls#requesting-permission">
  Learn more about permission requests
</Card>


# Session Setup
Source: https://agentclientprotocol.com/protocol/session-setup

Creating and loading sessions

Sessions represent a specific conversation or thread between the [Client](./overview#client) and [Agent](./overview#agent). Each session maintains its own context, conversation history, and state, allowing multiple independent interactions with the same Agent.

Before creating a session, Clients **MUST** first complete the [initialization](./initialization) phase to establish protocol compatibility and capabilities.

<br />

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent

    Note over Agent,Client: Initialized

    alt
        Client->>Agent: session/new
        Note over Agent: Create session context
        Note over Agent: Connect to MCP servers
        Agent-->>Client: session/new response (sessionId)
    else
        Client->>Agent: session/load (sessionId)
        Note over Agent: Restore session context
        Note over Agent: Connect to MCP servers
        Note over Agent,Client: Replay conversation history...
        Agent->>Client: session/update
        Agent->>Client: session/update
        Note over Agent,Client: All content streamed
        Agent-->>Client: session/load response
    end

    Note over Client,Agent: Ready for prompts
```

<br />

## Creating a Session

Clients create a new session by calling the `session/new` method with:

* The [working directory](#working-directory) for the session
* A list of [MCP servers](#mcp-servers) the Agent should connect to

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"],
        "env": []
      }
    ]
  }
}
```

The Agent **MUST** respond with a unique [Session ID](#session-id) that identifies this conversation:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456"
  }
}
```

## Loading Sessions

Agents that support the `loadSession` capability allow Clients to resume previous conversations. This feature enables persistence across restarts and sharing sessions between different Client instances.

### Checking Support

Before attempting to load a session, Clients **MUST** verify that the Agent supports this capability by checking the `loadSession` field in the `initialize` response:

```json highlight={7} theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true
    }
  }
}
```

If `loadSession` is `false` or not present, the Agent does not support loading sessions and Clients **MUST NOT** attempt to call `session/load`.

### Loading a Session

To load an existing session, Clients **MUST** call the `session/load` method with:

* The [Session ID](#session-id) to resume
* [MCP servers](#mcp-servers) to connect to
* The [working directory](#working-directory)

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/load",
  "params": {
    "sessionId": "sess_789xyz",
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--mode", "filesystem"],
        "env": []
      }
    ]
  }
}
```

The Agent **MUST** replay the entire conversation to the Client in the form of `session/update` notifications (like `session/prompt`).

For example, a user message from the conversation history:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_789xyz",
    "update": {
      "sessionUpdate": "user_message_chunk",
      "content": {
        "type": "text",
        "text": "What's the capital of France?"
      }
    }
  }
}
```

Followed by the agent's response:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_789xyz",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "The capital of France is Paris."
      }
    }
  }
}
```

When **all** the conversation entries have been streamed to the Client, the Agent **MUST** respond to the original `session/load` request.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": null
}
```

The Client can then continue sending prompts as if the session was never interrupted.

## Session ID

The session ID returned by `session/new` is a unique identifier for the conversation context.

Clients use this ID to:

* Send prompt requests via `session/prompt`
* Cancel ongoing operations via `session/cancel`
* Load previous sessions via `session/load` (if the Agent supports the `loadSession` capability)

## Working Directory

The `cwd` (current working directory) parameter establishes the file system context for the session. This directory:

* **MUST** be an absolute path
* **MUST** be used for the session regardless of where the Agent subprocess was spawned
* **SHOULD** serve as a boundary for tool operations on the file system

## MCP Servers

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) allows Agents to access external tools and data sources. When creating a session, Clients **MAY** include connection details for MCP servers that the Agent should connect to.

MCP servers can be connected to using different transports. All Agents **MUST** support the stdio transport, while HTTP and SSE transports are optional capabilities that can be checked during initialization.

While they are not required to by the spec, new Agents **SHOULD** support the HTTP transport to ensure compatibility with modern MCP servers.

### Transport Types

#### Stdio Transport

All Agents **MUST** support connecting to MCP servers via stdio (standard input/output). This is the default transport mechanism.

<ParamField type="string">
  A human-readable identifier for the server
</ParamField>

<ParamField type="string">
  The absolute path to the MCP server executable
</ParamField>

<ParamField type="array">
  Command-line arguments to pass to the server
</ParamField>

<ParamField type="EnvVariable[]">
  Environment variables to set when launching the server

  <Expandable title="EnvVariable">
    <ParamField type="string">
      The name of the environment variable.
    </ParamField>

    <ParamField type="string">
      The value of the environment variable.
    </ParamField>
  </Expandable>
</ParamField>

Example stdio transport configuration:

```json theme={null}
{
  "name": "filesystem",
  "command": "/path/to/mcp-server",
  "args": ["--stdio"],
  "env": [
    {
      "name": "API_KEY",
      "value": "secret123"
    }
  ]
}
```

#### HTTP Transport

When the Agent supports `mcpCapabilities.http`, Clients can specify MCP servers configurations using the HTTP transport.

<ParamField type="string">
  Must be `"http"` to indicate HTTP transport
</ParamField>

<ParamField type="string">
  A human-readable identifier for the server
</ParamField>

<ParamField type="string">
  The URL of the MCP server
</ParamField>

<ParamField type="HttpHeader[]">
  HTTP headers to include in requests to the server

  <Expandable title="HttpHeader">
    <ParamField type="string">
      The name of the HTTP header.
    </ParamField>

    <ParamField type="string">
      The value to set for the HTTP header.
    </ParamField>
  </Expandable>
</ParamField>

Example HTTP transport configuration:

```json theme={null}
{
  "type": "http",
  "name": "api-server",
  "url": "https://api.example.com/mcp",
  "headers": [
    {
      "name": "Authorization",
      "value": "Bearer token123"
    },
    {
      "name": "Content-Type",
      "value": "application/json"
    }
  ]
}
```

#### SSE Transport

When the Agent supports `mcpCapabilities.sse`, Clients can specify MCP servers configurations using the SSE transport.

<Warning>This transport was deprecated by the MCP spec.</Warning>

<ParamField type="string">
  Must be `"sse"` to indicate SSE transport
</ParamField>

<ParamField type="string">
  A human-readable identifier for the server
</ParamField>

<ParamField type="string">
  The URL of the SSE endpoint
</ParamField>

<ParamField type="HttpHeader[]">
  HTTP headers to include when establishing the SSE connection

  <Expandable title="HttpHeader">
    <ParamField type="string">
      The name of the HTTP header.
    </ParamField>

    <ParamField type="string">
      The value to set for the HTTP header.
    </ParamField>
  </Expandable>
</ParamField>

Example SSE transport configuration:

```json theme={null}
{
  "type": "sse",
  "name": "event-stream",
  "url": "https://events.example.com/mcp",
  "headers": [
    {
      "name": "X-API-Key",
      "value": "apikey456"
    }
  ]
}
```

### Checking Transport Support

Before using HTTP or SSE transports, Clients **MUST** verify the Agent's capabilities during initialization:

```json highlight={7-10} theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "mcpCapabilities": {
        "http": true,
        "sse": true
      }
    }
  }
}
```

If `mcpCapabilities.http` is `false` or not present, the Agent does not support HTTP transport.
If `mcpCapabilities.sse` is `false` or not present, the Agent does not support SSE transport.

Agents **SHOULD** connect to all MCP servers specified by the Client.

Clients **MAY** use this ability to provide tools directly to the underlying language model by including their own MCP server.


# Slash Commands
Source: https://agentclientprotocol.com/protocol/slash-commands

Advertise available slash commands to clients

Agents can advertise a set of slash commands that users can invoke. These commands provide quick access to specific agent capabilities and workflows. Commands are run as part of regular [prompt](./prompt-turn) requests where the Client includes the command text in the prompt.

## Advertising commands

After creating a session, the Agent **MAY** send a list of available commands via the `available_commands_update` session notification:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "available_commands_update",
      "availableCommands": [
        {
          "name": "web",
          "description": "Search the web for information",
          "input": {
            "hint": "query to search for"
          }
        },
        {
          "name": "test",
          "description": "Run tests for the current project"
        },
        {
          "name": "plan",
          "description": "Create a detailed implementation plan",
          "input": {
            "hint": "description of what to plan"
          }
        }
      ]
    }
  }
}
```

<ResponseField name="availableCommands" type="AvailableCommand[]">
  The list of commands available in this session
</ResponseField>

### AvailableCommand

<ResponseField name="name" type="string">
  The command name (e.g., "web", "test", "plan")
</ResponseField>

<ResponseField name="description" type="string">
  Human-readable description of what the command does
</ResponseField>

<ResponseField name="input" type="AvailableCommandInput">
  Optional input specification for the command
</ResponseField>

### AvailableCommandInput

Currently supports unstructured text input:

<ResponseField name="hint" type="string">
  A hint to display when the input hasn't been provided yet
</ResponseField>

## Dynamic updates

The Agent can update the list of available commands at any time during a session by sending another `available_commands_update` notification. This allows commands to be added based on context, removed when no longer relevant, or modified with updated descriptions.

## Running commands

Commands are included as regular user messages in prompt requests:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      {
        "type": "text",
        "text": "/web agent client protocol"
      }
    ]
  }
}
```

The Agent recognizes the command prefix and processes it accordingly. Commands may be accompanied by any other user message content types (images, audio, etc.) in the same prompt array.


# Terminals
Source: https://agentclientprotocol.com/protocol/terminals

Executing and managing terminal commands

The terminal methods allow Agents to execute shell commands within the Client's environment. These methods enable Agents to run build processes, execute scripts, and interact with command-line tools while providing real-time output streaming and process control.

## Checking Support

Before attempting to use terminal methods, Agents **MUST** verify that the Client supports this capability by checking the [Client Capabilities](./initialization#client-capabilities) field in the `initialize` response:

```json highlight={7} theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "terminal": true
    }
  }
}
```

If `terminal` is `false` or not present, the Agent **MUST NOT** attempt to call any terminal methods.

## Executing Commands

The `terminal/create` method starts a command in a new terminal:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "terminal/create",
  "params": {
    "sessionId": "sess_abc123def456",
    "command": "npm",
    "args": ["test", "--coverage"],
    "env": [
      {
        "name": "NODE_ENV",
        "value": "test"
      }
    ],
    "cwd": "/home/user/project",
    "outputByteLimit": 1048576
  }
}
```

<ParamField type="SessionId">
  The [Session ID](./session-setup#session-id) for this request
</ParamField>

<ParamField type="string">
  The command to execute
</ParamField>

<ParamField type="string[]">
  Array of command arguments
</ParamField>

<ParamField type="EnvVariable[]">
  Environment variables for the command.

  Each variable has:

  * `name`: The environment variable name
  * `value`: The environment variable value
</ParamField>

<ParamField type="string">
  Working directory for the command (absolute path)
</ParamField>

<ParamField type="number">
  Maximum number of output bytes to retain. Once exceeded, earlier output is
  truncated to stay within this limit.

  When the limit is exceeded, the Client truncates from the beginning of the output
  to stay within the limit.

  The Client **MUST** ensure truncation happens at a character boundary to maintain valid
  string output, even if this means the retained output is slightly less than the
  specified limit.
</ParamField>

The Client returns a Terminal ID immediately without waiting for completion:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "terminalId": "term_xyz789"
  }
}
```

This allows the command to run in the background while the Agent performs other operations.

After creating the terminal, the Agent can use the `terminal/wait_for_exit` method to wait for the command to complete.

<Note>
  The Agent **MUST** release the terminal using `terminal/release` when it's no
  longer needed.
</Note>

## Embedding in Tool Calls

Terminals can be embedded directly in [tool calls](./tool-calls) to provide real-time output to users:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_002",
      "title": "Running tests",
      "kind": "execute",
      "status": "in_progress",
      "content": [
        {
          "type": "terminal",
          "terminalId": "term_xyz789"
        }
      ]
    }
  }
}
```

When a terminal is embedded in a tool call, the Client displays live output as it's generated and continues to display it even after the terminal is released.

## Getting Output

The `terminal/output` method retrieves the current terminal output without waiting for the command to complete:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "terminal/output",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

The Client responds with the current output and exit status (if the command has finished):

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "output": "Running tests...\n✓ All tests passed (42 total)\n",
    "truncated": false,
    "exitStatus": {
      "exitCode": 0,
      "signal": null
    }
  }
}
```

<ResponseField name="output" type="string">
  The terminal output captured so far
</ResponseField>

<ResponseField name="truncated" type="boolean">
  Whether the output was truncated due to byte limits
</ResponseField>

<ResponseField name="exitStatus" type="TerminalExitStatus">
  Present only if the command has exited. Contains:

  * `exitCode`: The process exit code (may be null)
  * `signal`: The signal that terminated the process (may be null)
</ResponseField>

## Waiting for Exit

The `terminal/wait_for_exit` method returns once the command completes:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "terminal/wait_for_exit",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

The Client responds once the command exits:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "exitCode": 0,
    "signal": null
  }
}
```

<ResponseField name="exitCode" type="number">
  The process exit code (may be null if terminated by signal)
</ResponseField>

<ResponseField name="signal" type="string">
  The signal that terminated the process (may be null if exited normally)
</ResponseField>

## Killing Commands

The `terminal/kill` method terminates a command without releasing the terminal:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "terminal/kill",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

After killing a command, the terminal remains valid and can be used with:

* `terminal/output` to get the final output
* `terminal/wait_for_exit` to get the exit status

The Agent **MUST** still call `terminal/release` when it's done using it.

### Building a Timeout

Agents can implement command timeouts by combining terminal methods:

1. Create a terminal with `terminal/create`
2. Start a timer for the desired timeout duration
3. Concurrently wait for either the timer to expire or `terminal/wait_for_exit` to return
4. If the timer expires first:
   * Call `terminal/kill` to terminate the command
   * Call `terminal/output` to retrieve any final output
   * Include the output in the response to the model
5. Call `terminal/release` when done

## Releasing Terminals

The `terminal/release` kills the command if still running and releases all resources:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "terminal/release",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

After release the terminal ID becomes invalid for all other `terminal/*` methods.

If the terminal was added to a tool call, the client **SHOULD** continue to display its output after release.


# Tool Calls
Source: https://agentclientprotocol.com/protocol/tool-calls

How Agents report tool call execution

Tool calls represent actions that language models request Agents to perform during a [prompt turn](./prompt-turn). When an LLM determines it needs to interact with external systems—like reading files, running code, or fetching data—it generates tool calls that the Agent executes on its behalf.

Agents report tool calls through [`session/update`](./prompt-turn#3-agent-reports-output) notifications, allowing Clients to display real-time progress and results to users.

While Agents handle the actual execution, they may leverage Client capabilities like [permission requests](#requesting-permission) or [file system access](./file-system) to provide a richer, more integrated experience.

## Creating

When the language model requests a tool invocation, the Agent **SHOULD** report it to the Client:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Reading configuration file",
      "kind": "read",
      "status": "pending"
    }
  }
}
```

<ParamField type="ToolCallId">
  A unique identifier for this tool call within the session
</ParamField>

<ParamField type="string">
  A human-readable title describing what the tool is doing
</ParamField>

<ParamField type="ToolKind">
  The category of tool being invoked.

  <Expandable title="kinds">
    * `read` - Reading files or data - `edit` - Modifying files or content -
      `delete` - Removing files or data - `move` - Moving or renaming files -
      `search` - Searching for information - `execute` - Running commands or code -
      `think` - Internal reasoning or planning - `fetch` - Retrieving external data
    * `other` - Other tool types (default)
  </Expandable>

  Tool kinds help Clients choose appropriate icons and optimize how they display tool execution progress.
</ParamField>

<ParamField type="ToolCallStatus">
  The current [execution status](#status) (defaults to `pending`)
</ParamField>

<ParamField type="ToolCallContent[]">
  [Content produced](#content) by the tool call
</ParamField>

<ParamField type="ToolCallLocation[]">
  [File locations](#following-the-agent) affected by this tool call
</ParamField>

<ParamField type="object">
  The raw input parameters sent to the tool
</ParamField>

<ParamField type="object">
  The raw output returned by the tool
</ParamField>

## Updating

As tools execute, Agents send updates to report progress and results.

Updates use the `session/update` notification with `tool_call_update`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "in_progress",
      "content": [
        {
          "type": "content",
          "content": {
            "type": "text",
            "text": "Found 3 configuration files..."
          }
        }
      ]
    }
  }
}
```

All fields except `toolCallId` are optional in updates. Only the fields being changed need to be included.

## Requesting Permission

The Agent **MAY** request permission from the user before executing a tool call by calling the `session/request_permission` method:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "toolCall": {
      "toolCallId": "call_001"
    },
    "options": [
      {
        "optionId": "allow-once",
        "name": "Allow once",
        "kind": "allow_once"
      },
      {
        "optionId": "reject-once",
        "name": "Reject",
        "kind": "reject_once"
      }
    ]
  }
}
```

<ParamField type="SessionId">
  The session ID for this request
</ParamField>

<ParamField type="ToolCallUpdate">
  The tool call update containing details about the operation
</ParamField>

<ParamField type="PermissionOption[]">
  Available [permission options](#permission-options) for the user to choose
  from
</ParamField>

The Client responds with the user's decision:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow-once"
    }
  }
}
```

Clients **MAY** automatically allow or reject permission requests according to the user settings.

If the current prompt turn gets [cancelled](./prompt-turn#cancellation), the Client **MUST** respond with the `"cancelled"` outcome:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "outcome": {
      "outcome": "cancelled"
    }
  }
}
```

<ResponseField name="outcome" type="RequestPermissionOutcome">
  The user's decision, either: - `cancelled` - The [prompt turn was
  cancelled](./prompt-turn#cancellation) - `selected` with an `optionId` - The
  ID of the selected permission option
</ResponseField>

### Permission Options

Each permission option provided to the Client contains:

<ParamField type="string">
  Unique identifier for this option
</ParamField>

<ParamField type="string">
  Human-readable label to display to the user
</ParamField>

<ParamField type="PermissionOptionKind">
  A hint to help Clients choose appropriate icons and UI treatment for each option.

  * `allow_once` - Allow this operation only this time
  * `allow_always` - Allow this operation and remember the choice
  * `reject_once` - Reject this operation only this time
  * `reject_always` - Reject this operation and remember the choice
</ParamField>

## Status

Tool calls progress through different statuses during their lifecycle:

<ResponseField name="pending">
  The tool call hasn't started running yet because the input is either streaming
  or awaiting approval
</ResponseField>

<ResponseField name="in_progress">
  The tool call is currently running
</ResponseField>

<ResponseField name="completed">
  The tool call completed successfully
</ResponseField>

<ResponseField name="failed">The tool call failed with an error</ResponseField>

## Content

Tool calls can produce different types of content:

### Regular Content

Standard [content blocks](./content) like text, images, or resources:

```json theme={null}
{
  "type": "content",
  "content": {
    "type": "text",
    "text": "Analysis complete. Found 3 issues."
  }
}
```

### Diffs

File modifications shown as diffs:

```json theme={null}
{
  "type": "diff",
  "path": "/home/user/project/src/config.json",
  "oldText": "{\n  \"debug\": false\n}",
  "newText": "{\n  \"debug\": true\n}"
}
```

<ParamField type="string">
  The absolute file path being modified
</ParamField>

<ParamField type="string">
  The original content (null for new files)
</ParamField>

<ParamField type="string">
  The new content after modification
</ParamField>

### Terminals

Live terminal output from command execution:

```json theme={null}
{
  "type": "terminal",
  "terminalId": "term_xyz789"
}
```

<ParamField type="string">
  The ID of a terminal created with `terminal/create`
</ParamField>

When a terminal is embedded in a tool call, the Client displays live output as it's generated and continues to display it even after the terminal is released.

<Card icon="terminal" href="./terminals">
  Learn more about Terminals
</Card>

## Following the Agent

Tool calls can report file locations they're working with, enabling Clients to implement "follow-along" features that track which files the Agent is accessing or modifying in real-time.

```json theme={null}
{
  "path": "/home/user/project/src/main.py",
  "line": 42
}
```

<ParamField type="string">
  The absolute file path being accessed or modified
</ParamField>

<ParamField type="number">
  Optional line number within the file
</ParamField>


# Transports
Source: https://agentclientprotocol.com/protocol/transports

Mechanisms for agents and clients to communicate with each other

ACP uses JSON-RPC to encode messages. JSON-RPC messages **MUST** be UTF-8 encoded.

The protocol currently defines the following transport mechanisms for agent-client communication:

1. [stdio](#stdio), communication over standard in and standard out
2. *[Streamable HTTP](#streamable-http) (draft proposal in progress)*

Agents and clients **SHOULD** support stdio whenever possible.

It is also possible for agents and clients to implement [custom transports](#custom-transports).

## stdio

In the **stdio** transport:

* The client launches the agent as a subprocess.
* The agent reads JSON-RPC messages from its standard input (`stdin`) and sends messages to its standard output (`stdout`).
* Messages are individual JSON-RPC requests, notifications, or responses.
* Messages are delimited by newlines (`\n`), and **MUST NOT** contain embedded newlines.
* The agent **MAY** write UTF-8 strings to its standard error (`stderr`) for logging purposes. Clients **MAY** capture, forward, or ignore this logging.
* The agent **MUST NOT** write anything to its `stdout` that is not a valid ACP message.
* The client **MUST NOT** write anything to the agent's `stdin` that is not a valid ACP message.

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent Process

    Client->>+Agent Process: Launch subprocess
    loop Message Exchange
        Client->>Agent Process: Write to stdin
        Agent Process->>Client: Write to stdout
        Agent Process--)Client: Optional logs on stderr
    end
    Client->>Agent Process: Close stdin, terminate subprocess
    deactivate Agent Process
```

## *Streamable HTTP*

*In discussion, draft proposal in progress.*

## Custom Transports

Agents and clients **MAY** implement additional custom transport mechanisms to suit their specific needs. The protocol is transport-agnostic and can be implemented over any communication channel that supports bidirectional message exchange.

Implementers who choose to support custom transports **MUST** ensure they preserve the JSON-RPC message format and lifecycle requirements defined by ACP. Custom transports **SHOULD** document their specific connection establishment and message exchange patterns to aid interoperability.


# Requests for Dialog (RFDs)
Source: https://agentclientprotocol.com/rfds/about

Our process for introducing changes to the protocol

A "Request for Dialog" (RFD) is ACP's version of the RFC process. RFDs are the primary mechanism for proposing new features, collecting community input on an issue, and documenting design decisions.

## When to write an RFD

You should consider writing an RFD if you intend to make a "substantial" change to ACP or its documentation. What constitutes a "substantial" change is evolving based on community norms and varies depending on what part of the ecosystem you are proposing to change.

Some changes do not require an RFD:

* Rephrasing, reorganizing or refactoring
* Addition or removal of warnings
* Additions that strictly improve objective, numerical quality criteria (speedup, better browser support)
* Fixing objectively incorrect behavior

## The RFD Process

### 1. Propose by opening a PR

[Fork the repo](https://github.com/agentclientprotocol/agent-client-protocol) and copy `docs/rfds/TEMPLATE.md` to `docs/rfds/my-feature.md` (using kebab-case naming). The RFD can start minimal - just an elevator pitch and status quo are enough to begin dialog. Pull requests become the discussion forum where ideas get refined through collaborative iteration.

### 2. Merge to "Draft" when championed

RFD proposals are merged into the "Draft" section if a core team member decides to champion them. The champion becomes the point-of-contact and will work with authors to make it reality. Once in draft, implementation may begin (properly feature-gated with the RFD name). Implementation can also begin at a particular SDK or agent/client level to prove out the design for better review and feedback before broader adoption.

RFDs are living documents that track implementation progress. PRs working towards an RFC will typically update it to reflect changes in design or direction.

### 2b. Move to "To be removed"

RFDs that have never landed may be closed at the discretion of a core team member. RFDs that have landed in draft form are moved to "To be removed" instead until there has been time to remove them fully from the codebase, then they are removed entirely.

### 3. Move to "Preview" when fully implemented

When the champion feels the RFD is ready for broader review, they open a PR to move it to "Preview." This signals the community to provide feedback. The PR stays open for a few days before the champion decides whether to land it.

### 4. Completed

Once in preview, the RFD can be moved to "completed" with a final PR. The core team should comment and express concerns, but **final decision is always made by the core team lead**. Depending on what the RFD is about, "completed" is the only state that can represent a 1-way door (if there is a stability commitment involved), as changes might require a breaking change to the protocol after this point.

Preview RFDs don't have to be completed. They may also go back to draft to await further changes or even be moved to "To be removed".

### 5. Implementation and completion

#### RFD Lifecycle

* **Early drafts**: Initial ideas, brainstorming, early exploration
* **Mature drafts**: Well-formed proposals ready for broader review
* **Accepted**: Approved for implementation, may reference implementation work
* **To be removed (yet?)**: Decided against for now, but preserved for future consideration
* **Completed**: Implementation finished and merged

## Governance

The project currently has a design team with the [Zed team as the lead (BDFL)](../community/governance). Champions from the core team guide RFDs through the process, but final decisions rest with the team lead. This structure maintains velocity while anticipating future governance expansion.

## Discussion and Moderation

Detailed discussions often happen on [Zulip](https://agentclientprotocol.zulipchat.com/), with PR comments for process decisions. The results of detailed discussions should be incorporated into the relevant RFD. RFD champions actively curate discussions by collecting questions in the FAQ section. If PR discussions become too long, they should be closed, feedback summarized, and reopened with links to the original.

## Licensing

All RFDs are licensed under Apache 2.0. The project remains open source.

##


# ACP Agent Registry
Source: https://agentclientprotocol.com/rfds/acp-agent-registry



**Author:** [@ignatov](https://github.com/ignatov)
**Champion:** [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

ACP needs a single, trusted registry of agents so clients can discover integrations, understand their capabilities, and configure them automatically. This RFD proposes (1) a canonical manifest format that every agent must publish, (2) a dedicated `agentclientprotocol/registry` repo where maintainers contribute those manifests, and (3) tooling that aggregates and publishes a searchable catalog for editors and other clients.

## Status quo

There is no canonical listing of ACP-compatible agents. Information lives in scattered READMEs or proprietary feeds, which makes it hard to:

* Let users discover agents directly inside ACP-aware clients.
* Ensure protocol-version compatibility or capability coverage.
* Keep metadata consistent (hosting model, license, etc.).

Every editor builds bespoke manifests or scrapes GitHub, leading to duplication and stale data.

## Agent manifest format (core proposal)

Each agent advertises itself via a manifest stored as `<id>/agent.json` in the registry repo.

Fields marked with **\*** are required:

| Field                 | Description                                                                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` **\***           | Unique agent identifier. Lowercase letters, digits, and hyphens; must start with a letter (pattern: `^[a-z][a-z0-9-]*$`). Also the folder name in the registry repo.                                                                                                             |
| `name` **\***         | Human-readable display name.                                                                                                                                                                                                                                                     |
| `version` **\***      | Semantic version of the agent release (e.g. `1.0.0`).                                                                                                                                                                                                                            |
| `description` **\***  | Brief description of the agent's functionality and purpose.                                                                                                                                                                                                                      |
| `distribution` **\*** | Object describing how to obtain and run the agent. Supports three distribution types: `binary` (platform-specific archives), `npx` (Node packages), and `uvx` (Python packages). At least one distribution type must be provided. See [Distribution](#distribution) for details. |
| `repository`          | Source code repository URL.                                                                                                                                                                                                                                                      |
| `authors`             | Array of author/organization names.                                                                                                                                                                                                                                              |
| `license`             | SPDX license identifier or `"proprietary"`.                                                                                                                                                                                                                                      |
| `icon`                | Path to icon file (relative path or absolute URL). Must be SVG format, 16×16, monochrome using `currentColor` (enables light/dark theme adaptation). See [Icon requirements](#icon-requirements).                                                                                |

### Distribution

The `distribution` object supports three mutually independent strategies. An agent may provide one or more:

#### `binary`

Platform-specific archive downloads. Keyed by `<os>-<arch>` targets:

| Target            | OS      | Architecture |
| ----------------- | ------- | ------------ |
| `darwin-aarch64`  | macOS   | ARM64        |
| `darwin-x86_64`   | macOS   | x86-64       |
| `linux-aarch64`   | Linux   | ARM64        |
| `linux-x86_64`    | Linux   | x86-64       |
| `windows-aarch64` | Windows | ARM64        |
| `windows-x86_64`  | Windows | x86-64       |

When using `binary` distribution, builds **must be provided for all three operating systems** (darwin, linux, windows). CI will reject entries that only cover a subset.

Each target is an object with:

| Field     | Required | Description                         |
| --------- | -------- | ----------------------------------- |
| `archive` | Yes      | URL to download archive             |
| `cmd`     | Yes      | Command to execute after extraction |
| `args`    | No       | Array of command-line arguments     |
| `env`     | No       | Object of environment variables     |

#### `npx` / `uvx`

Package-manager-based distribution (Node via `npx`, Python via `uvx`). Each is an object with:

| Field     | Required | Description                               |
| --------- | -------- | ----------------------------------------- |
| `package` | Yes      | Package name (with optional version spec) |
| `args`    | No       | Array of command-line arguments           |
| `env`     | No       | Object of environment variables           |

### Icon requirements

Icons must meet the following requirements to pass CI validation:

* **SVG format** — only `.svg` files are accepted.
* **16×16 dimensions** — via `width`/`height` attributes or `viewBox`.
* **Monochrome using `currentColor`** — all `fill` and `stroke` values must use `currentColor` or `none`. Hardcoded colors (e.g. `fill="#FF5500"`, `fill="red"`) are rejected.

Using `currentColor` lets icons adapt automatically to the client's light or dark theme.

### Example: binary distribution

```jsonc theme={null}
{
  "id": "someagent",
  "name": "SomeAgent",
  "version": "1.0.0",
  "description": "Agent for code editing",
  "repository": "https://github.com/example/someagent",
  "authors": ["Example Team"],
  "license": "MIT",
  "icon": "icon.svg",
  "distribution": {
    "binary": {
      "darwin-aarch64": {
        "archive": "https://github.com/example/someagent/releases/latest/download/someagent-darwin-arm64.zip",
        "cmd": "./someagent",
        "args": ["acp"],
      },
      "darwin-x86_64": {
        "archive": "https://github.com/example/someagent/releases/latest/download/someagent-darwin-x64.zip",
        "cmd": "./someagent",
        "args": ["acp"],
      },
      "linux-aarch64": {
        "archive": "https://github.com/example/someagent/releases/latest/download/someagent-linux-arm64.zip",
        "cmd": "./someagent",
        "args": ["acp"],
      },
      "linux-x86_64": {
        "archive": "https://github.com/example/someagent/releases/latest/download/someagent-linux-x64.zip",
        "cmd": "./someagent",
        "args": ["acp"],
      },
      "windows-x86_64": {
        "archive": "https://github.com/example/someagent/releases/latest/download/someagent-windows-x64.zip",
        "cmd": "./someagent.exe",
        "args": ["acp"],
        "env": {
          "SOMEAGENT_MODE_KEY": "",
        },
      },
    },
  },
}
```

### Example: package distribution

```jsonc theme={null}
{
  "id": "pyagent",
  "name": "PyAgent",
  "version": "2.1.0",
  "description": "A Python-based ACP agent",
  "repository": "https://github.com/example/pyagent",
  "license": "Apache-2.0",
  "distribution": {
    "uvx": {
      "package": "pyagent@latest",
      "args": ["--mode", "acp"],
    },
  },
}
```

## Registry schema

The aggregated `registry.json` file conforms to the registry schema and contains:

| Field     | Description                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `version` | Registry schema version (semver, e.g. `1.0.0`).                                                           |
| `agents`  | Array of agent entries (each following the agent manifest schema above, sourced from `agent.json` files). |

## Authentication requirements

To be listed in the registry, an agent **must support at least one** of the following authentication methods:

* **Agent Auth** — the agent handles the OAuth flow independently (opens the user's browser, runs a local callback server, exchanges the authorization code for tokens).
* **Terminal Auth** — the agent provides an interactive terminal-based setup experience (launched with additional args/env specified in the auth method).

CI verifies this by checking that the agent returns an `authMethods` array in its `initialize` response, with at least one method. See the [ACP auth methods RFD](./auth-methods) for the full specification.

## What we propose to do about it

1. **Manifest spec** (above) becomes normative; we publish the JSON Schema and validator script so maintainers can lint locally.
2. **Registry repository** `github.com/agentclientprotocol/registry`:
   * Structure: `<id>/agent.json`, optional `icon.svg`, optional `README.md`.
   * CI validates manifests on every PR: schema compliance, slug uniqueness, icon format (16×16 SVG, monochrome `currentColor`), URL accessibility for all distribution URLs, authentication support via ACP handshake, and binary OS coverage.
   * Push to `main` triggers a build that aggregates all entries into `registry.json` and publishes versioned + `latest` GitHub releases.
3. **Aggregated outputs**:
   * `registry.json`: deterministic list of all agents with icons copied to `dist/<id>.svg`.
4. **Distribution & search**:
   * Clients fetch `registry.json` from `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`.
   * Static site offers filters for deployment model, license, and distribution type.

## Shiny future

* Agent maintainers make PRs to update their manifests; CI keeps data clean.
* Automated version updates run hourly, checking npm, PyPI, and GitHub releases for new versions of registered agents and opening PRs automatically.
* Editors/clients can bootstrap ACP support by fetching one JSON file and filtering locally.
* The ACP website displays the same data for humans, ensuring consistency.
* Package-based distribution (`npx`, `uvx`) lowers the barrier for agents that don't need platform-specific binaries.

## Implementation details and plan

**Phase 1 – Spec & repo bootstrap**

* Finalize JSON Schema and documentation.
* Create registry repo with CI (GitHub Actions) that validates on PRs and publishes on merge.
* Seed with reference agents.
* Implement automated version update workflow (hourly cron via GitHub Actions).
* Enforce authentication requirements via CI handshake verification.

## Revision history

* 2025-11-28: Initial draft.
* 2025-12-16: Minors.
* 2026-02-04: Updated to match latest schema — removed `schema_version`, `homepage`, `capabilities`, and `auth` fields; added `icon` field; restructured `distribution` into `binary`, `npx`, and `uvx` types.


# Agent Telemetry Export
Source: https://agentclientprotocol.com/rfds/agent-telemetry-export



* Author(s): [@codefromthecrypt](https://github.com/codefromthecrypt)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

Define how agents export telemetry (logs, metrics, traces) to clients without tunneling it over the ACP transport. Clients run a local telemetry receiver and pass standard OpenTelemetry environment variables when launching agents. This keeps telemetry out-of-band and enables editors to display agent activity, debug issues, and integrate with observability backends.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

ACP defines how clients launch agents as subprocesses and communicate over stdio. The [meta-propagation RFD](./meta-propagation) addresses trace context propagation via `params._meta`, enabling trace correlation. However, there is no convention for how agents should export the actual telemetry data (spans, metrics, logs).

Without a standard approach:

1. **No visibility into agent behavior** - Editors cannot display what agents are doing (token usage, tool calls, timing)
2. **Difficult debugging** - When agents fail, there's no structured way to capture diagnostics
3. **Fragmented solutions** - Each agent/client pair invents their own telemetry mechanism
4. **Credential exposure risk** - If agents need to send telemetry directly to backends, they need credentials

Tunneling telemetry over the ACP stdio transport is problematic:

* **Head-of-line blocking** - Telemetry traffic could delay agent messages
* **Implementation burden** - ACP would need to define telemetry message formats
* **Coupling** - Agents would need ACP-specific telemetry code instead of standard SDKs

## What we propose to do about it

> What are you proposing to improve the situation?

Clients that want to receive agent telemetry run a local OTLP (OpenTelemetry Protocol) receiver and inject environment variables when launching agent subprocesses:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=agent-name
```

Agents using OpenTelemetry SDKs auto-configure from these variables. The client's receiver can:

* Display telemetry in the editor UI (e.g., token counts, timing, errors)
* Forward telemetry to the client's configured observability backend
* Add client-side context before forwarding

This follows the [OpenTelemetry collector deployment pattern](https://opentelemetry.io/docs/collector/deployment/agent/) where a local receiver proxies telemetry to backends.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Client/Editor                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ ACP Handler  │    │OTLP Receiver │───▶│   Exporter   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└────────┬─────────────────────▲──────────────────┬──────────┘
         │ stdio               │ HTTP             │
         ▼                     │                  ▼
┌─────────────────────┐        │         ┌───────────────────┐
│ Agent Process       │        │         │ Observability     │
│  ┌──────────────┐   │        │         │ Backend           │
│  │ ACP Agent    │   │        │         └───────────────────┘
│  ├──────────────┤   │        │
│  │ OTEL SDK     │────────────┘
│  └──────────────┘   │
└─────────────────────┘
```

### Discovery

Environment variables must be set before launching the subprocess, but ACP capability exchange happens after connection. Options for discovery:

1. **Optimistic injection** - Clients inject OTEL environment variables unconditionally. Agents without OpenTelemetry support simply ignore them. This is pragmatic since environment variables are low-cost and OTEL SDKs handle misconfiguration gracefully.

2. **Registry metadata** - Agent registries (like the one proposed in PR #289) could include telemetry support in agent manifests, letting clients know ahead of time.

3. **Manual configuration** - Users configure their client to enable telemetry collection for specific agents.

## Shiny future

> How will things will play out once this feature exists?

1. **Editor integration** - Editors can show agent activity: token usage, tool call timing, model switches, errors
2. **Unified debugging** - When agents fail, structured telemetry is available for diagnosis
3. **End-to-end traces** - Combined with `params._meta` trace propagation, traces flow from client through agent to any downstream services
4. **No credential sharing** - Agents never see backend credentials; the client handles authentication
5. **Standard SDKs** - Agent authors use normal OpenTelemetry SDKs that work in any context, not ACP-specific code

## Implementation details

> Tell me more about your implementation. What is your detailed implementation plan?

### 1. Create `docs/protocol/observability.mdx`

Add a new protocol documentation page covering observability practices for ACP. This page will describe:

**For Clients/Editors:**

* Running an OTLP receiver to collect agent telemetry
* Injecting `OTEL_EXPORTER_*` environment variables when launching agent subprocesses
* Respecting user-configured `OTEL_*` variables (do not override if already set)
* Forwarding telemetry to configured backends with client credentials

**For Agent Authors:**

* Using OpenTelemetry SDKs with standard auto-configuration
* Recommended spans, metrics, and log patterns for agent operations
* How telemetry flows when `OTEL_*` variables are present vs absent

### 2. Update `docs/protocol/extensibility.mdx`

Add a section linking to the new observability doc, similar to how extensibility concepts relate to other protocol features. Add a brief mention that observability practices (telemetry export) are documented separately.

### 3. Update `docs/docs.json`

Add `protocol/observability` to the Protocol navigation group.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### How does this relate to trace propagation in `params._meta`?

They are complementary:

* **Trace propagation** (`params._meta` with `traceparent`, etc.) passes trace context so spans can be correlated
* **Telemetry export** (this RFD) defines where agents send the actual span/metric/log data

Both are needed for end-to-end observability.

### What if an agent doesn't use OpenTelemetry?

Agents without OTEL SDKs simply ignore the environment variables. No harm is done. Over time, as more agents adopt OpenTelemetry, the ecosystem benefits.

### What if the user already configured `OTEL_*` environment variables?

If `OTEL_*` variables are already set in the environment, clients should not override them. User-configured telemetry settings take precedence, allowing users to direct agent telemetry to their own backends when desired.

### Why not define ACP-specific telemetry messages?

This would duplicate OTLP functionality, add implementation burden to ACP, and force agent authors to use non-standard APIs. Using OTLP means agents work with standard tooling and documentation.

### What about agents that aren't launched as subprocesses?

This RFD focuses on the stdio transport where clients launch agents. For other transports (HTTP, etc.), agents would need alternative configuration mechanisms, which could be addressed in future RFDs.

### What alternative approaches did you consider, and why did you settle on this one?

1. **Tunneling telemetry over ACP** - Rejected due to head-of-line blocking concerns and implementation complexity
2. **Agents export directly to backends** - Rejected because it requires sharing credentials with agents
3. **File-based telemetry** - Rejected because it doesn't support real-time display and adds complexity

The environment variable approach:

* Uses existing standards (OTLP, OpenTelemetry SDK conventions)
* Keeps telemetry out-of-band from ACP messages
* Lets clients control where telemetry goes without exposing credentials
* Requires no changes to ACP message formats

## Revision history

* 2025-12-04: Initial draft


# Authentication Methods
Source: https://agentclientprotocol.com/rfds/auth-methods



Author(s): [anna239](https://github.com/anna239)

## Elevator pitch

> What are you proposing to change?

I suggest adding more information about auth methods that agent supports, which will allow clients to draw more appropriate UI.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Agents have different ways of authenticating users: env vars with api keys, running a command like `<agent_name> login`, some just open a browser and use oauth.
[AuthMethod](https://agentclientprotocol.com/protocol/schema#authmethod) does not really tell the client what should be done to authenticate. This means we can't show the user a control for entering key if an agent supports auth through env var.

Very few agents can authenticate fully on their own without user input, so agents with ACP auth support are limited in the methods they can offer, or require manual setup before being run as an ACP agent.

## What we propose to do about it

> What are you proposing to improve the situation?

We can add addition types of AuthMethods, to provide clients with additional information so they can assist in the login process.

## Shiny future

> How will things will play out once this feature exists?

It will be easier for end-users to start using an agent from inside the IDE as auth process will be more straightforward

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

I suggest adding following auth types:

### Auth method types

1. Agent auth

Same as what there is now – agent handles the auth itself. This is the default type when no `type` is provided, preserving backward compatibility.

```json theme={null}
{
  "id": "123",
  "name": "Agent",
  "description": "Authenticate through agent"
}
```

An explicit `"type": "agent"` is also accepted but not required.

2. Env variable

The user provides credentials that the client passes to the agent as environment variables. Requires `"type": "env_var"`.

The `vars` field is an array of `AuthEnvVar` objects, each describing a single environment variable. This supports services that require multiple credentials (e.g. Azure OpenAI needs both an API key and an endpoint URL).

Simple single-key example:

```json theme={null}
{
  "id": "openai",
  "name": "OpenAI API Key",
  "type": "env_var",
  "vars": [{ "name": "OPENAI_API_KEY" }],
  "link": "https://platform.openai.com/api-keys"
}
```

Multiple variables with metadata:

```json theme={null}
{
  "id": "azure-openai",
  "name": "Azure OpenAI",
  "type": "env_var",
  "vars": [
    { "name": "AZURE_OPENAI_API_KEY", "label": "API Key" },
    {
      "name": "AZURE_OPENAI_ENDPOINT",
      "label": "Endpoint URL",
      "secret": false
    },
    {
      "name": "AZURE_OPENAI_API_VERSION",
      "label": "API Version",
      "secret": false,
      "optional": true
    }
  ],
  "link": "https://portal.azure.com"
}
```

Fields on `AuthMethodEnvVar`:

* `vars` (required): Array of `AuthEnvVar` objects.
* `link` (optional): URL where the user can obtain their credentials.

Fields on `AuthEnvVar`:

* `name` (required): The environment variable name (e.g. `"OPENAI_API_KEY"`).
* `label` (optional): Human-readable label for this variable, displayed in client UI.
* `secret` (optional, default `true`): Whether this value is a secret. Clients should use a password-style input for secret vars and a plain text input otherwise.
* `optional` (optional, default `false`): Whether this variable is optional.

Since environment variables need to be supplied when the agent process starts, the client can check if it already passed such variables to the process, in which case the user can click on the button and the agent will read the already available values.

Otherwise, when the user clicks the button, the client could restart the agent process with the desired environment variables, and then automatically send the authenticate message with the correct id to sign in for the user.

3. Terminal Auth

This requires the client to be able to run an interactive terminal for the user to login via a TUI. Requires `"type": "terminal"`.

```json theme={null}
{
  "id": "123",
  "name": "Run in terminal",
  "description": "Setup Label",
  "type": "terminal",
  "args": ["--setup"],
  "env": { "VAR1": "value1", "VAR2": "value2" }
}
```

* `args` (optional, default `[]`): Additional arguments to pass when running the agent binary.
* `env` (optional, default `{}`): Additional environment variables to set.

The `command` cannot be specified, the client will invoke the exact same binary with the exact same setup. The agent can supply additional arguments and environment variables as necessary. These will be supplied in **addition** to any args/env supplied by default when the server is started. So agents will need to have a way to kickoff their interactive login flow even if normal acp commands/arguments are supplied as well.

This is so that the agent doesn't need to know about the environment it is running in. It can't know the absolute path necessarily, and shouldn't be able to supply other commands or programs to minimize security issues.

### Client capabilities

Because `terminal` auth methods require specific client-side support, clients must opt in via `AuthCapabilities` on `ClientCapabilities` during initialization:

```json theme={null}
{
  "clientCapabilities": {
    "auth": {
      "terminal": true
    }
  }
}
```

* `auth.terminal` (default `false`): When `true`, the agent may include `terminal` entries in its authentication methods.

The `env_var` type does not require a capability opt-in since any client can set environment variables when starting a process, we are just providing additional context for the environment variable.

### Auth errors

It might be useful to include a list of AuthMethod ids to the AUTH\_REQUIRED JsonRpc error. Why do we need this if they're already shared during `initialize`:
All supported auth methods are shared during `initialize`. When user starts a session, they've already selected a model, which can narrow down a list of options.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32000,
    "message": "Authentication required",
    "authMethods": [
      {
        "id": "chatgpt",
        "name": "Login with ChatGPT",
        "description": "Use your ChatGPT login with Codex CLI (requires a paid ChatGPT subscription)"
      }
    ]
  }
}
```

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### What alternative approaches did you consider, and why did you settle on this one?

An alternative approach would be to include this information to an agent's declaration making it more static, see [Registry RFD](https://github.com/agentclientprotocol/agent-client-protocol/pull/289)

There is also an alternative to adding a separate `elicitation` capability, which is to create a separate auth type for this. Then the client can decide themselves if they support it or not.

## Revision history

There was a part about elicitations [https://github.com/agentclientprotocol/agent-client-protocol/blob/939ef116a1b14016e4e3808b8764237250afa253/docs/rfds/auth.mdx](https://github.com/agentclientprotocol/agent-client-protocol/blob/939ef116a1b14016e4e3808b8764237250afa253/docs/rfds/auth.mdx) removed it for now, will move to a separate rfd

* 2026-03-03: Changed `env_var` from single `varName` to structured `vars` array of `AuthEnvVar` objects; simplified field name from `varName` to `name`
* 2026-02-27: Updated to reflect current implementation
* 2026-01-14: Updates based on Core Maintainer discussion


# Boolean Config Option Type
Source: https://agentclientprotocol.com/rfds/boolean-config-option



* Author(s): [fscarponi](https://github.com/fscarponi)
* Champion: [benbrandt](https://github.com/benbrandt)

## Elevator pitch

Add a new `boolean` type to session configuration options, enabling agents to expose simple ON/OFF toggles (e.g., "Brave Mode", "Read Only", "Produce Report") as first-class config options alongside the existing `select` type.

## Status quo

Currently, `SessionConfigKind` only supports the `select` type, which allows agents to expose dropdown-style selectors with a list of named values. This works well for choosing models, modes, or reasoning levels.

However, there is no native way to represent a simple boolean on/off toggle. To expose a boolean option today, agents must use a `select` with two artificial options (e.g., "on"/"off"), and clients need custom, non-agnostic logic to detect that a particular select is actually a boolean toggle. This defeats the purpose of a standardized protocol.

## What we propose to do about it

* Add a `SessionConfigBoolean` struct with a `current_value: bool` field
* Add a `Boolean(SessionConfigBoolean)` variant to the `SessionConfigKind` enum, discriminated by `"type": "boolean"`
* Add a `SessionConfigOptionValue` internally-tagged enum so that `SetSessionConfigOptionRequest` can carry both string values (for `select`) and boolean values (for `boolean`) with an explicit `type` discriminator
* Provide convenience constructors and `From` impls for ergonomic usage
* Update documentation and regenerate schema files

## Shiny future

Clients can natively render boolean config options as toggle switches or checkboxes, without any custom logic. Agents can expose options like "Brave Mode", "Produce Report", or "Read Only" in a standardized way that any ACP-compliant client understands out of the box.

## Implementation details and plan

### Wire format: declaring a boolean option

In a `session/new` response (or any response containing `configOptions`):

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123",
    "configOptions": [
      {
        "id": "brave_mode",
        "name": "Brave Mode",
        "description": "Skip confirmation prompts and act autonomously",
        "type": "boolean",
        "currentValue": true
      },
      {
        "id": "mode",
        "name": "Session Mode",
        "category": "mode",
        "type": "select",
        "currentValue": "code",
        "options": [
          { "value": "ask", "name": "Ask" },
          { "value": "code", "name": "Code" }
        ]
      }
    ]
  }
}
```

### Wire format: setting a boolean option

The `session/set_config_option` request carries a `type` discriminator alongside the `value`. The `type` field describes the *shape* of the value, not the option kind.

When `type` is absent the value is treated as a `SessionConfigValueId` string, preserving backwards compatibility with existing clients:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_config_option",
  "params": {
    "sessionId": "sess_abc123",
    "configId": "brave_mode",
    "type": "boolean",
    "value": true
  }
}
```

For select options the `type` field can be omitted (defaults to `value_id`):

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/set_config_option",
  "params": {
    "sessionId": "sess_abc123",
    "configId": "mode",
    "value": "code"
  }
}
```

The response returns the full set of config options with current values, as with `select`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "configOptions": [
      {
        "id": "brave_mode",
        "name": "Brave Mode",
        "description": "Skip confirmation prompts and act autonomously",
        "type": "boolean",
        "currentValue": true
      },
      {
        "id": "mode",
        "name": "Session Mode",
        "category": "mode",
        "type": "select",
        "currentValue": "code",
        "options": [..]
      }
    ]
  }
}
```

Key changes:

1. `SessionConfigBoolean` struct with `current_value: bool`
2. `Boolean(SessionConfigBoolean)` variant in `SessionConfigKind` (tagged via `"type": "boolean"`)
3. `SessionConfigOptionValue` enum using `#[serde(tag = "type")]` with a `#[serde(untagged)]` fallback variant — the same pattern as `AuthMethod`:
   * `Boolean { value: bool }` — matched when `type` is `"boolean"`
   * `ValueId { value: SessionConfigValueId }` — untagged fallback when `type` is absent or unrecognised
4. `SessionConfigOptionValue` is flattened (`#[serde(flatten)]`) onto `SetSessionConfigOptionRequest`, producing top-level `type` and `value` fields on the wire
5. The `value` field type change in `SetSessionConfigOptionRequest` is gated behind `#[cfg(feature = "unstable_boolean_config")]` — without the feature the field remains `SessionConfigValueId`
6. `From` impls (`&str`, `SessionConfigValueId`, `bool`) ensure ergonomic construction
7. Wire-level backward compatible: existing JSON payloads without a `type` field remain valid via the untagged fallback

### Client capabilities

Per the existing protocol design, clients that receive a config option with an unrecognized `type` should ignore it. Since the agent is required to have a default value for every option, the agent can function correctly even if the client doesn't render or interact with the boolean option. No new client capability negotiation is needed.

## Frequently asked questions

### What alternative approaches did you consider, and why did you settle on this one?

We considered reusing the existing `select` type with a convention (e.g., options named "on"/"off"), but this would require clients to implement non-agnostic detection logic, which contradicts the goal of a standardized protocol. A dedicated `boolean` type is cleaner and lets clients render the appropriate UI control without guessing.

### Is this a breaking change?

On the wire/JSON level: no. When `type` is absent the value is treated as a `SessionConfigValueId`, so existing payloads deserialize correctly. On the Rust API level: the type of `SetSessionConfigOptionRequest.value` changes, but this is gated behind `unstable_boolean_config`. Without the feature flag the stable API is unchanged. With the feature flag, `From` impls ensure source compatibility for users of the `new()` constructor.

## Revision history

* 2026-02-24: Initial proposal
* 2026-03-05: Updated to reflect final implementation — `flag` renamed to `boolean`, value type changed from untagged `String | Bool` enum to internally-tagged enum with `type` discriminator and untagged `ValueId` fallback, feature-gated behind `unstable_boolean_config`


# Represent deleted files in diff
Source: https://agentclientprotocol.com/rfds/diff-delete



Author(s): [anna239](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

Add flag `deleted` to [Diff](https://agentclientprotocol.com/protocol/tool-calls#diffs) entity type for the case of a deleted file.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Currently, in Diff entity type `newText` is not nullable, so it's not possible to distinguish between a deleted file and empty file.

## What we propose to do about it

> What are you proposing to improve the situation?

Add flag `deleted` to [Diff](https://agentclientprotocol.com/protocol/tool-calls#diffs) entity type for the case of a deleted file.

**Current structure (cannot distinguish deleted file from empty file):**

```json theme={null}
{
  "type": "diff",
  "path": "/home/user/project/src/config.json",
  "oldText": "{\n  \"debug\": false\n}",
  "newText": ""
}
```

**Proposed structure with `deleted` flag:**

```json theme={null}
{
  "type": "diff",
  "path": "/home/user/project/src/config.json",
  "oldText": "{\n  \"debug\": false\n}",
  "newText": "",
  "deleted": true
}
```

Note: we would ideally make newText nullable, but that would break existing clients.

## Shiny future

> How will things will play out once this feature exists?

It is possible for the agent to distinguish between a deleted file and an empty file.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

Adding the new field will be a non-breaking change, and clients that update can better distinguish between deleted and empty files.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

**Do we need to represent moved files?**

An agent could represent that with a deleted file at the old path and a new file at the new path.

We need to rework the entire diff structure to handle more cases, and binary files, but in the meantime this provides a stop-gap until we can implement a more comprehensive solution.

### What alternative approaches did you consider, and why did you settle on this one?

We considered making newText nullable, but that would break existing clients.

## Revision history

2026-02-20: Initial draft


# Elicitation: Structured User Input During Sessions
Source: https://agentclientprotocol.com/rfds/elicitation



* Author(s): [@yordis](https://github.com/yordis)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

Add support for agents to request structured information from users during a session through a standardized elicitation mechanism, aligned with [MCP's elicitation feature](https://modelcontextprotocol.io/specification/draft/client/elicitation). This allows agents to ask follow-up questions, collect authentication credentials, gather preferences, and request required information without side-channel communication or ad-hoc client UI implementations.

## Status quo

Currently, agents have two limited mechanisms for gathering user input:

1. **Session Config Options** (PR #210): Pre-declared, persistent configuration (model, mode, etc.) with default values required. These are available at session initialization and changes are broadcast to the client.

2. **Unstructured text in turn responses**: Agents can include prompts in their responses, but clients have no standardized way to recognize auth requests, form inputs, or structured selections, leading to inconsistent UX across agents.

However, there is no mechanism for agents to:

* Request ad-hoc information during a turn (e.g., "Which of these approaches should I proceed with?" from PR #340)
* Ask for authentication credentials in a recognized, secure way (pain point from PR #330)
* Collect open-ended text input with validation constraints
* Handle decision points that weren't anticipated at session initialization
* Request sensitive information via out-of-band mechanisms (browser-based OAuth)

The community has already identified the need for this: PR #340 explored a `session/select` mechanism but concluded that leveraging an MCP-like elicitation pattern would be more aligned with how clients will already support MCP servers. PR #330 recognized that authentication requests specifically need special handling separate from regular session data.

This gap limits the richness of agent-client interaction and forces both agents and clients to implement ad-hoc solutions for structured user input.

## What we propose to do about it

We propose introducing an elicitation mechanism for agents to request structured information from users, aligned with [MCP's draft elicitation specification](https://modelcontextprotocol.io/specification/draft/client/elicitation). This addresses discussions from PR #340 about standardizing user selection flows and PR #330 about secure authentication handling.

The mechanism would:

1. **Use restricted JSON Schema** (as discussed in PR #210): Like MCP, constrain JSON Schema to a useful subset—flat objects with primitive properties (`string`, `number`, `integer`, `boolean`) plus supported formats and enum values. Clients decide how to render UI based on the schema.

2. **Support two elicitation modes** (following [MCP SEP-1036](https://modelcontextprotocol.io/community/seps/1036-url-mode-elicitation-for-secure-out-of-band-intera)):
   * **Form mode** (in-band): Structured data collection via JSON Schema forms
   * **URL mode** (out-of-band): Browser-based flows for sensitive operations like OAuth (addressing PR #330 authentication pain points)

3. **Request/response pattern**: Agents send elicitation requests via a `session/elicitation` method and receive responses. The agent controls when to send requests and whether to wait for responses before proceeding. Unlike Session Config Options (which are persistent), elicitation requests are transient.

4. **Support client capability negotiation**: Clients declare elicitation support via a structured capability object that distinguishes between `form`-based and `url`-based elicitation (following MCP's capability model). This allows clients to support one or both modalities, enables agents to pass capabilities along to MCP servers, and handles graceful degradation when clients have limited elicitation support.

5. **Provide rich context**: Agents can include title, description, detailed constraints, and examples—helping clients render consistent, helpful UI without custom implementations.

6. **Enable out-of-band flows**: Support URL-mode elicitation (like MCP) for sensitive operations like authentication, where credentials bypass the agent entirely (addressing the core pain point in PR #330).

## Shiny future

Once implemented, agents can:

* Ask users "Which approach would you prefer: A or B?" and receive a structured response
* Request text input: "What's the name for this function?"
* Collect multiple related pieces of information in a single request
* Guide users through decision trees with follow-up questions
* Provide rich context (descriptions, examples, constraints) for what they're asking for

Clients can:

* Present a consistent, standardized UI for elicitation across all agents
* Validate user input against constraints before sending to the agent
* Cache elicitation history and offer suggestions based on previous responses
* Provide keyboard shortcuts and accessibility features for common elicitation types

## Implementation details and plan

### Alignment with MCP

This proposal follows MCP's draft elicitation specification. See [MCP Elicitation Specification](https://modelcontextprotocol.io/specification/draft/client/elicitation) for detailed guidance. ACP uses the same JSON Schema constraint approach and capability model, adapted for our session/turn-based architecture.

Key differences from MCP:

* MCP elicitation is tool-call-scoped; ACP elicitation is session-scoped
* ACP uses `session/elicitation` method; MCP uses `elicitation/create`
* ACP must integrate with existing Session Config Options (which also use schema constraints)

### Elicitation Request Structure

Agents send elicitation requests when they need information from the user. This is a request/response pattern—the agent sends the request and waits for the client's response.

**Example 1: Form Mode - User Selection (from PR #340)**

```json theme={null}
{
  "mode": "form",
  "message": "How would you like me to approach this refactoring?",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "strategy": {
        "type": "string",
        "title": "Refactoring Strategy",
        "description": "Choose how aggressively to refactor",
        "oneOf": [
          {
            "const": "conservative",
            "title": "Conservative - Minimal changes"
          },
          { "const": "balanced", "title": "Balanced (Recommended)" },
          {
            "const": "aggressive",
            "title": "Aggressive - Maximum optimization"
          }
        ],
        "default": "balanced"
      }
    },
    "required": ["strategy"]
  }
}
```

**Example 2: URL Mode - Authentication (from PR #330, out-of-band OAuth)**

```json theme={null}
{
  "mode": "url",
  "elicitationId": "github-oauth-123",
  "url": "https://agent.example.com/connect?elicitationId=github-oauth-123",
  "message": "Please authorize access to your GitHub repositories to continue."
}
```

**Example 3: Form Mode - Text Input with Constraints**

```json theme={null}
{
  "mode": "form",
  "message": "What should this function be named?",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "title": "Function Name",
        "description": "Must be a valid identifier",
        "minLength": 1,
        "maxLength": 64,
        "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
        "default": "processData"
      }
    },
    "required": ["name"]
  }
}
```

**Example 4: Form Mode - Multiple Fields**

```json theme={null}
{
  "mode": "form",
  "message": "Please provide configuration details",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "title": "Project Name"
      },
      "port": {
        "type": "integer",
        "title": "Port Number",
        "minimum": 1024,
        "maximum": 65535,
        "default": 3000
      },
      "enableLogging": {
        "type": "boolean",
        "title": "Enable Logging",
        "default": true
      }
    },
    "required": ["name"]
  }
}
```

### Elicitation Modes

Following MCP's approach (specifically [SEP-1036](https://modelcontextprotocol.io/community/seps/1036-url-mode-elicitation-for-secure-out-of-band-intera)), elicitation supports two modes:

**Form mode** (in-band): Servers request structured data from users using restricted JSON Schema. The client decides how to render the form UI based on the schema.

**URL mode** (out-of-band): Servers direct users to external URLs for sensitive interactions that must not pass through the agent or client (OAuth flows, payments, credential collection, etc.).

This distinction is reflected in the client capabilities model, allowing clients to declare support for one or both modalities.

**Normative requirements:**

* Clients declaring the `elicitation` capability MUST support at least one mode (`form` or `url`).
* Agents MUST NOT send elicitation requests with modes that are not supported by the client.
* For URL mode, the `url` parameter MUST contain a valid URL.
* Agents MUST NOT return the `URLElicitationRequiredError` (code `-32042`) except when URL mode elicitation is required.

### Restricted JSON Schema

Aligning with [MCP's draft elicitation specification](https://modelcontextprotocol.io/specification/draft/client/elicitation), form mode elicitation uses a restricted subset of JSON Schema. Schemas are limited to flat objects with primitive properties only—the client decides how to render appropriate input UI based on the schema.

**Supported primitive types:**

1. **String Schema**

```json theme={null}
{
  "type": "string",
  "title": "Display Name",
  "description": "Description text",
  "minLength": 3,
  "maxLength": 50,
  "pattern": "^[A-Za-z]+$",
  "format": "email",
  "default": "user@example.com"
}
```

Supported formats: `email`, `uri`, `date`, `date-time`

2. **Number Schema**

```json theme={null}
{
  "type": "number",
  "title": "Display Name",
  "description": "Description text",
  "minimum": 0,
  "maximum": 100,
  "default": 50
}
```

Also supports `"type": "integer"` for whole numbers.

3. **Boolean Schema**

```json theme={null}
{
  "type": "boolean",
  "title": "Display Name",
  "description": "Description text",
  "default": false
}
```

4. **Enum Schema** (for selections)

Single-select enum (without titles):

```json theme={null}
{
  "type": "string",
  "title": "Color Selection",
  "description": "Choose your favorite color",
  "enum": ["Red", "Green", "Blue"],
  "default": "Red"
}
```

Single-select enum (with titles):

```json theme={null}
{
  "type": "string",
  "title": "Color Selection",
  "description": "Choose your favorite color",
  "oneOf": [
    { "const": "#FF0000", "title": "Red" },
    { "const": "#00FF00", "title": "Green" },
    { "const": "#0000FF", "title": "Blue" }
  ],
  "default": "#FF0000"
}
```

Multi-select enum (without titles):

```json theme={null}
{
  "type": "array",
  "title": "Color Selection",
  "description": "Choose your favorite colors",
  "minItems": 1,
  "maxItems": 2,
  "items": {
    "type": "string",
    "enum": ["Red", "Green", "Blue"]
  },
  "default": ["Red", "Green"]
}
```

Multi-select enum (with titles):

```json theme={null}
{
  "type": "array",
  "title": "Color Selection",
  "description": "Choose your favorite colors",
  "minItems": 1,
  "maxItems": 2,
  "items": {
    "anyOf": [
      { "const": "#FF0000", "title": "Red" },
      { "const": "#00FF00", "title": "Green" },
      { "const": "#0000FF", "title": "Blue" }
    ]
  },
  "default": ["#FF0000", "#00FF00"]
}
```

**Request schema structure:**

```json theme={null}
"requestedSchema": {
  "type": "object",
  "properties": {
    "propertyName": {
      "type": "string",
      "title": "Display Name",
      "description": "Description of the property"
    },
    "anotherProperty": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    }
  },
  "required": ["propertyName"]
}
```

**Not supported** (to simplify client implementation):

* Complex nested objects/arrays (beyond enum arrays)
* Conditional validation
* Custom formats beyond the supported list

Clients use this schema to generate appropriate input forms, validate user input before sending, and provide better guidance to users. All primitive types support optional default values; clients SHOULD pre-populate form fields with these values.

**Security note:** Following MCP, servers MUST NOT use form mode elicitation to request sensitive information (passwords, API keys, credentials). Sensitive data collection MUST use URL mode elicitation, which bypasses the agent and client entirely.

### Elicitation Request

The agent sends a `session/elicitation` request when it needs information from the user:

**Form mode example:**

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 43,
  "method": "session/elicitation",
  "params": {
    "sessionId": "...",
    "mode": "form",
    "message": "How would you like me to approach this refactoring?",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "strategy": {
          "type": "string",
          "title": "Refactoring Strategy",
          "oneOf": [
            { "const": "conservative", "title": "Conservative" },
            { "const": "balanced", "title": "Balanced (Recommended)" },
            { "const": "aggressive", "title": "Aggressive" }
          ],
          "default": "balanced"
        }
      },
      "required": ["strategy"]
    }
  }
}
```

**URL mode example:**

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 44,
  "method": "session/elicitation",
  "params": {
    "sessionId": "...",
    "mode": "url",
    "elicitationId": "github-oauth-001",
    "url": "https://agent.example.com/connect?elicitationId=github-oauth-001",
    "message": "Please authorize access to your GitHub repositories."
  }
}
```

The client presents the elicitation UI to the user. For form mode, the client generates appropriate input UI based on the JSON Schema. For URL mode, the client opens the URL in a secure browser context.

### User Response

Elicitation responses use a three-action model (following MCP) to clearly distinguish between different user actions:

**Accept** - User explicitly approved and submitted with data:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "action": "accept",
    "content": {
      "strategy": "balanced"
    }
  }
}
```

**Decline** - User explicitly declined the request:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "action": "decline"
  }
}
```

**Cancel** - User dismissed without making an explicit choice (closed dialog, pressed Escape, etc.):

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 43,
  "result": {
    "action": "cancel"
  }
}
```

For URL mode elicitation, the response with `action: "accept"` indicates that the user consented to the interaction. It does not mean the interaction is complete—the interaction occurs out-of-band and the client is not aware of the outcome until the agent sends a completion notification.

Agents should handle each state appropriately:

* **Accept**: Process the submitted data
* **Decline**: Handle explicit decline (e.g., use default, offer alternatives)
* **Cancel**: Handle dismissal (e.g., use default, prompt again later)

### Message Flow

#### Form Mode Flow

```mermaid theme={null}
sequenceDiagram
    participant User
    participant Client
    participant Agent

    Note over Agent: Agent initiates elicitation
    Agent->>Client: session/elicitation (mode: form)

    Note over User,Client: Present elicitation UI
    User-->>Client: Provide requested information

    Note over Agent,Client: Complete request
    Client->>Agent: Return user response

    Note over Agent: Continue processing with new information
```

#### URL Mode Flow

```mermaid theme={null}
sequenceDiagram
    participant UserAgent as User Agent (Browser)
    participant User
    participant Client
    participant Agent

    Note over Agent: Agent initiates elicitation
    Agent->>Client: session/elicitation (mode: url)

    Client->>User: Present consent to open URL
    User-->>Client: Provide consent

    Client->>UserAgent: Open URL
    Client->>Agent: Accept response

    Note over User,UserAgent: User interaction
    UserAgent-->>Agent: Interaction complete
    Agent-->>Client: notifications/elicitation/complete (optional)

    Note over Agent: Continue processing with new information
```

#### URL Mode With Elicitation Required Error Flow

```mermaid theme={null}
sequenceDiagram
    participant UserAgent as User Agent (Browser)
    participant User
    participant Client
    participant Agent

    Client->>Agent: Request (e.g., tool call)

    Note over Agent: Agent needs authorization
    Agent->>Client: URLElicitationRequiredError
    Note over Client: Client notes the original request can be retried after elicitation

    Client->>User: Present consent to open URL
    User-->>Client: Provide consent

    Client->>UserAgent: Open URL

    Note over User,UserAgent: User interaction

    UserAgent-->>Agent: Interaction complete
    Agent-->>Client: notifications/elicitation/complete (optional)

    Client->>Agent: Retry original request (optional)
```

### Completion Notifications for URL Mode

Following MCP, agents MAY send a `notifications/elicitation/complete` notification when an out-of-band interaction started by URL mode elicitation is completed:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "notifications/elicitation/complete",
  "params": {
    "elicitationId": "github-oauth-001"
  }
}
```

Agents sending notifications:

* MUST only send the notification to the client that initiated the elicitation request
* MUST include the `elicitationId` established in the original request

Clients:

* MUST ignore notifications referencing unknown or already-completed IDs
* MAY use this notification to automatically retry requests, update UI, or continue an interaction
* SHOULD provide manual controls for the user to retry or cancel if the notification never arrives

### URL Elicitation Required Error

When a request cannot be processed until a URL mode elicitation is completed, the agent MAY return a `URLElicitationRequiredError` (code `-32042`). This allows clients to understand that a specific elicitation is required before retrying the original request.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32042,
    "message": "This request requires authorization.",
    "data": {
      "elicitations": [
        {
          "mode": "url",
          "elicitationId": "github-oauth-001",
          "url": "https://agent.example.com/connect?elicitationId=github-oauth-001",
          "message": "Authorization is required to access your GitHub repositories."
        }
      ]
    }
  }
}
```

Any elicitations returned in the error MUST be URL mode elicitations with an `elicitationId`. Clients may automatically retry the failed request after receiving a completion notification.

### Error Handling

Agents MUST return standard JSON-RPC errors for common failure cases:

* When a request cannot be processed until a URL mode elicitation is completed: `-32042` (`URLElicitationRequiredError`)

Clients MUST return standard JSON-RPC errors for common failure cases:

* When the agent sends a `session/elicitation` request with a mode not declared in client capabilities: `-32602` (Invalid params)

### Client Capabilities

Clients declare elicitation support during the `initialize` phase via `ClientCapabilities`, following MCP's capability model pattern. The capability distinguishes between `form`-based and `url`-based elicitation:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true,
      "elicitation": {
        "form": {},
        "url": {}
      }
    },
    "clientInfo": {
      "name": "my-client",
      "version": "1.0.0"
    }
  }
}
```

**Capability structure:**

* `elicitation.form` - Present if the client can render form UI from restricted JSON Schema (strings, numbers, integers, booleans, enums)
* `elicitation.url` - Present if the client can open URLs for out-of-band flows (OAuth, payments, credential collection)

**Example: Headless client (no browser access):**

```json theme={null}
"elicitation": {
  "form": {}
}
```

**Example: Simple terminal with URL support only:**

```json theme={null}
"elicitation": {
  "url": {}
}
```

**Example: Full-featured client:**

```json theme={null}
"elicitation": {
  "form": {},
  "url": {}
}
```

This structure:

1. Allows clients to declare partial support based on their environment
2. Enables agents to pass capabilities along to MCP servers they connect to
3. Maps cleanly to MCP's elicitation capability model
4. Provides clear semantics for graceful degradation

Agents must gracefully handle clients that don't include this field (assumed to have no elicitation support) or that only include one of `form` or `url`.

### Backward Compatibility

* If a client doesn't declare `elicitation` capabilities, agents must provide a default value and continue
* If a client only declares `elicitation.form`, agents must not send URL-mode elicitation requests (or provide defaults and continue)
* If a client only declares `elicitation.url`, agents must not send form-mode elicitation requests (or provide defaults and continue)
* Agents should not require elicitation responses to continue operating
* Following MCP: an empty capability object (`"elicitation": {}`) is equivalent to declaring support for form mode only

### Statefulness

Most practical uses of elicitation require that the agent maintain state about users:

* Whether required information has been collected (e.g., the user's display name via form mode elicitation)
* Status of resource access (e.g., API keys or a payment flow via URL mode elicitation)

Agents implementing elicitation MUST securely associate this state with individual users. Specifically:

* State MUST NOT be associated with session IDs alone
* State storage MUST be protected against unauthorized access
* For remote agents, user identification MUST be derived from credentials acquired during authorization when possible (e.g., `sub` claim)

Agents MUST NOT rely on client-provided user identification without agent-side verification, as this can be forged.

## Frequently asked questions

### Can an agent request multiple pieces of information at once?

Yes—a single form mode elicitation request can include multiple fields in its `requestedSchema`. The schema is an object with multiple properties, and the client renders a form with all requested fields.

For sequential information gathering, agents can send multiple elicitation requests and wait for each response before proceeding. This allows agents to adapt follow-up questions based on previous answers.

The request/response model gives agents flexibility: they control when to send elicitation requests and whether to wait for responses or continue with other work.

### How does this differ from session config options?

Excellent question from PR #210 discussions. Both use restricted JSON Schema, but serve different purposes:

| Aspect               | Session Config Options                             | Elicitation                                                      |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| **Lifecycle**        | Persistent, pre-declared at session init           | Transient, request/response                                      |
| **Scope**            | Session-wide configuration                         | Single decision point or data collection                         |
| **Defaults**         | Required (agents must have defaults)               | Optional (schema's `required` array determines mandatory fields) |
| **State management** | Client maintains full state, broadcast on changes  | Agent receives response and decides how to proceed               |
| **Use cases**        | Model selection, session mode, persistent settings | Authentication, clarifying questions, one-time data collection   |

Session Config Options are great for "how should you run this session?" Elicitation is for "what should I do next?"

### Why align with MCP's elicitation instead of creating something different?

As identified in PR #340, clients will already implement MCP elicitation support for MCP servers. Aligning ACP's elicitation with MCP:

* Reduces client implementation burden
* Creates consistent UX across MCP and ACP agents
* Lets code be shared or reused
* Follows the protocol design principle of only constraining when necessary

PR #340 specifically concluded: "I think we'd rather have an MCP elicitation story in general, and maybe offer the same interface outside of tool calls."

### How does authentication flow work with URL-mode elicitation?

From PR #330: URL-mode elicitation allows agents to request authentication without exposing credentials to the protocol. Following [MCP's draft elicitation specification](https://modelcontextprotocol.io/specification/draft/client/elicitation):

1. Agent sends elicitation request with `mode: "url"`, an `elicitationId`, and a URL to the agent's own connect endpoint (not directly to the OAuth provider)
2. Client displays the URL to the user and requests consent to open it
3. Client responds with `action: "accept"` to indicate the user consented
4. User opens URL in their browser (out-of-band process)
5. Agent's connect page verifies the user identity matches the elicitation request
6. Agent redirects user to the OAuth provider's authorization endpoint
7. User authenticates and grants permission
8. OAuth provider redirects back to the agent's redirect\_uri
9. Agent exchanges the authorization code for tokens and stores them bound to the user's identity
10. Agent sends a `notifications/elicitation/complete` notification to inform the client

**Key guarantees**:

* Credentials never flow through the agent LLM or client
* The agent is responsible for securely storing third-party tokens
* The agent MUST verify user identity to prevent phishing attacks

**Security requirements** (from MCP draft spec):

Agents requesting URL mode elicitation:

* MUST NOT include sensitive information about the end-user (credentials, PII, etc.) in the URL
* MUST NOT provide a URL which is pre-authenticated to access a protected resource
* SHOULD NOT include URLs intended to be clickable in any field of a form mode elicitation request
* SHOULD use HTTPS URLs for non-development environments

Clients implementing URL mode elicitation:

* MUST NOT automatically pre-fetch the URL or any of its metadata
* MUST NOT open the URL without explicit consent from the user
* MUST show the full URL to the user for examination before consent
* MUST open the URL in a secure manner that does not enable the client or LLM to inspect the content or user inputs (e.g., SFSafariViewController on iOS, not WKWebView)
* SHOULD highlight the domain of the URL to mitigate subdomain spoofing
* SHOULD have warnings for ambiguous/suspicious URIs (e.g., containing Punycode)
* SHOULD NOT render URLs as clickable in any field of an elicitation request, except for the `url` field in a URL mode elicitation request (with the restrictions detailed above)

**Phishing prevention**: The agent MUST verify that the user who started the elicitation request is the same user who completes the OAuth flow. This is typically done by checking session cookies against the user identity from the MCP authorization.

### Can agents use elicitation for information required before responding?

Yes. By modeling elicitation as a request/response pattern (like MCP's `elicitation/create`), the agent controls its own flow. The agent can:

* Send an elicitation request and wait for the response before proceeding
* Continue with other work while waiting for user input
* Chain multiple elicitations as needed for multi-step workflows

This flexibility is why elicitation is modeled as a separate request/response rather than being tightly coupled to turns.

### What if a user doesn't respond to an elicitation request?

Elicitation requests require a response. If the user dismisses the elicitation without making an explicit choice (closes the dialog, presses Escape, etc.), the client responds with `action: "cancel"`. The agent then decides how to proceed—it may use a default value, prompt again later, or fail the turn.

This ties into the broader request cancellation work: elicitation requests can be cancelled like any other request, and the `cancel` action provides a clear signal that the user chose not to engage rather than explicitly declining.

### Should elicitation support complex nested data structures?

We follow MCP's design here. MCP intentionally restricts elicitation schemas to flat objects with primitive properties to simplify client implementation and user experience. Complex nested structures, arrays of objects (beyond enum arrays), and advanced JSON Schema features are explicitly not supported. If MCP expands this in the future, ACP would follow suit.

### How should agents handle clients that don't support elicitation?

Agents should always design to gracefully degrade:

* Check `elicitation.form` and `elicitation.url` capabilities before sending requests
* If the required mode is not supported, provide sensible default values
* Describe what they're requesting in turn content (text) as fallback
* Proceed with the defaults
* For agents connecting to MCP servers: pass the client's elicitation capabilities to the MCP server so it can also make informed decisions

### Can we extend this to replace the existing Permission-Request mechanism?

We recommend keeping them separate. Permission requests are fundamentally security decisions—allowing a tool call to proceed is distinct from the model asking for clarification or collecting user preferences. Keeping these separate allows clients to:

* Offer a consistent, recognizable UX for security-sensitive decisions (permissions)
* Clearly distinguish "the agent needs approval to do something" from "the agent needs information to continue"
* Apply different policies (e.g., "always allow file reads" vs. per-request elicitation responses)

This is the same reasoning behind keeping authentication flows (URL mode) distinct from data collection (form mode). While we may reuse some types between these mechanisms, conflating the features would blur important security boundaries.

### What about validating user input on the client side?

Clients SHOULD validate user input against the provided JSON Schema **before** sending the response to the agent. This prevents invalid data from reaching the agent and provides immediate feedback to the user. Agents SHOULD also validate received data matches the requested schema, as defense-in-depth against malformed or malicious responses.

If the agent requires additional validation beyond what's expressible in JSON Schema:

1. Agent validates the received value in the next turn
2. If validation fails, agent can fail the turn with an error
3. Client can then re-prompt the user (or fall back to the original default)

For v1, we recommend starting with JSON Schema validation only. If more complex validation patterns emerge from real-world usage, a future RFD can specify additional validation mechanisms.

## Revision history

* 2026-02-06: Spec alignment review. Fixed OAuth URL examples to use agent connect endpoints (not direct OAuth provider URLs) per MCP phishing prevention guidance. Added normative requirements section (MUST support at least one mode, MUST NOT send unsupported modes, url MUST be valid). Added Error Handling section with `-32042` and `-32602` error codes. Added message flow diagrams (form mode, URL mode, URL mode with error). Expanded safe URL handling requirements (pre-fetch prohibition, Punycode warnings, non-clickable URLs in form fields). Added server-side schema validation SHOULD requirement. Added Statefulness subsection with normative requirements for state association and user identification.
* 2026-02-05: Major revision to align with MCP draft elicitation specification. Updated enum schema to use `oneOf`/`anyOf` with `const`/`title` instead of `enumNames`. Added multi-select array support. Added `pattern` field for strings. Added URLElicitationRequiredError (-32042) section. Added completion notifications section. Expanded security considerations including phishing prevention. Updated all examples to match MCP draft spec format.
* 2026-02-05: Initial MCP alignment. Removed explicit "input types" in favor of restricted JSON Schema (client decides rendering). Added `mode` field (`form`/`url`). Updated capability model to use `form`/`url` sub-objects per MCP SEP-1036. Added three-action response model (`accept`/`decline`/`cancel`). Removed `password` type (MCP prohibits sensitive data in form mode).
* 2026-01-12: Initial draft based on community discussions in PR #340 (user selection), PR #210 (session config alignment), and PR #330 (authentication use cases). Aligned with MCP elicitation patterns.


# Introduce RFD Process
Source: https://agentclientprotocol.com/rfds/introduce-rfd-process



Author(s): [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change? Bullet points welcome.

Introduce a "Request for Dialog" (RFD) process to replace ad-hoc design discussions with structured, community-friendly design documents that track features from conception to completion.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Currently all development is being done primarily by the Zed team tracking requests and proposals from multiple teams. The goal is to create a process that helps to keep files organized and which can scale to participation by an emerging community.

## Shiny future

> How will things will play out once this feature exists?

### Project licensing

All code and RFDs are licensed under an Apache 2.0 license. The project is intended to remain open source and freely available in perpetuity.

### Decision making

For the initial phase, the project shall have a "design team" that consists of the Zed team acting in "BDFL" capacity. The expectation is that the project will setup a more structure governance structure as it grows. The design team makes all decisions regarding RFDs and sets overall project direction.

### RFD lifecycle

#### RFDs are proposed by opening a PR

An RFD begins as a PR adding a new file into the "Draft" section. The RFD can start minimal - just an elevator pitch and status quo are enough to begin dialog. Pull requests become the discussion forum where ideas get refined through collaborative iteration.

As discussion proceeds, the FAQ of the RFD should be extended. If discussion has been going long enough, the PR should be closed, feedback summarized, and then re-opened with a link to the original PR.

#### The PR is merged into "draft" once a core team member decides to champion it

RFD proposals are merged into the "draft" section if a core team member decides to champion them. The champion is then the point-of-contact for that proposal going forward and they will work with the proposal authors and others to make it reality. Core team members do not need to seek consensus to merge a proposal into the draft, but they should listen carefully to concerns from other core team members, as it will be difficult to move the RFD forward if those concerns are not ultimately addressed.

Once a proposal is moved to draft, code and implementation may begin to land into the PR. This work needs to be properly feature gated and marked with the name of the RFD.

Further discussion on the RFD can take place on [Zulip](https://agentclientprotocol.zulipchat.com/) if needed.

#### Moving to the "preview" section

Once the champion feels the RFD is ready for others to check it out, they can open a PR to move the file to the preview section. This is a signal to the community (and particularly other core team members) to check out the proposal and see what they think. The PR should stay open for "a few days" to give people an opportunity to leave feedback. The champion is empowered to decide whether to land the PR. As ever, all new feedback should be recorded in the FAQ section.

#### Deciding to accept an RFD

When they feel the RFD is ready to be completed, the champion requests review by the team. The team can raise concerns and notes during discussion. Final decision on an RFD is made by the core team lead.

#### Implementation of an RFD

Once accepted, RFDs become living documents that track implementation progress. Status badges in design documentation link back to the relevant RFD, creating a clear connection between "why we're building this" and "how it works." When building code with an agent, agents should read RFDs during implementation to understand design rationale and update them with implementation progress.

### Moderating and managing RFD discussions

Moving RFDs between points in the cycle involve opening PRs. Those PRs will be places to hold dialog and discussion -- but not the only place, we expect more detailed discussions to take place on [Zulip](https://agentclientprotocol.zulipchat.com/) or other communication channels. RFD owners and champions should actively "curate" discussions by collecting questions that come up and ensuring they are covered in the FAQ. Duplicate questions can be directed to the FAQ.

If the discussion on the PR gets to the point where Github begins to hide comments, the PR should typically be closed, feedback collected, and then re-opened.

## Implementation plan

> What is your implementation plan?

* ✅ Create RFD infrastructure (about, TEMPLATE, navigation setup)
* ✅ Establish lifecycle: Draft → Preview → Accepted → Completed
* ⏳ Write RFDs for major in-progress features

## Frequently asked questions

### Why "Request for Dialog" and not "Request for Comment"?

Well, partly because "dialog" emphasizes conversation and exploration rather than just collecting feedback on a predetermined design. We also shamelessly stole this process from [Niko Matsakis and the Symposium project](https://symposium-dev.github.io/symposium/rfds/index.html) (with permission) so that we could benefit from their experience.

## Revision history

* 2025-10-28: Initial version, created alongside RFD infrastructure


# Logout Method
Source: https://agentclientprotocol.com/rfds/logout-method



* Author(s): [@anna239](https://github.com/anna239)

## Elevator pitch

> What are you proposing to change?

Add a `logout` method that allows clients to terminate an authenticated session with an agent. This is the counterpart to the existing `authenticate` method and enables proper session cleanup and credential invalidation.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Currently, ACP provides an `authenticate` method for establishing authenticated sessions, but there is no standardized way to:

* Log out of an authenticated session
* Invalidate credentials or tokens
* Signal to the agent that the user wants to end their authenticated state

Users who want to switch accounts, revoke access, or simply log out must rely on:

* Manually clearing credentials outside of ACP
* Agent-specific workarounds

This creates inconsistent user experiences and potential security concerns when credentials should be invalidated but aren't.

## Shiny future

> How will things play out once this feature exists?

Clients will be able to offer a proper "Log out" button that:

1. Cleanly terminates the authenticated session
2. Allows the agent to invalidate tokens/credentials as needed
3. Returns the connection to an unauthenticated state
4. Enables the user to re-authenticate with different credentials

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

### New Method: `logout`

A new method that terminates the current authenticated session.

#### LogoutRequest

```typescript theme={null}
interface LogoutRequest {
  /** Extension metadata */
  _meta?: Record<string, unknown>;
}
```

#### LogoutResponse

```typescript theme={null}
interface LogoutResponse {
  /** Extension metadata */
  _meta?: Record<string, unknown>;
}
```

### Capability Advertisement

The `logout` capability should be advertised within a new `authCapabilities` object in `AgentCapabilities`:

```typescript theme={null}
interface AgentCapabilities {
  // ... existing fields ...

  /** Authentication-related capabilities */
  authCapabilities?: AuthCapabilities;
}

interface AuthCapabilities {
  /** Extension metadata */
  _meta?: Record<string, unknown>;

  /** Agent supports the logout method */
  logout?: boolean;
}
```

### JSON Schema Additions

```json theme={null}
{
  "$defs": {
    "AuthCapabilities": {
      "description": "Authentication-related capabilities supported by the agent.",
      "properties": {
        "_meta": {
          "additionalProperties": true,
          "type": ["object", "null"]
        },
        "logout": {
          "type": "boolean",
          "default": false,
          "description": "Whether the agent supports the logout method."
        }
      },
      "type": "object"
    },
    "LogoutRequest": {
      "description": "Request to terminate the current authenticated session.",
      "properties": {
        "_meta": {
          "additionalProperties": true,
          "type": ["object", "null"]
        }
      },
      "type": "object",
      "x-method": "logout",
      "x-side": "agent"
    },
    "LogoutResponse": {
      "description": "Response to the logout method.",
      "properties": {
        "_meta": {
          "additionalProperties": true,
          "type": ["object", "null"]
        }
      },
      "type": "object",
      "x-method": "logout",
      "x-side": "agent"
    }
  }
}
```

### Example Exchange

**Request:**

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "logout",
  "params": {}
}
```

**Response:**

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

### Behavior

1. **Pre-condition**: The client should only call `logout` if:
   * The agent advertises `authCapabilities.logout: true`

2. **Agent responsibilities**:
   * Invalidate any stored tokens or credentials as appropriate
   * Clean up any session state associated with the authenticated user
   * Return the connection to an unauthenticated state

3. **Post-condition**: After a successful `logout`:
   * Subsequent requests that require authentication should return `auth_required` error
   * The client can call `authenticate` again to establish a new authenticated session

4. **Active sessions**: If there are active sessions when `logout` is called, the agent should either:
   * Terminate them gracefully
   * Throw an `auth_required` error

## Frequently asked questions

> What questions have arisen over the course of authoring this document?

### Should logout affect active sessions?

This is left as implementation-defined. Some agents may want to:

* Automatically terminate all sessions (strict security)
* Keep sessions running

The RFD intentionally does not mandate a specific behavior to allow flexibility.

## Revision history

* 2026-02-02: Initial draft


# MCP-over-ACP: MCP Transport via ACP Channels
Source: https://agentclientprotocol.com/rfds/mcp-over-acp



Author(s): [nikomatsakis](https://github.com/nikomatsakis)

## Elevator pitch

> What are you proposing to change?

Add support for MCP servers that communicate over ACP channels instead of stdio or HTTP. This enables any ACP component to provide MCP tools and handle callbacks through the existing ACP connection, without spawning separate processes or managing additional transports.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

ACP and MCP each solve different halves of the problem of interacting with an agent. ACP stands in "front" of the agent, managing sessions, sending prompts, and receiving responses. MCP stands "behind" the agent, providing tools that the agent can use to do its work.

Many applications would benefit from being able to be both "in front" of the agent and "behind" it. This would allow a client, for example, to create custom MCP tools that are tailored to a specific request and which live in the client's address space.

The only way to combine ACP and MCP today is to use some sort of "backdoor", such as opening an HTTP port for the agent to connect to or providing a binary that communicates with IPC. This is inconvenient to implement but also means that clients cannot be properly abstracted and sandboxed, as some of the communication with the agent is going through side channels. Imagine trying to host an ACP component (client, agent, or [agent extension](./proxy-chains.mdx)) that runs in a WASM sandbox or even on another machine: for that to work, the ACP protocol has to encompass all of the relevant interactions so that messages can be transmitted properly.

## What we propose to do about it

> What are you proposing to improve the situation?

We propose adding `"acp"` as a new MCP transport type. When an ACP component (client or proxy) adds an MCP server with ACP transport to a session, tool invocations for that server are routed back through the ACP channel to the component that provided it.

This enables patterns like:

* A **client** that injects project-aware tools into every session and handles callbacks directly
* An **[agent extension](./proxy-chains.mdx)** that adds context-aware tools based on the conversation state
* A **bridge** that translates ACP-transport MCP servers to stdio for agents that don't support native ACP transport

### How it works

When the client connects, the agent advertises MCP-over-ACP support via `mcpCapabilities.acp` in its `InitializeResponse`. If supported, the client can add MCP servers to a `session/new` request with `"transport": "acp"` and an `id` that identifies the server:

```json theme={null}
{
  "tools": {
    "mcpServers": {
      "project-tools": {
        "transport": "acp",
        "id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

The `id` is generated by the component providing the MCP server.

When the agent connects to the MCP server, an `mcp/connect` message is sent with the MCP server's `id`. This returns a fresh `connectionId`. MCP messages are then sent back and forth using `mcp/message` requests. Finally, `mcp/disconnect` signals that the connection is closing.

### Bridging and compatibility

Existing agents don't support ACP transport for MCP servers. To bridge this gap, a wrapper component can translate between ACP-transport MCP servers and the stdio/HTTP transports that agents already support. The wrapper spawns shim processes or HTTP servers that the agent connects to normally, then relays messages to/from the ACP channel.

We've implemented this bridging as part of the conductor described in the [Proxy Chains RFD](./proxy-chains). The conductor always advertises `mcpCapabilities.acp: true` to its clients, handling the translation transparently regardless of whether the downstream agent supports native ACP transport.

### Message flow example

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent

    Client->>Agent: session/new (with ACP-transport MCP server)
    Agent-->>Client: session created

    Client->>Agent: prompt ("analyze this codebase")

    Note over Agent: Agent decides to use the tool
    Agent->>Client: mcp/connect (acpId: "<id>")
    Client-->>Agent: connectionId: "conn-1"

    Agent->>Client: mcp/message (list_files tool call)
    Client-->>Agent: file listing results

    Agent-->>Client: response using tool results

    Agent->>Client: mcp/disconnect (connectionId: "conn-1")
```

## Shiny future

> How will things play out once this feature exists?

### Seamless tool injection

Components can provide tools without any process management. A Rust development environment could inject cargo-aware tools, a cloud IDE could inject deployment tools, and a security scanner could inject vulnerability checking - all through the same ACP connection they're already using.

### WebAssembly-based tooling

Components running in sandboxed environments (like WASM) can provide MCP tools without needing filesystem or process spawning capabilities. The ACP channel is their only interface, and that's sufficient.

### Transparent bridging

For agents that don't natively support ACP transport, intermediaries can transparently bridge: accepting MCP-over-ACP from clients and spawning stdio- or HTTP-based MCP servers that the agent can use normally. This provides backwards compatibility while allowing the ecosystem to adopt ACP transport incrementally.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

### Capability advertising

Agents advertise MCP-over-ACP support via the [`mcpCapabilities`](/protocol/schema#mcpcapabilities) field in their `InitializeResponse`. We propose adding an `acp` field to this existing structure:

```json theme={null}
{
  "capabilities": {
    "mcpCapabilities": {
      "http": false,
      "sse": false,
      "acp": true
    }
  }
}
```

When `mcpCapabilities.acp` is `true`, the agent can handle MCP servers declared with `"transport": "acp"` natively - it will send `mcp/connect`, `mcp/message`, and `mcp/disconnect` messages through the ACP channel.

Clients don't need to advertise anything - they simply check the agent's capabilities to determine whether bridging is needed.

**Bridging intermediaries**: An intermediary that provides bridging can present `mcpCapabilities.acp: true` to its clients regardless of whether the downstream agent supports it, handling bridging transparently (see [Bridging](#bridging-for-agents-without-native-support) below).

### MCP transport schema extension

We extend the MCP JSON schema to include ACP as a transport option:

```json theme={null}
{
  "type": "object",
  "properties": {
    "transport": {
      "type": "string",
      "enum": ["stdio", "http", "acp"]
    }
  },
  "allOf": [
    {
      "if": { "properties": { "transport": { "const": "acp" } } },
      "then": {
        "properties": {
          "id": {
            "type": "string"
          }
        },
        "required": ["id"]
      }
    }
  ]
}
```

### Message reference

**Connection lifecycle:**

```json theme={null}
// Establish MCP connection
{
  "method": "mcp/connect",
  "params": {
    "acpId": "550e8400-e29b-41d4-a716-446655440000",
    "meta": { ... }
  }
}
// Response:
{
  "connectionId": "conn-123",
  "meta": { ... }
}

// Close MCP connection
{
  "method": "mcp/disconnect",
  "params": {
    "connectionId": "conn-123",
    "meta": { ... }
  }
}
```

**MCP message exchange:**

```json theme={null}
// Send MCP message (bidirectional - works agent→client or client→agent)
{
  "method": "mcp/message",
  "params": {
    "connectionId": "conn-123",
    "method": "<MCP_METHOD>",
    "params": { ... },
    "meta": { ... }
  }
}
```

The inner MCP message fields (`method`, `params`) are flattened into the params object. Whether the wrapped message is a request or notification is determined by the presence of an `id` field in the outer JSON-RPC envelope, following JSON-RPC conventions.

### Routing by ID

The `acpId` in `mcp/connect` matches the `id` that was provided by the component when it declared the MCP server in `session/new`. The receiving side uses this `id` to route messages to the correct handler.

When a component provides multiple MCP servers in a single session, each gets a unique `id`, enabling proper message routing.

### Connection multiplexing

Multiple connections to the same MCP server are supported - each `mcp/connect` returns a unique `connectionId`. This allows scenarios where an agent opens multiple concurrent connections to the same tool server.

### Bridging for agents without native support

Not all agents will support MCP-over-ACP natively. To maintain compatibility, it is possible to write a bridge that translates ACP-transport MCP servers to transports the agent does support.

**Bridging approaches:**

* **Stdio shim**: Spawn a small shim process that the agent connects to via stdio. The shim relays MCP messages to/from the ACP channel. This is the most compatible approach since all MCP-capable agents support stdio.

* **HTTP bridge**: Run a local HTTP server that the agent connects to. MCP messages are relayed to/from the ACP channel. This works for agents that prefer HTTP transport.

**How bridging works:**

When a client provides an MCP server with `"transport": "acp"`, and the agent doesn't advertise `mcpCapabilities.acp: true`, a bridge can:

1. Rewrite the MCP server declaration in `session/new` to use stdio or HTTP transport
2. Spawn the appropriate shim process or HTTP server
3. Relay messages between the shim and the ACP channel

From the agent's perspective, it's talking to a normal stdio/HTTP MCP server. From the client's perspective, it's handling MCP-over-ACP messages. The bridge handles the translation transparently.

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Bridge
    participant Shim as Stdio Shim
    participant Agent

    Note over Bridge: Agent doesn't support mcpCapabilities.acp
    Client->>Bridge: session/new (MCP server with acp transport)
    Bridge->>Agent: session/new (MCP server with stdio transport)
    Note over Bridge: Spawns shim for bridging

    Agent->>Shim: MCP tool call (stdio)
    Shim->>Bridge: relay
    Bridge->>Client: mcp/message
    Client-->>Bridge: tool result
    Bridge-->>Shim: relay
    Shim-->>Agent: MCP response (stdio)
```

A first implementation of this bridging exists in the `sacp-conductor` crate, part of the proposed new version of the [ACP Rust SDK](https://github.com/anthropics/rust-sdk).

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### Why use a separate `id` instead of server names?

Server names in `mcpServers` are chosen by whoever adds them to the session, and could potentially collide if multiple components add servers. A component-generated `id` provides guaranteed uniqueness and allows the providing component to correlate incoming messages back to the correct session context.

This also avoids a potential deadlock: some agents don't return the session ID until after MCP servers have been initialized. Using a component-generated `id` avoids any dependency on agent-provided identifiers.

### How does this relate to proxy chains?

MCP-over-ACP is a transport mechanism that works independently of proxy chains. However, proxy chains are a natural use case: a proxy can inject MCP servers into sessions it forwards, handle the tool callbacks, and use the results to enhance its transformations.

See the [Proxy Chains RFD](./proxy-chains) for details on how MCP-over-ACP enables context-aware tooling.

### What if the agent doesn't support ACP transport?

See the [Bridging for agents without native support](#bridging-for-agents-without-native-support) section above. A bridge can transparently translate ACP-transport MCP servers to stdio or HTTP for agents that don't advertise `mcpCapabilities.acp` support.

### What about security?

MCP-over-ACP has the same trust model as regular MCP: you're allowing a component to handle tool invocations. The difference is transport, not trust. Components should only add MCP servers from sources they trust, same as with stdio or HTTP transport.

## Revision history

Split from proxy-chains RFD to enable independent use of MCP-over-ACP transport by any ACP component, not just proxies.


# Message ID
Source: https://agentclientprotocol.com/rfds/message-id



* Author(s): [@michelTho](https://github.com/michelTho), [@nemtecl](https://github.com/nemtecl)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

Add a `messageId` field to `agent_message_chunk`, `user_message_chunk`, `agent_thought_chunk` session updates and `session/prompt` requests, and a `userMessageId` field to `session/prompt` responses, to uniquely identify individual messages within a conversation. Both clients and agents can generate message IDs using UUID format. This enables clients to distinguish between different messages beyond changes in update type and lays the groundwork for future capabilities like message editing and session deduplication.

## Status quo

Currently, when an Agent sends message chunks via `session/update` notifications, there is no explicit identifier for the message being streamed:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "Let me analyze your code..."
      }
    }
  }
}
```

This creates several limitations:

1. **Ambiguous message boundaries** - When the Agent sends multiple messages in sequence (e.g., alternating between agent and user messages, or multiple agent messages), Clients can only infer message boundaries by detecting a change in the `sessionUpdate` type. If an Agent sends consecutive messages of the same type, Clients cannot distinguish where one message ends and another begins.

2. **Non-standard workarounds** - Currently, implementations rely on the `_meta` field to work around this limitation. While functional, this approach is not standardized and each implementation may use different conventions.

3. **Limited future capabilities** - Without stable message identifiers, it's difficult to build features like:
   * Message editing or updates
   * Message-specific metadata or annotations
   * Message threading or references
   * Undo/redo functionality

As an example, consider this sequence where a Client cannot reliably determine message boundaries:

```json theme={null}
// First agent message chunk
{ "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "Analyzing..." } }

// More chunks... but is this still the same message or a new one?
{ "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "Found issues." } }

// Tool call happens
{ "sessionUpdate": "tool_call", ... }

// Another agent message - definitely a new message
{ "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "Fixed the issues." } }
```

## What we propose to do about it

Add a `messageId` field to `AgentMessageChunk`, `UserMessageChunk`, `AgentThoughtChunk` session updates and `PromptRequest`, and a `userMessageId` field to `PromptResponse`. These fields would:

1. **Provide stable message identification** - Each message gets a unique identifier that remains constant across all chunks of that message.

2. **Enable reliable message boundary detection** - Clients can definitively determine when a new message starts by observing a change in `messageId`.

3. **Create an extension point for future features** - Message IDs can be referenced in future protocol enhancements.

### Proposed Structure

When the Client sends a user message via `session/prompt`, it can optionally include a `messageId`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "messageId": "4c12d49b-729c-4086-bfed-5b82e9a53400",
    "prompt": [
      {
        "type": "text",
        "text": "Can you analyze this code?"
      }
    ]
  }
}
```

The Agent echoes this as `userMessageId` in the response (or assigns one if the client didn't provide it):

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "userMessageId": "4c12d49b-729c-4086-bfed-5b82e9a53400",
    "stopReason": "end_turn"
  }
}
```

For agent message chunks, the Agent generates and includes a `messageId`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "messageId": "ea87d0e7-beb8-484a-a404-94a30b78a5a8",
      "content": {
        "type": "text",
        "text": "Let me analyze your code..."
      }
    }
  }
}
```

If the Agent sends `user_message_chunk` updates (e.g., during `session/load`), it uses the user message ID:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "user_message_chunk",
      "messageId": "4c12d49b-729c-4086-bfed-5b82e9a53400",
      "content": {
        "type": "text",
        "text": "Can you..."
      }
    }
  }
}
```

The `messageId` field would be:

* **Optional** on `agent_message_chunk`, `user_message_chunk`, `agent_thought_chunk` updates and `session/prompt` requests (as `messageId`)
* **Optional** in `session/prompt` responses (as `userMessageId`)
* **UUID format** - Both clients and agents MUST use UUID format to ensure collision avoidance
* **Unique per message** within a session
* **Stable across chunks** - all chunks belonging to the same message share the same `messageId`
* **Opaque** - Implementations treat it as an identifier without parsing its structure
* **Dual-origin** - Clients generate IDs for user messages, agents generate IDs for agent messages

### Message ID Acknowledgment

When a Client includes `messageId` in a `session/prompt` request, the Agent's response behavior indicates whether message IDs are supported:

* **If the Agent supports message IDs** and records the client-provided ID, it MUST include `userMessageId` in the response with the same value.
* **If the Agent assigns its own ID** (when the client didn't provide one), it SHOULD include `userMessageId` in the response so the client knows the assigned ID.
* **If the Agent does not support message IDs** or chooses not to record it, it MUST omit `userMessageId` from the response.

Clients MUST interpret the absence of `userMessageId` in the response as confirmation that the message ID was **not recorded**. Clients SHOULD NOT rely on that ID for subsequent operations (e.g., message editing, truncation, or forking) when `userMessageId` is absent.

This creates predictable behavior: the presence of `userMessageId` in the response is an explicit acknowledgment that the Agent recorded the ID and will recognize it in future operations.

## Shiny future

Once this feature exists:

1. **Clear message boundaries** - Clients can reliably render distinct message bubbles in the UI, even when multiple messages of the same type are sent consecutively.

2. **Better streaming UX** - Clients know exactly which message element to append chunks to, enabling smoother visual updates.

3. **Foundation for editing** - With stable message identifiers, future protocol versions could add:
   * `message/edit` - Agent updates the content of a previously sent message
   * `message/delete` - Agent removes a message from the conversation
   * `message/replace` - Agent replaces an entire message with new content

4. **Message metadata** - Future capabilities could reference messages by ID:
   * Annotations or reactions to specific messages
   * Citation or cross-reference between messages
   * Tool calls that reference which message triggered them

5. **Enhanced debugging** - Implementations can trace message flow more easily with explicit IDs in logs and debugging tools.

Example future editing capability:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "message_update",
      "messageId": "ea87d0e7-beb8-484a-a404-94a30b78a5a8",
      "updateType": "replace",
      "content": {
        "type": "text",
        "text": "Actually, let me correct that analysis..."
      }
    }
  }
}
```

## Implementation details and plan

### Phase 1: Core Protocol Changes

1. **Update schema** (`schema/schema.json`):
   * Add optional `messageId` field (type: `string`) to `ContentChunk` (used by `AgentMessageChunk`, `UserMessageChunk`, `AgentThoughtChunk`)
   * Add optional `messageId` field (type: `string`) to `PromptRequest` (client-provided)
   * Add optional `userMessageId` field (type: `string`) to `PromptResponse` (echoed or agent-assigned)

2. **Update Rust SDK** (`rust/client.rs` and `rust/agent.rs`):
   * Add `message_id: Option<String>` field to `ContentChunk` struct
   * Add `message_id: Option<String>` field to `PromptRequest` struct
   * Add `user_message_id: Option<String>` field to `PromptResponse` struct
   * Update serialization to include `messageId`/`userMessageId` in JSON output when present

3. **Update TypeScript SDK** (if applicable):
   * Add `messageId` field to corresponding types

4. **Update documentation** (`docs/protocol/prompt-turn.mdx`):
   * Document the `messageId` and `userMessageId` fields and their semantics
   * Clarify that clients can provide `messageId` for user messages in prompt requests
   * Clarify that agents echo the ID as `userMessageId` in prompt responses
   * Clarify that agents generate `messageId` for agent messages in chunks
   * Add examples showing message boundaries
   * Explain that `messageId` changes indicate new messages

### Phase 2: Reference Implementation

5. **Update example agents**:
   * Modify example agents to generate and include `messageId` in chunks
   * Use simple ID generation (e.g., incrementing counter, UUID)
   * Demonstrate consistent IDs across chunks of the same message

6. **Update example clients**:
   * Update clients to consume `messageId` field
   * Use IDs to properly group chunks into messages
   * Demonstrate clear message boundary rendering

### Backward Compatibility

The `messageId` field is **optional** to ensure this is a non-breaking change. Agents SHOULD include the `messageId` field, but it is not required for v1 compatibility. Features that rely on `messageId` (such as future message editing capabilities) will implicitly require the field to be present - Agents that don't provide it simply won't support those features.

Making this field required will be considered for a future v2 version of the protocol after wide adoption.

## Frequently asked questions

### What alternative approaches did you consider, and why did you settle on this one?

1. **Continue using `_meta` field** - This is the current workaround but:
   * Not standardized across implementations
   * Doesn't signal semantic importance
   * Easy to overlook or implement inconsistently

2. **Detect message boundaries heuristically** - Clients could infer boundaries from timing, content types, or session state:
   * Unreliable and fragile
   * Doesn't work for all scenarios (e.g., consecutive same-type messages)
   * Creates inconsistent behavior across implementations

3. **Use explicit "message start/end" markers** - Wrap messages with begin/end notifications:
   * More complex protocol interaction
   * Requires additional notifications
   * More state to track on both sides

4. **Agent-only message IDs** - Have the Agent generate all IDs (including for user messages):
   * Consistent with protocol patterns (`sessionId`, `terminalId`, `toolCallId`)
   * But creates complexity for returning user message IDs (response comes after streaming)
   * Not all agents support passing user message IDs through
   * Clients may need IDs immediately for deduplication or multi-client scenarios

The proposed approach with `messageId` is:

* **Simple** - Just one new field with clear semantics
* **Flexible** - Enables future capabilities without further protocol changes
* **Practical** - Clients generate IDs for their messages, agents for theirs
* **Collision-safe** - UUID format ensures uniqueness across both sides

### Who generates message IDs?

**Both clients and agents can generate message IDs**, each for their own messages:

* **For user messages**: The Client generates a UUID and includes it as `messageId` in the `session/prompt` request. The Agent echoes this ID as `userMessageId` in the response to confirm it was recorded. If the client doesn't provide one, the Agent MAY assign one and return it in the response so the client knows the assigned ID.
* **For agent messages**: The Agent generates the UUID when creating its response and includes it in session update chunks.

This differs from other protocol identifiers (`sessionId`, `terminalId`, `toolCallId`) which are agent-generated, but provides practical benefits:

* **Immediate availability** - Clients have the ID as soon as they send the message, without waiting for a response
* **Deduplication** - Clients can use IDs to deduplicate messages on `session/load` or when echoing to multiple clients
* **Collision-safe** - UUID format ensures uniqueness without coordination
* **Adapter-friendly** - Adapters for agents that don't support message IDs can simply not pass them through

### Should this field be required or optional?

The field is **optional** for v1 to ensure backward compatibility. Agents SHOULD include `messageId`, but it is not required. Features that depend on `messageId` (such as message editing) will implicitly require it - if an Agent doesn't provide `messageId`, those features simply won't be available.

Making this field required will be considered for a future v2 version of the protocol.

### What format should message IDs use?

Both clients and agents **MUST** use UUID format for message IDs. This is required because both sides can generate IDs, and UUID format ensures:

* **No collisions** - UUIDs are globally unique without coordination between client and agent
* **Interoperability** - Both sides use the same format, so either side can rely on uniqueness guarantees
* **Simplicity** - Standard libraries available in all languages

While `messageId` values are UUIDs, implementations **SHOULD** treat them as opaque strings when reading/comparing them, and not parse or interpret their internal structure.

### What about message IDs across session loads?

When a session is loaded via `session/load`, the Agent may:

* Preserve original message IDs if replaying the conversation history
* Generate new message IDs if only exposing current state

The protocol doesn't require message IDs to be stable across session loads, though Agents MAY choose to make them stable if their implementation supports it.

### Does this apply to other session updates like tool calls or plan updates?

This RFD addresses `agent_message_chunk`, `user_message_chunk`, and `agent_thought_chunk` updates.
Other session update types (like `tool_call`, `plan`) already have their own identification mechanisms:

* Tool calls use `toolCallId`
* Plan entries can be tracked by their position in the `entries` array

Future RFDs may propose extending `messageId` to other update types if use cases emerge.

## Revision history

* **2026-02-17**: Added "Message ID Acknowledgment" section to clarify that presence/absence of `userMessageId` in response indicates whether the Agent recorded the ID; clarified that UUID format is MUST (not SHOULD) since both sides generate IDs; renamed response field to `userMessageId` for clarity (request keeps `messageId`)
* **2026-01-29**: Updated to allow both clients and agents to generate message IDs using UUID format
* **2025-11-09**: Initial draft


# Meta Field Propagation Conventions
Source: https://agentclientprotocol.com/rfds/meta-propagation



* Author(s): [Adrian Cole](https://github.com/codefromthecrypt)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

Document `params._meta` as the convention for propagating metadata from clients to agents, such as trace identifiers or correlation IDs. This aligns with [MCP](https://modelcontextprotocol.io/), enabling shared instrumentation since both protocols use stdio JSON-RPC transports.

## Status quo

ACP clients already propagate context to agents via `_meta`. For example, `requestId` is used for request correlation in [AionUi](https://github.com/iOfficeAI/AionUi/blob/main/src/common/codex/types/eventData.ts#L12-L16).

However, the [extensibility](../protocol/extensibility) documentation does not specify the `_meta` type or document its use for propagation. Without documentation, parties must coordinate ad hoc, which can lead to portability accidents (such as one side using `_meta.traceparent` and the other `_meta.otel.traceparent`). Documenting that propagated fields are root keys in `_meta` prevents this.

## What we propose to do about it

Update the [extensibility](../protocol/extensibility#the-_meta-field) documentation with two changes:

1. Add the type `{ [key: string]: unknown }` to the existing summary sentence. This type is compatible with MCP SDKs.
2. Add a new paragraph after the JSON example about propagation conventions.

## Shiny future

* Same instrumentation (OpenInference, etc.) works for both ACP and MCP.
* Observability tools can correlate traces across protocols.

## Implementation details

**Change 1**: Update the existing summary sentence in [extensibility](../protocol/extensibility#the-_meta-field):

```diff theme={null}
-All types in the protocol include a `_meta` field that implementations can use to attach custom information.
+All types in the protocol include a `_meta` field with type `{ [key: string]: unknown }` that implementations can use to attach custom information.
```

**Change 2**: After the JSON example, before "Implementations **MUST NOT**", add:

> Clients may propagate fields to the agent for correlation purposes, such as `requestId`. The following root-level keys in `_meta` **SHOULD** be reserved for [W3C trace context](https://www.w3.org/TR/trace-context/) to guarantee interop with existing MCP implementations and OpenTelemetry tooling:
>
> * `traceparent`
> * `tracestate`
> * `baggage`

## FAQ

### Why document this now?

Clients already propagate context via `_meta`. Documenting prevents incompatible drift and enables shared tooling with MCP.

### Why reference MCP?

ACP and MCP are the two core agentic protocols, both using stdio JSON-RPC. Where `_meta` types are compatible, instrumentation code can be abstracted and reused for both:

Here are several MCP SDKs that propagate W3C trace-context in `_meta`:

* [MCP C# SDK](https://github.com/modelcontextprotocol/csharp-sdk) - native W3C trace-context propagation
* [OpenInference](https://github.com/Arize-ai/openinference) - Python and TypeScript MCP instrumentation (collaboration between Arize and Elastic)
* [curioswitch/mcp-go-sdk-otel](https://github.com/curioswitch/mcp-go-sdk-otel) - Go MCP instrumentation

## Revision history

* 2025-12-04: Implementation in extensibility docs
* 2025-11-28: Initial draft


# Agent Extensions via ACP Proxies
Source: https://agentclientprotocol.com/rfds/proxy-chains



Author(s): [nikomatsakis](https://github.com/nikomatsakis)

## Elevator pitch

> What are you proposing to change?

Enable a universal agent extension mechanism via ACP proxies, components that sit between a client and an agent. Proxies can intercept and transform messages, enabling composable architectures where techniques like context injection, tool coordination, and response filtering can be extracted into reusable components.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

The AI agent ecosystem has developed many extension mechanisms: AGENTS.md files, Claude Code plugins, rules files, hooks, MCP servers, etc. Of these, only MCP servers have achieved real standardization across the ecosystem.

However, MCP servers are fundamentally limited because they sit "behind" the agent. They can provide tools and respond to function calls, but they cannot:

* **Inject or modify prompts** before they reach the agent
* **Add global context** that persists across conversations
* **Transform responses** before they reach the user
* **Coordinate between multiple agents** or manage conversation flow

As a result, valuable techniques like context management and response processing remain locked within individual agent implementations, with no way to extract and reuse them across different agents.

## What we propose to do about it

> What are you proposing to improve the situation?

We propose implementing *agent extensions* via ACP *proxies*, a new kind of component that sits between the client and the agent, forwarding (and potentially altering or introducing) messages. Because proxies can do anything a client could do, they serve as a universal extension mechanism that can subsume AGENTS.md, hooks, MCP servers, etc.

Proxies are limited to the customizations exposed by ACP itself, so they would benefit from future ACP extensions like mechanisms to customize system prompts. However, they can already handle the majority of common extension use cases through message interception and transformation.

### Proxying in theory

Conceptually, proxies work like a chain where messages flow through each component:

```mermaid theme={null}
flowchart LR
    Client[ACP Client] -->|messages| P1[Context Proxy]
    P1 -->|enhanced| P2[Tool Filter Proxy]
    P2 -->|filtered| A[Base Agent]
    A -->|responses| P2
    P2 -->|processed| P1
    P1 -->|final| Client
```

### Proxying in practice: the role of the conductor

To allow for proxy isolation, our design does not have proxies communicate directly with their successor in the chain. Instead, there is a central *conductor* component that orchestrates messages moving between components.

```mermaid theme={null}
flowchart TB
    Client[Client]
    C[Conductor]
    P1[Context Proxy]
    P2[Tool Filter Proxy]
    A[Agent]

    Client <-->|ACP| C
    C <-->|ACP| P1
    C <-->|ACP| P2
    C <-->|ACP| A
```

We add one ACP method for proxy communication:

* **`proxy/successor`**: Used bidirectionally - proxies send it to forward messages to their successor, and the conductor sends it to deliver messages from the successor back to the proxy

Here's how a single message flows through the system:

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Conductor
    participant P1 as Context Proxy
    participant P2 as Tool Filter Proxy
    participant Agent

    Client->>Conductor: prompt request
    Conductor->>P1: prompt request
    P1->>Conductor: proxy/successor (enhanced prompt)
    Conductor->>P2: enhanced prompt
    P2->>Conductor: proxy/successor (filtered prompt)
    Conductor->>Agent: filtered prompt
    Agent-->>Conductor: response
    Conductor-->>P2: response
    P2-->>Conductor: processed response
    Conductor-->>P1: processed response
    P1-->>Conductor: final response
    Conductor-->>Client: final response
```

## Shiny future

> How will things play out once this feature exists?

### User experience and editor integration

We expect editors to expose the ability to install proxies in the same way they currently support adding MCP servers - in fact, the distinction probably doesn't matter to users. Both are "extensions" that add capabilities to their AI workflow.

When proxies are installed, editors would not start the agent directly, but instead invoke the conductor with the configured proxy chain. From the user's perspective, they're just getting enhanced agent capabilities - the proxy chain architecture remains transparent.

### Language-specific proxy ecosystems

The monolithic nature of agent development has meant that most of the "action" happens within agents. We wish to invert this, with agents trending towards simple agentic loops, and the creativity being pushed outwards into the broader ecosystem.

The Symposium project is one example exploring this concept, with a focus on Rust. The idea is to give Rust users an automatic set of extensions based on the dependencies they are using. These extensions would be packaged up as SACP proxies using WebAssembly for portability and sandboxing.

Symposium aims to become the standard "Rust ACP experience" by providing both core Rust tooling and a framework for Rust libraries to contribute their own proxy components.

```mermaid theme={null}
flowchart LR
    Client[Client]
    Conductor[Conductor]
    Agent[Agent]

    subgraph Symposium["symposium-acp proxy"]
        RustTools[Rust Language Tools]
        CrateA[tokio-acp proxy]
        CrateB[serde-acp proxy]
        CrateC[bevy-acp proxy]

        RustTools --> CrateA
        CrateA --> CrateB
        CrateB --> CrateC
    end

    Client --> Conductor
    Conductor --> Symposium
    Symposium --> Agent
```

### Standardized IDE capabilities

Proxy infrastructure could also enable editors to expose standardized IDE capabilities (diagnostics, file system access, terminal APIs) to agents via MCP servers provided by proxies. This keeps the core ACP protocol focused on agent communication while allowing rich IDE integration through the proxy layer.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

### Component roles

Each ACP proxy chain forms a sequence of components:

```mermaid theme={null}
flowchart LR
    Client --> Proxy0 --> Proxy1 --> ... --> ProxyN --> Agent
```

The **client** and **agent** are *terminal* roles - the client has only a successor (no predecessor), and the agent has only a predecessor (no successor). Proxies are *non-terminal* - they have both a predecessor and a successor, forwarding messages between them.

The **conductor** is a special component that orchestrates proxy chains. It spawns and manages proxy components, routes messages between them, and handles initialization. From the client's perspective, the conductor appears to be an ordinary agent:

```mermaid theme={null}
flowchart LR
    Client -->|ACP| Conductor

    subgraph Managed["Managed by Conductor"]
        Proxy0 --> Proxy1 --> ... --> Agent
    end

    Conductor -.->|spawns & routes| Managed
```

We provide a canonical conductor implementation in Rust (`sacp-conductor`). Most editors would use this conductor directly to host proxies and agents, though they could also reimplement conductor functionality if needed.

ACP defines client and agent as superroles, each with two specializations:

```mermaid theme={null}
classDiagram
    class Client {
        <<abstract>>
        +sends prompts
    }

    class Agent {
        <<abstract>>
        +responds to prompts
    }

    class TerminalClient {
        +receives direction from user
        +connects to terminal agent
    }

    class Conductor {
        +manages proxy chain
        +sends successor messages
    }

    class TerminalAgent {
        +embodies the LLM
        +final destination
        +no successor
    }

    class Proxy {
        +forwards to successor
        +sends successor messages
    }

    Client <|-- TerminalClient
    Client <|-- Conductor
    Agent <|-- TerminalAgent
    Agent <|-- Proxy
```

**Example Architecture:**

```mermaid theme={null}
flowchart TB
    TC[Terminal Client]
    C[Conductor]
    P1[Context Proxy]
    P2[Tool Filter Proxy]
    TA[Terminal Agent]

    TC -->|terminal client| C
    C -->|terminal agent| TC
    C -->|conductor| P1
    P1 -->|proxy| C
    C -->|conductor| P2
    P2 -->|proxy| C
    C -->|terminal client| TA
    TA -->|terminal agent| C
```

### Proxy initialization protocol

Components discover their role from the initialization method they receive:

* **Proxies** receive `proxy/initialize` - they have a successor and should forward messages
* **Agents** receive `initialize` - they are terminal (no successor) and process messages directly

The `proxy/initialize` request has the same parameters as `initialize` and expects a standard `InitializeResponse`. The only difference is the method name, which signals to the component that it should operate as a proxy.

**Conductor behavior:**

* The conductor MUST send `proxy/initialize` to all proxy components
* The conductor MUST send `initialize` to the final agent component (if any)
* When a proxy forwards an `initialize` via `proxy/successor`, the conductor determines whether the successor is another proxy or the agent, and sends `proxy/initialize` or `initialize` respectively.

**Proxy behavior:**

* A proxy that receives `proxy/initialize` knows it has a successor
* The proxy SHOULD forward requests it does not understand
* The proxy SHOULD preserve metadata fields when forwarding messages

Note: A conductor can be configured to run in either terminal mode (expecting `initialize`) or proxy mode (expecting `proxy/initialize`), enabling nested proxy chains.

### MCP-over-ACP support

Proxies that provide MCP servers use the [MCP-over-ACP transport](./mcp-over-acp) mechanism. The conductor always advertises `mcpCapabilities.acp: true` to proxies and handles bridging for agents that don't support native ACP transport.

All proxies MUST respond to `proxy/initialize` with the MCP-over-ACP capability enabled. When the conductor sends `proxy/initialize`, proxies should be prepared to handle `mcp/connect`, `mcp/message`, and `mcp/disconnect` messages for any MCP servers they provide.

### Message reference

**Initialization:**

```json theme={null}
// Conductor initializes a proxy (proxy knows it has a successor)
{"method": "proxy/initialize", "params": <INITIALIZE_REQUEST_PARAMS>}

// Conductor initializes the agent (standard ACP)
{"method": "initialize", "params": <INITIALIZE_REQUEST_PARAMS>}
```

Both methods use the same parameters as the standard ACP `InitializeRequest` and expect a standard `InitializeResponse`.

**Proxy messages:**

```json theme={null}
// Proxy sends message to successor, or conductor delivers message from successor
// (same method, direction determined by sender)
{
  "method": "proxy/successor",
  "params": {
    "method": "<INNER_METHOD>",
    "params": <INNER_PARAMS>,
    "meta": { ... }            // optional metadata
  }
}
```

The inner message fields (`method`, `params`) are flattened into the params object. Whether the wrapped message is a request or notification is determined by the presence of an `id` field in the outer JSON-RPC envelope, following JSON-RPC conventions.

### Examples (non-normative)

The following sequence diagrams illustrate common proxy chain scenarios for implementers.

#### Initialization of a 4-component proxy chain

This shows the initialization flow for: Terminal Client → Conductor → Context Proxy → Tool Filter Proxy → Terminal Agent

```mermaid theme={null}
sequenceDiagram
    participant TC as Terminal Client
    participant C as Conductor
    participant P1 as Context Proxy
    participant P2 as Tool Filter Proxy
    participant TA as Terminal Agent

    Note over TC,TA: === Initialization Phase ===

    TC->>C: initialize

    Note over C: Conductor spawns proxy components
    C->>P1: proxy/initialize

    Note over P1: Proxy forwards to successor
    P1->>C: proxy/successor (initialize)

    Note over C: Conductor sends proxy/initialize to next proxy
    C->>P2: proxy/initialize

    Note over P2: Proxy forwards to successor
    P2->>C: proxy/successor (initialize)

    Note over C: Conductor sends initialize to final agent
    C->>TA: initialize

    TA-->>C: InitializeResponse (mcpCapabilities.acp: true/false)
    C-->>P2: proxy/successor (InitializeResponse)

    P2-->>C: InitializeResponse
    C-->>P1: proxy/successor (InitializeResponse)

    P1-->>C: InitializeResponse

    Note over C: Conductor acts as terminal agent to client
    C-->>TC: InitializeResponse

    Note over TC,TA: Proxy chain initialized and ready
```

#### Context-providing proxy with session notifications

This example shows how a proxy can handle initialization and forward session notifications. Sparkle (a collaborative AI framework) runs an embodiment sequence during session creation.

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Sparkle as Sparkle Proxy
    participant Agent

    Note over Client: Client creates new session
    Client->>Sparkle: session/new

    Note over Sparkle: Adds Sparkle MCP server
    Sparkle->>Agent: session/new + sparkle tools
    Agent-->>Sparkle: session created (sessionId: S1)
    Sparkle-->>Client: session/new response (sessionId: S1)

    Note over Client: Client sends first prompt (during embodiment)
    Client->>Sparkle: prompt ('Hello, can you help me?')
    activate Sparkle

    Note over Sparkle: Delays client prompt, runs embodiment first
    Sparkle->>Agent: prompt ('you are sparkle...')

    Note over Agent: Processes embodiment, sends notifications
    Agent->>Sparkle: session/update (S1: thinking...)
    Sparkle->>Client: session/update (S1: thinking...)

    Agent->>Sparkle: session/update (S1: embodiment complete)
    Sparkle->>Client: session/update (S1: embodiment complete)

    Agent-->>Sparkle: embodiment response
    Note over Sparkle: Discards embodiment response, now processes delayed prompt

    Sparkle->>Agent: prompt ('Hello, can you help me?')
    deactivate Sparkle
    Agent-->>Sparkle: response to client
    Sparkle-->>Client: response to client

    Note over Client,Agent: Session ready with Sparkle patterns active
```

This demonstrates how proxies can run initialization sequences during session creation while transparently forwarding all session notifications back to the client.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### Why use a separate `proxy/initialize` method instead of a capability?

Earlier designs used a `"proxy": true` capability in the `InitializeRequest` and required proxies to echo it back in the response. This felt awkward because it wasn't really a capability negotiation - it was more of a "you must operate as a proxy" directive.

Using a distinct method makes the contract clearer: if you receive `proxy/initialize`, you're a proxy with a successor; if you receive `initialize`, you're the terminal agent. There's no capability dance, no risk of misconfiguration, and components know their role immediately from the method name.

### How do proxies subsume existing agent extension mechanisms?

Because proxies sit between the client and agent, they can replicate the functionality of existing extension mechanisms:

* **AGENTS.md files**: Proxies can inject context and instructions into prompts before they reach the agent
* **Claude Code plugins/skills**: Proxies can add contextual data for available skills and provide MCP resources with detailed skill instructions that are provided on-demand when requested by the agent
* **MCP servers**: Proxies can provide tools via [MCP-over-ACP](./mcp-over-acp) and handle tool callbacks
* **Subagents**: Proxies can create "subagents" by initiating new sessions and coordinating between multiple agent instances
* **Hooks and steering files**: Proxies can modify conversation flow by intercepting requests and responses
* **System prompt customization**: Proxies can switch between predefined session modes or prepend system messages to prompts

The key advantage is that proxy-based extensions work with any ACP-compatible agent without requiring agent-specific integration or modification.

### How do proxies work with MCP servers?

Proxies can provide MCP servers via [MCP-over-ACP transport](./mcp-over-acp), enabling a single proxy to add context, provide tools, and handle callbacks with full awareness of the conversation state.

The conductor always advertises `mcpCapabilities.acp: true` to proxies, regardless of whether the downstream agent supports it natively. When the agent doesn't support ACP transport, the conductor handles bridging transparently - spawning stdio shims or HTTP servers that the agent connects to normally, then relaying messages to/from the proxy's ACP channel.

This means proxy authors don't need to worry about agent compatibility - they implement MCP-over-ACP, and the conductor handles the rest.

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant P1 as Context Proxy
    participant P2 as Filter Proxy
    participant Agent

    Note over Client: User asks about project structure
    Client->>P1: prompt request

    Note over P1: Analyzes project, adds context + filesystem MCP server
    P1->>P2: enhanced prompt + filesystem MCP server

    Note over P2: Forwards enhanced prompt
    P2->>Agent: prompt with context + tools available

    Note over Agent: Decides to explore project structure
    Agent->>P2: mcp/message (list files)

    Note over P2: Forwards tool call back to Context Proxy
    P2->>P1: mcp/message (list files)

    Note over P1: Handles tool call with full project context
    P1-->>P2: file listing with relevant details
    P2-->>Agent: file listing with relevant details

    Agent-->>P2: response using both context and tool results
    P2-->>P1: response (potentially filtered)
    P1-->>Client: final response
```

### Are there any limitations to what proxies can do?

Yes, proxies are limited to what is available through the ACP protocol itself. They can intercept and transform any ACP message, but they cannot access capabilities that ACP doesn't expose.

For example, proxies cannot directly modify an agent's system prompt or context window - they can only switch between predefined session modes (which may affect system prompts) or prepend additional messages to prompts. Similarly, proxies cannot access internal agent state, model parameters, or other implementation details that aren't exposed through ACP messages.

This is actually a feature - it ensures that proxy-based extensions remain portable across different agent implementations and don't rely on agent-specific internals.

### Why not just cascade ACP commands without protocol changes?

One alternative is to make proxies be ordinary agents that internally create and manage their successors. This works (HTTP proxies operate this way) but requires each proxy to understand the full chain and know how to start its successors.

This couples proxies to transport mechanisms, process management, and chain configuration. Changing transports, reordering the chain, or inserting a new proxy requires modifying predecessor configurations.

The conductor design decouples proxies from their successors. Proxies send messages "to successor" and receive messages "from successor" without knowing who that successor is, how it's started, or what transport it uses. This enables:

* Changing transport protocols or process management without recompiling proxies
* Shipping proxies as low-capability WASM containers that need only a single communication channel
* Reordering, adding, or removing proxies through configuration rather than code changes

The tradeoff is protocol complexity, but this complexity lives in the conductor (implemented once) rather than being duplicated across proxy implementations.

### Why do all messages go through the conductor instead of direct proxy-to-proxy communication?

Even with a conductor, proxies could communicate directly with their successors after the conductor sets up connections. Routing all messages through the conductor further minimizes proxy responsibilities to a single communication channel.

This supports running proxies as isolated WebAssembly components with minimal capabilities. It also removes redundant logic: without the conductor routing messages, each proxy would need to manage connections to its successor.

The conductor handles process management, capability negotiation, and message routing, allowing proxies to focus on transformation logic.

### How does the standard conductor implementation work?

The `sacp-conductor` reference implementation can form trees of proxy chains. It can be configured to run in proxy mode (expecting `proxy/initialize`) or terminal mode (expecting `initialize`). When the last proxy in its managed chain sends a message to its successor, the conductor forwards that message to its own parent conductor (if in proxy mode) or to the final agent (if in terminal mode).

This enables hierarchical structures like:

```
client → conductor1 → final-agent
             ↓ manages
         proxy-a → conductor2 → proxy-d
                      ↓ manages
                  proxy-b → proxy-c
```

The conductor handles process management, capability negotiation, and message routing, but these are implementation details - the protocol only specifies the message formats and capability requirements.

### What about security concerns with proxy chains?

Proxy components can intercept and modify all communication, so trust is essential - similar to installing any software. Users are responsible for the components they choose to run.

We plan to explore WebAssembly-based proxies which will offer some measure of sandboxing but such components could still modify prompts in unknown or malicious ways.

### What about performance implications of the proxy chain?

Our architecture does introduce additional message passing - each proxy in the chain adds extra hops as messages flow through the conductor. However, these messages are typically small and inexpensive, particularly when compared to the latency of actual LLM inference.

For messages that contain significant quantities of data (large file contents, extensive context), we may wish to have the conductor store that data centrally and introduce a "reference" mechanism so that most proxies don't have to inspect or copy large payloads unless they specifically need to transform them.

The benefits of composability typically outweigh the minimal latency costs for human-paced development interactions.

### What happens when proxy components crash or misbehave?

The conductor manages component lifecycles:

* Failed components are restarted automatically where possible
* Component crashes don't affect the rest of the chain
* Graceful degradation by bypassing failed components
* Clear error reporting to help users debug configuration issues

### Can proxy chains be nested or form trees?

Yes! The conductor can itself run in proxy mode, enabling hierarchical structures:

```
client → proxy1 → conductor (proxy mode) → final-agent
                      ↓ manages
                  p1 → p2 → p3
```

This enables complex compositions while maintaining clean interfaces.

### How could proxy chains support multi-agent scenarios in the future?

The current design assumes a linear chain where each proxy has a single successor. To support M:N topologies where a proxy communicates with multiple peers (e.g., a research coordinator dispatching to multiple specialized agents), we could extend `proxy/successor` with an optional `peer` field:

```json theme={null}
{
  "method": "proxy/successor",
  "params": {
    "method": "prompt",
    "params": { ... },
    "peer": "research-agent"
  }
}
```

When `peer` is omitted, the message goes to the default successor (backwards compatible with the current linear chain model). When present, it specifies which peer the message is intended for. The `proxy/initialize` response could be extended to enumerate available peers, enabling proxies to discover and coordinate between multiple downstream components.

### What's the current implementation status?

A prototype version of this proposal has been implemented and is available on crates.io as the crates:

* `sacp` -- base ACP protocol SDK
  * `sacp-tokio` -- adds specific utilities for use with the `tokio` runtime
* `sacp-proxy` -- extensions for implementing a proxy
  * `sacp-rmcp` -- adds specific proxy extension traits for bridging to the rmcp crate
* `sacp-conductor` -- reference conductor implementation

The canonical sources for those crates is currently the \[symposium-dev/symposium-acp] repository. However, copies have been upstreamed to the [agentclientprotocol/rust-sdk](https://github.com/agentclientprotocol/rust-sdk/tree/main/src/sacp-conductor) repository and, if and when this RFD is accepted, that will become the canonical home.

## Revision history

* Initial draft based on working implementation in symposium-acp repository.
* Split MCP-over-ACP transport into [separate RFD](./mcp-over-acp) to enable independent use by any ACP component.


# Request Cancellation Mechanism
Source: https://agentclientprotocol.com/rfds/request-cancellation



* Author(s): [Artem Bukhonov](https://github.com/nerzhulart)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

Introduce a standardized per-request cancellation mechanism for the Agent Client Protocol, inspired by the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#cancelRequest), to enable a more granular cancellation of requests where individual JSON-RPC requests can be cancelled one by one.

## Status quo

The JSON-RPC specification doesn't define any standard mechanism for request cancellation and leaves it up to the implementation. Currently, ACP has some ad-hoc cancellation mechanisms for specific features (like prompt turn cancellation via `session/cancel`), but lacks a general-purpose, per-request cancellation mechanism.

This creates the following inconveniences:

* cancellation should be handled for each feature separately
* some languages that support handy cancellation mechanisms (C#, Kotlin, etc.) can't implement general-purpose request cancellation using ACP low-level machinery, and rather developers should manually call per-feature cancellation methods

## What we propose to do about it

Implement an **optional** `$/cancel_request` notification method (inspired by the Language Server Protocol) to both Agent and Client that uses JSON-RPC 2.0 notification format, allowing either party (client or agent) to cancel any outstanding request by its ID.

The mechanism will be:

* **Optional**: Not all implementations may support this feature, but it is recommended for those that do.
* **Flexible**: Provides two response options when cancellation is received:
  1. An error response with the standard cancellation error code (-32800)
  2. A valid response with partial or cancelled data (when meaningful partial results exist)

This approach balances flexibility with standardization, allowing implementations to opt-in to cancellation support while providing predictable behavior when enabled.

## Shiny future

Once implemented, this enables:

* **SDK integration layer**: Default mechanism that ACP SDKs can automatically wire to native language cancellation (C# CancellationToken, Kotlin Job, Go context.Context, JavaScript AbortController, etc.)
* Individual JSON-RPC request cancellation without affecting other concurrent requests
* Universal fallback for any request when feature-specific cancellation methods don't exist
* Consistent cancellation behavior from both external `$/cancel_request` and internal cancellation triggers
* Standard error response (`-32800`) or partial results when requests are cancelled regardless of cancellation source

In a future version, we could potentially deprecate the `session/cancel` notification in favor of the more general approach, as it would still provide the same functionality but with more flexibility and consistency.

## Implementation details and plan

### Protocol Changes

#### Cancellation Method

Add the `$/cancel_request` notification method to the JSON-RPC protocol:

```typescript theme={null}
interface CancelNotification {
  method: "$/cancel_request";
  params: {
    requestId: string | number; // ID of request to cancel
  };
}
```

### Cancellation Behavior

Either party can send `$/cancel_request` to cancel requests. Notifications whose methods start with '$/' are messages which are protocol implementation dependent and might not be implementable in all clients or agents. For example if the implementation uses a single threaded synchronous programming language then there is little it can do to react to a `$/cancel\_request\` notification. If an agent or client receives notifications starting with '\$/' it is free to ignore the notification.

The **receiving party** is **NOT** required to:

* Perform special handling for unsupported cancellation requests
* Return custom errors for unsupported `$/cancel_request` notifications

#### Cancellation Processing

When a `$/cancel_request` notification is received by a supporting implementation, it:

* **MUST** cancel the corresponding request activity and all nested activities related to that request
* **MAY** finish sending any pending notifications before responding
* **MUST** send one of these responses for the original request:
  * A valid response with appropriate data (such as partial results or cancellation marker)
  * An error response with code [`-32800` (Request Cancelled)](./schema#errorcode)

#### Internal Cancellation

Requests can also be cancelled internally by the executing party without receiving `$/cancel_request`:

* **Client-side examples**: User closes IDE, switches to different project, file becomes unavailable
* **Agent-side examples**: LLM context limit reached, internal timeout, resource constraints

When internal cancellation occurs, the executing party **SHOULD**:

1. Send the same `-32800` (Cancelled) error response as if `$/cancel_request` was received
2. Ensure consistent behavior regardless of cancellation source

### Error Code

Add standard JSON-RPC error code `-32800` for cancelled requests:

* Code: `-32800`
* Message: "Request cancelled"
* Meaning: Execution of the method was aborted either due to a cancellation request from the caller or because of resource constraints or shutdown.

## Frequently asked questions

### What alternative approaches did you consider, and why did you settle on this one?

The core need is to add **granular cancellation** as a general mechanism for individual JSON-RPC requests, while **feature-specific cancellation methods** (like `session/cancel`) remain useful for cases requiring additional domain semantics.

We selected the **LSP-style `$/cancel_request`** approach because:

* Serves as a **default cancellation layer** that SDK implementations can easily map to native language cancellation mechanisms
* Proven pattern familiar to developers from LSP ecosystem
* Works across all JSON-RPC transports (HTTP, WebSocket, stdio, pipes)
* Provides universal fallback when feature-specific cancellation doesn't exist
* Complements existing feature-specific methods rather than replacing them

### How does this relate to existing cancellation mechanisms like `session/cancel`?

The `$/cancel_request` mechanism is complementary to feature-specific cancellation:

* `$/cancel_request`: Generic cancellation for any JSON-RPC request by ID
* `session/cancel`: Feature-specific cancellation with additional semantics (e.g., cancels entire prompt turn context, triggers specific cleanup logic)

Both mechanisms serve different purposes:

**Feature-specific methods** like `session/cancel` provide:

* Domain-specific semantics and behavior
* Structured cleanup for complex operations
* Context-aware cancellation logic

**Generic `$/cancel_request`** provides:

* Default cancellation layer that bridges programming language cancellation mechanisms (C# CancellationToken, Kotlin Job, Go context.Context, etc.) with ACP
* Universal fallback for any request when no feature-specific method exists
* Simple ID-based targeting for SDK convenience
* Standardized error responses

Implementations can use both: feature-specific methods for rich semantics, and `$/cancel_request` for simple per-request cancellation.

Note: it is possible that `session/cancel` could be replaced by the more generic `$/cancel_request` in future versions of the protocol.

#### Example: Cascading Cancellation Flow

```mermaid theme={null}
sequenceDiagram
    participant Client
    participant Agent

    Note over Client,Agent: 1. Session prompt in progress
    Client->>Agent: session/prompt (id=1, "Analyze file X")
    Agent-->>Client: session/update (agent started processing)

    Note over Client,Agent: 2. Agent makes concurrent requests
    Agent->>Client: terminal/create (id=2, "grep pattern file.txt")
    Agent->>Client: session/request_permission (id=3, "read sensitive file")

    Note over Client,Agent: 3. Client cancels the prompt turn
    Client->>Agent: session/cancel (sessionId)

    Note over Client,Agent: 4. Agent cascades cancellation internally
    Agent->>Client: $/cancel_request (id=2) [terminal request]
  Agent->>Client: $/cancel_request (id=3) [permission request]

    Note over Client,Agent: 5. Client confirms individual cancellations
    Client->>Agent: response to id=2 (error -32800 "Cancelled")
    Client->>Agent: response to id=3 (error -32800 "Cancelled")

    Note over Client,Agent: 6. Agent completes prompt cancellation
    Agent->>Client: response to id=1 (stopReason: "cancelled")
```

### What happens if a request completes before the cancellation is processed?

If a request completes normally before the cancellation notification is processed, the implementation should:

1. Send the normal response (not a cancellation error)
2. Ignore the subsequent cancellation notification for that request ID

This ensures clients always receive meaningful responses and prevents race conditions.

### How should implementations handle cascading cancellation?

When a request is cancelled, implementations should:

1. Cancel the primary request activity
2. Propagate cancellation to any nested/child requests
3. Clean up resources associated with the entire request tree
4. Send cancellation responses for all affected requests

This ensures complete cleanup and prevents resource leaks.

## Revision history

* 2025-11-13: Initial version converted from PR #183
* 2025-12-05: Updated with current implementation.
* 2025-12-09: Mirror LSP behavior.


# Rust SDK based on SACP
Source: https://agentclientprotocol.com/rfds/rust-sdk-v1



Author(s): [nikomatsakis](https://github.com/nikomatsakis)

## Elevator pitch

> What are you proposing to change?

Replace the current ACP Rust SDK with a new implementation based on SACP (Symposium ACP). The new SDK provides a component-based architecture with builder patterns, explicit message ordering guarantees, and first-class support for [Proxy Chains](./proxy-chains) and [MCP-over-ACP](./mcp-over-acp).

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

The current `agent-client-protocol` crate has a straightforward design with trait-based callbacks for common ACP methods and well-typed requests and responses. It's convenient for simple purposes but quickly becomes awkward when attempting more complex designs.

Two examples that we found pushed the limits of the design are the *conductor* (from the [proxy chains](./proxy-chains) RFD) and the [patchwork-rs](https://patchwork-lang.github.io/patchwork-rs/) project:

The Conductor is an orchestrator that routes messages between proxies, agents, and MCP servers. It must adapt messages as they flow through the system and maintain the correct ordering.

Patchwork is a programmatic interface for working with agents. It allows Rust programs to run prompts that provide custom tools (implemented using [MCP-over-ACP](./mcp-over-acp)) and messages:

```rust theme={null}
let mut results = Vec::new();

let _: () = patchwork.think()
    .text("Process each item and record it using the `record` tool")
    .tool(
        "record",
        "Record a processed item",
        async |input: RecordInput, _cx| {
            results.push(input.item);
            Ok(RecordOutput { success: true })
        },
        acp::tool_fn_mut!(),
    )
    .await?;

// After the think block, `results` contains all recorded items
println!("Recorded: {:?}", results);
```

### Limitation: Handlers can't send messages

The current SDK uses traits like `Agent` where handler methods receive only the request and return only the response:

```rust theme={null}
#[async_trait]
pub trait Agent {
    async fn prompt(&self, args: PromptRequest) -> Result<PromptResponse>;
    // ...
}
```

There's no (easy) way to send messages back to the client from within a handler. If you want to send a `SessionNotification` while processing a prompt, you need to obtain an `AgentSideConnection` through some other means and coordinate access yourself.

This is awkward for agents (which want to stream progress during prompt processing) and prohibitive for proxies (which need to forward messages to their successor while handling a request from their predecessor).

**Goal:** Handlers should receive a context parameter that provides methods to send requests and notifications back through the connection.

### Limitation: Fixed set of handlers

ACP is an extensible protocol where users can add their own method names beginning with `_`. The current SDK uses a trait which means that it cannot offer "first-class" support for user-defined requests/notifications. Instead, these are handled using extension methods (`ext_method`, `ext_notification`). These methods have no static typing and require the user to work with raw JSON.

**Goal:** Allow SDK users to define their own request/notification types that are handled in the same fashion as built-in types.

### Limitation: Message handlers must be the same across all session

The current API always executes the same handler code for a particular method (e.g., a session/update). If different handling is required for a particular session, that handler must maintain some kind of map from session-id to identify what handling is required, which is non-trivial bookkeeping that can become awkward. As an example of how complex this can get, consider the [elaborate message forwarding scheme](https://nikomatsakis.github.io/threadbare/agent.html#full-trace-nested-think) used by older versions of patchwork.

**Goal:** Allow SDK users to add/remove "dynamic" handlers that are specific to a particular session or other part of the protocol. These handlers should be closures so they can capture state.

### Limitation: No ordering guarantees

In the current SDK, every incoming request or notification results is handled in a freshly spawned task. This means that it is not possible to guarantee that requests or notifications are handled in the order they arrive. It is also not possible to be sure that a notification is fully handled before the response to another request; this makes it difficult to, for example, be sure that a `session/update` notification is handled before the turn is ended (which is sent as the response to the `prompt` request). This is essential for an application like patchwork, which wishes to fully capture the updates before returning.

**Goal:** Handlers should block message processing to allow them to ensure that they fully process a message before other messages are processed.

### Limitation: Confusing naming and 1:1 assumption

`AgentSideConnection` is ambiguous - does this represent the agent, or the connection *to* an agent? What's more, the SDK currently assumes that each connection has a single peer, but [proxies](./proxy-chains) may wish to send/receive messages from multiple peers (client or agent). This was a constant source of confusion in early versions of the conductor and frequently required the author to get out a pencil and paper and work things out very carefully.

**Goal:** Use directional naming like `ClientToAgent` that makes relationships explicit: "I am the client, the remote peer is an agent." Enable multiple peers.

### Limitation: Awkward to connect components

When building tests and other applications, it's convenient to be able to create a client and connect it directly to an agent, leaving the plumbing to the framework. The current SDK only accepts channels and byte-streams which creates unnecessary boilerplate.

**Goal:** Provide a `Component` trait that abstracts over anything that can connect to an ACP transport, enabling uniform handling in orchestration scenarios.

### Challenge: Executor independence and starvation freedom

This isn't a limitation of the current SDK per se, but a common pitfall in async Rust designs that we want to address.

We want the SDK to be independent from specific executors (not tied to tokio) while still supporting richer patterns like spawning background tasks. One specific common issue with Rust async APIs is *starvation*, which can occur with stream-like APIs where it is important to keep awaiting the stream so that items make progress. For example, in a setup like this one, the "connection" is not being "awaited" while each message is handled:

```rust theme={null}
// PROBLEMATIC: message handling starves while processing
while let Some(message) = connection.next().await {
    process(message).await; // connection is quiescent during this await!
}
```

With careful design, it is possible to avoid these hazards. The most common way is either to spawn tasks (which then ties one to a specific executor) or to use "interior iteration" style APIs like `for_each` or `run_until`:

```rust theme={null}
// CORRECT: message handling continues concurrently
connection.run_until(async |cx| {
    // The connection processes messages while this code runs
    let response = cx.send_request(request).block_task().await?;
    process(response).await
}).await
```

**Goal:** Provide APIs that are starvation-free by design, making it difficult to accidentally block message processing.

## What we propose to do about it

> What are you proposing to improve the situation?

We propose to adopt the design and implementation from [`sacp`](https://github.com/symposium-dev/symposium-acp/) (developed as part of the [Symposium project](https://symposium.dev)) as the foundation for `agent-client-protocol` v1.0. The `sacp` crates will be imported into this repository and renamed:

| Current             | New name                             |
| ------------------- | ------------------------------------ |
| `sacp`              | `agent-client-protocol` (v1.0)       |
| `sacp-derive`       | `agent-client-protocol-derive`       |
| `sacp-tokio`        | `agent-client-protocol-tokio`        |
| `sacp-rmcp`         | `agent-client-protocol-rmcp`         |
| `sacp-conductor`    | `agent-client-protocol-conductor`    |
| `sacp-test`         | `agent-client-protocol-test`         |
| `sacp-tee`          | `agent-client-protocol-tee`          |
| `sacp-trace-viewer` | `agent-client-protocol-trace-viewer` |

The `sacp` crates will then be deprecated in favor of the `agent-client-protocol` family. The new SDK addresses the limitations above through a builder-based API with explicit connection semantics.

The following table summarizes the key API concepts and which goals they address:

| API Concept                                                                         | Goals Addressed                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------- |
| [Link types](#link-types-and-directional-naming) (`ClientToAgent`, `AgentToClient`) | Confusing naming, 1:1 assumption          |
| [`Component` trait + `connect_to`](#the-component-trait-and-connect_to)             | Awkward to connect components             |
| [Connection context (`cx`)](#sending-messages)                                      | Handlers can't send messages              |
| [`on_receive_*` handlers](#handling-messages) with closure types                    | Fixed set of handlers                     |
| [`serve` / `run_until`](#running-connections-serve-and-run_until)                   | Executor independence, starvation freedom |
| [Session builders + dynamic handlers](#session-builders-and-mcp-servers)            | Handlers must be same across sessions     |
| [Ordering guarantees + `spawn`](#controlling-ordering)                              | No ordering guarantees                    |

We have validated the design by implementing a number of use cases:

* **sacp-conductor** (to be renamed **agent-client-protocol-conductor**) - implementation of the conductor from the [proxy chains](./proxy-chains) RFD
* [Patchwork](https://patchwork-lang.github.io/patchwork-rs/) - programmatic agent orchestration
* **elizacp** - agent implementing the classic ELIZA program
* **agent-client-protocol-tee** - proxy that logs messages before forwarding
* **yopo** ("You Only Prompt Once") - CLI tool for single prompts

The [Deep dive](#deep-dive) section below walks through each concept in detail.

## Deep dive

This section walks through the SDK concepts in detail, organized by what you're trying to do.

### Getting up and going

#### Link types and directional naming

The SDK is organized around *link types* that describe who you are and who you're talking to. The two most common examples are:

* `ClientToAgent` - "I am a client, connecting to an agent"
* `AgentToClient` - "I am an agent, serving a client"

To build a connection, start with the link type and invoke the `builder` method. Builders use the typical "fluent" style:

```rust theme={null}
// As a client connecting to an agent
ClientToAgent::builder()
    .name("my-client") // optional, useful for tracing
```

```rust theme={null}
// As an agent serving clients
AgentToClient::builder()
    .name("my-agent") // optional, useful for tracing
```

Most types in the SDK are parameterized by the link type. This helps document the intent of the connection and also determines default method handling when no event handler is registered. (Both `ClientToAgent` and `AgentToClient` generally error on unhandled messages, but proxies default to forwarding.)

#### The `Component` trait and `connect_to`

The `connect_to` method connects your builder to the other side. The argument can be anything that implements the `Component<Link>` trait, which abstracts over anything that can communicate via JSON-RPC:

```rust theme={null}
// Connect to an agent over stdio
ClientToAgent::builder()
    .connect_to(acp::stdio())
```

The `AcpAgent` type allows connecting to an external ACP agent or agent extension:

```rust theme={null}
// Connect to a specific agent by command
ClientToAgent::builder()
    .connect_to(AcpAgent::from_str("some-command --acp"))

// Connect to Zed's Claude Code integration
ClientToAgent::builder()
    .connect_to(AcpAgent::zed_claude_code())
```

For testing, you can connect builders directly to each other - no transport setup required:

```rust theme={null}
ClientToAgent::builder()
    .connect_to(AgentToClient::builder())
```

Or connect to a struct that implements `Component`:

```rust theme={null}
impl Component<AgentToClient> for MyAgent {
    async fn serve(self, client: impl Component<ClientToAgent>) -> Result<(), acp::Error> {
        AgentToClient::builder()
            .on_receive_request(/* ... */)
            .serve(client)
            .await
    }
}

// Connect client directly to agent - useful for testing
ClientToAgent::builder()
    .connect_to(MyAgent::new())
```

#### Running connections: `serve` and `run_until`

The `connect_to` method returns a `JrConnection`, but that connection is inert until executed. There are two ways to run it.

**`serve()`** runs until the connection is closed. This is for "reactive" components that respond to incoming messages:

```rust theme={null}
AgentToClient::builder()
    .name("my-agent")
    .on_receive_request(/* ... */)
    .connect_to(transport)?
    .serve()
    .await
```

**`run_until()`** takes an async closure and runs your code concurrently with message handling. The closure receives a *connection context* (conventionally called `cx`) - this is how you interact with the connection, sending messages, spawning tasks, and adding dynamic handlers. When the closure returns, the connection closes:

```rust theme={null}
ClientToAgent::builder()
    .name("my-client")
    .connect_to(transport)?
    .run_until(async |cx| {
        // Your code runs here while messages are handled in the background.
        // Use `cx` to send requests and notifications.
        let response = cx.send_request(InitializeRequest::new(ProtocolVersion::LATEST))
            .block_task().await?;
        Ok(response)
    })
    .await
```

The `run_until` pattern directly addresses starvation. Instead of exposing an async stream that users might accidentally block, `run_until` runs your code *concurrently* with message handling.

The `cx` type (`JrConnectionCx`) follows the "handle" pattern: cloned values refer to the same connection. It's `'static` so it can be sent across threads or stored in structs. Handlers registered with `on_receive_*` also receive a `cx` parameter.

### Sending messages

#### Sending notifications

Use `cx.send_notification()` to send a notification. It returns a `Result` that is `Err` if the connection is broken:

```rust theme={null}
cx.send_notification(StatusNotification::new("processing"))?;
```

#### Sending requests

Use `cx.send_request()` to send a request. This returns a handle for managing the response:

```rust theme={null}
let response_handle = cx.send_request(PromptRequest::new(session_id, messages));
```

The handle is not the response itself - that may not have arrived yet. You have two options for getting it:

**`on_response` / `on_ok_response`** registers a handler that runs when the response arrives:

```rust theme={null}
cx.send_request(PromptRequest::new(session_id, messages))
    .on_ok_response(
        async move |response: PromptResponse, cx| {
            println!("Agent finished: {:?}", response.stop_reason);
            Ok(())
        },
        acp::on_response!()
    )?;
```

**`block_task`** returns a future you can await:

```rust theme={null}
let response: PromptResponse = cx.send_request(PromptRequest::new(session_id, messages))
    .block_task()
    .await?;
```

The `block_task` approach is convenient but dangerous in handlers (methods that begin with `on_`). See [Controlling ordering](#controlling-ordering) for details.

### Controlling ordering

#### Atomic handlers

Handler methods (methods whose names begin with `on_`) execute in the order messages arrive. Each handler must complete before the next message is processed:

```rust theme={null}
.on_receive_request(async |req: PromptRequest, request_cx, cx| {
    // No other messages will be processed while this runs
    cx.send_notification(StatusNotification::new("processing"))?;
    // The notification is guaranteed to be sent before the response
    request_cx.respond(PromptResponse::new(StopReason::EndTurn))
}, acp::on_receive_request!())
```

#### `block_task` and deadlock

Using `block_task` inside a handler creates a deadlock: the handler waits for a response, but responses can't be processed until the handler completes.

```rust theme={null}
// WRONG - will deadlock
.on_receive_request(async |req: PromptRequest, request_cx, cx| {
    let response = cx.send_request(SomeOtherRequest::new())
        .block_task()  // Deadlock! Handler blocks waiting for response
        .await?;       // but responses can't be processed until handler returns
    request_cx.respond(/* ... */)
}, acp::on_receive_request!())
```

Use `on_response` instead, or spawn a task.

#### Spawning tasks

Use `cx.spawn` to run work concurrently with message handling:

```rust theme={null}
.on_receive_request(async |request: PromptRequest, request_cx, cx| {
    cx.spawn(async move {
        // Safe to use block_task here - we're in a spawned task
        let response = cx.send_request(InitializeRequest::new(ProtocolVersion::LATEST))
            .block_task()
            .await?;
        /* ... */
        Ok(())
    })?;

    // Handler returns immediately, spawned work continues
    request_cx.respond(/* ... */)
}, acp::on_receive_request!())
```

Spawned tasks are tracked in the `JrConnectionCx` and don't require runtime-specific spawning.

### Client sessions

When a client sends a `NewSessionRequest`, agents typically need to set up session-specific state: handlers that only apply to this session, MCP servers with tools tailored to the workspace, or initialization logic that runs once the session is confirmed.

#### Session builders

The session builder API provides a fluent interface for configuring sessions. Start with `cx.build_session()` or `cx.build_session_from()` and chain configuration methods:

```rust theme={null}
cx.build_session("/path/to/workspace")
    .with_mcp_server(my_mcp_server)?    // Attach MCP servers (see below)
    // ... additional configuration
```

MCP servers provide tools that the agent can invoke. We'll show how to define them in the examples below.

#### Running sessions with `run_until`

The primary way to run a session is with `block_task().run_until()`. This pattern allows your closure to capture borrowed state from the surrounding scope - no `'static` requirement:

```rust theme={null}
// Inside a run_until closure (not a handler)
let workspace_path = Path::new("/my/workspace");

cx.build_session(workspace_path)
    .with_mcp_server(
        McpServer::builder("tools")
            .tool_fn("get_path", "Returns the path", async move |_: (), _| {
                // Can capture `workspace_path` by reference!
                Ok(workspace_path.display().to_string())
            }, acp::tool_fn!())
            .build()
    )?
    .block_task()
    .run_until(async |mut session| {
        session.send_prompt("What is the workspace path?")?;
        let response = session.read_to_string().await?;
        println!("{response}");
        Ok(())
    })
    .await?;
```

The `run_until` closure receives an `ActiveSession` with methods for interacting with the agent:

* **`send_prompt(text)`** - Send a prompt to the agent
* **`read_to_string()`** - Read all updates until the turn ends, returning text content
* **`read_update()`** - Read individual updates for fine-grained control

For more complex MCP servers, you can use the standard rmcp API via the `agent-client-protocol-rmcp` crate:

```rust theme={null}
use agent_client_protocol_rmcp::RmcpServer;

cx.build_session(workspace_path)
    .with_mcp_server(RmcpServer::new(my_rmcp_service))?
    // ...
```

#### Non-blocking sessions with `on_session_start`

When you need to start a session from inside an `on_receive_*` handler but can't block, use `on_session_start`. This spawns the session work and returns immediately:

```rust theme={null}
.on_receive_request(async |req: NewSessionRequest, request_cx, cx| {
    cx.build_session_from(req)
        .with_mcp_server(my_mcp_server)?
        .on_session_start(async |mut session| {
            session.send_prompt("Hello")?;
            let response = session.read_to_string().await?;
            Ok(())
        })?;

    // Handler returns immediately, session runs in background
    Ok(())
}, acp::on_receive_request!())
```

Note that `on_session_start` requires `'static` - closures and MCP servers cannot borrow from the surrounding scope. Use owned data or `Arc` for shared state.

#### `start_session` and proxy sessions

For cases where you want to avoid the rightward drift of `run_until` but still need blocking behavior, `start_session` returns an `ActiveSession` handle directly:

```rust theme={null}
let mut session = cx.build_session(workspace_path)
    .with_mcp_server(my_mcp_server)?
    .block_task()
    .start_session()
    .await?;

session.send_prompt("Hello")?;
let response = session.read_to_string().await?;
```

Like `on_session_start`, this requires `'static` for closures and MCP servers.

For proxies that want to inject MCP servers but otherwise forward all messages, use `start_session_proxy`:

```rust theme={null}
.on_receive_request(async |req: NewSessionRequest, request_cx, cx| {
    let session_id = cx.build_session_from(req)
        .with_mcp_server(injected_tools)?
        .block_task()
        .start_session_proxy(request_cx)
        .await?;

    // Session messages are automatically proxied between client and agent
    Ok(())
}, acp::on_receive_request!())
```

### Handling messages

#### Notification handlers

Register handlers using `on_receive_notification`. The closure's first argument type determines which notification type it handles:

```rust theme={null}
AgentToClient::builder()
    .on_receive_notification(
        async |notif: SessionNotification, cx| {
            //        -------------------
            //        Expected notification type
            println!("Session update: {:?}", notif.update);
            Ok(())
        },
        acp::on_receive_notification!(), // <-- Hacky macro argument required
    )
```

Note the 'hacky macro argument'. This is required due to current limitations in async closures. It can be removed once [Return Type Notation](https://github.com/rust-lang/rfcs/pull/3654) is stabilized and [issue #149407](https://github.com/rust-lang/rust/issues/149407) is fixed.

#### Request handlers

Request handlers receive an additional `request_cx` parameter for sending the response:

```rust theme={null}
.on_receive_request(
    async |req: PromptRequest, request_cx, cx| {
        // Process the request...
        cx.send_notification(StatusNotification::new("processing"))?;

        // Send the response
        request_cx.respond(PromptResponse::new(StopReason::EndTurn))
    },
    acp::on_receive_request!(),
)
```

The `request_cx` is `#[must_use]` - the compiler warns if you forget to send a response. It provides three methods:

* **`respond(response)`** - Send a successful response
* **`respond_with_error(error)`** - Send an error response
* **`respond_with_result(result)`** - Send either, based on a `Result`

The `request_cx` is `Send`, so you can move it to another task or thread if you need to respond asynchronously:

```rust theme={null}
.on_receive_request(
    async |req: LongRunningRequest, request_cx, cx| {
        cx.spawn(async move {
            let result = do_expensive_work(&req).await;
            request_cx.respond_with_result(result)
        });
        Ok(())
    },
    acp::on_receive_request!(),
)
```

### Custom message types

Define custom notifications and requests using derive macros:

```rust theme={null}
#[derive(Debug, Serialize, Deserialize, JsonSchema, JrNotification)]
#[notification(method = "_myapp/progress")]
struct ProgressNotification {
    percent: u32,
    message: String,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema, JrRequest)]
#[request(method = "_myapp/compute", response = ComputeResponse)]
struct ComputeRequest {
    input: String,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
struct ComputeResponse {
    result: String,
}
```

Custom types work exactly like built-in types - no special `ext_notification` path required:

```rust theme={null}
ClientToAgent::builder()
    .on_receive_notification(
        async |notif: ProgressNotification, cx| {
            println!("Progress: {}% - {}", notif.percent, notif.message);
            Ok(())
        },
        acp::on_receive_notification!()
    )
```

#### Generic message handlers

Use `on_receive_message` with `MessageCx` to intercept any incoming message (request or notification) before typed handlers:

```rust theme={null}
.on_receive_message(
    async |message: MessageCx, cx| {
        // Forward all messages to another thread for processing
        message_sender.send(message)?;
        Ok(())
    },
    acp::on_receive_message!(),
)
```

`MessageCx` is useful for forwarding, logging, or other scenarios where you need to intercept messages before typed dispatch.

### Message handling in depth

#### Handler chains

A *message handler* takes ownership of a message and either handles it or returns a (possibly modified) copy to be tried by the next handler. Handlers are chained together - each gets a chance to claim the message before it passes to the next.

```mermaid theme={null}
flowchart TD
    MSG[Incoming Message] --> STATIC

    subgraph STATIC[Static Handlers]
        S1[Handler 1] --> S2[Handler 2] --> S3[Handler n...]
    end

    STATIC -->|not claimed| DYNAMIC

    subgraph DYNAMIC[Dynamic Handlers]
        D1[Session handlers, etc.]
    end

    DYNAMIC -->|not claimed| DEFAULT[Link Default Handler]
    DEFAULT -->|not claimed| UNHANDLED{Unhandled}

    UNHANDLED -->|retry: false| ERROR[Send error response]
    UNHANDLED -->|retry: true| QUEUE[Queue for retry]
    QUEUE -->|new handler added| DYNAMIC
```

**Static handlers** are registered at build time via `.on_receive_request()`, etc. They're tried in registration order.

**Dynamic handlers** are added at runtime via `cx.add_dynamic_handler()`. They're useful for sub-protocols where groups of related messages are identified by some kind of ID. For example, session messages all share a `session_id` - a dynamic handler can be registered for each session to handle its messages.

**Link default handler** provides fallback behavior based on the link type (e.g., proxies forward unhandled messages).

#### Message handlers

The `JrMessageHandler` trait defines how handlers work:

```rust theme={null}
pub trait JrMessageHandler: Send {
    type Link: JrLink;

    async fn handle_message(
        &mut self,
        message: MessageCx,
        cx: JrConnectionCx<Self::Link>,
    ) -> Result<Handled<MessageCx>, Error>;
}
```

The handler takes ownership of the message. If it handles the message, it returns `Handled::Yes`. If not, it returns ownership via `Handled::No { message, retry }` so the next handler can try:

```rust theme={null}
pub enum Handled<T> {
    Yes,
    No { message: T, retry: bool },
}
```

**The `retry` flag**: If any of the static or dynamic handlers returns `retry: true`, and no handler ultimately claims the message, it gets queued and offered to each new dynamic handler as it's added. This solves a race condition with sessions: messages for a session may arrive before the session's dynamic handler is registered.

The default handlers for `ClientToAgent` and `AgentToClient` already set `retry: true` for session messages with unrecognized session IDs, so you typically don't need to handle this yourself.

For convenience, handlers can return `Ok(())` which is equivalent to `Handled::Yes`.

Handlers can also modify the message before passing it along:

```rust theme={null}
.on_receive_request(async |mut req: EchoRequest, request_cx, cx| {
    req.text.push("modified".to_string());
    Ok(Handled::No {
        message: (req, request_cx),
        retry: false,
    })
}, acp::on_receive_request!())
```

#### Registering dynamic handlers

Register dynamic handlers at runtime for session-specific or protocol-specific message handling:

```rust theme={null}
let registration = cx.add_dynamic_handler(MySessionHandler::new(session_id))?;
```

When `registration` is dropped, the dynamic handler is removed. To keep it alive indefinitely, call `run_indefinitely()`:

```rust theme={null}
registration.run_indefinitely();
```

#### Default handling from link type

Each link type defines default handling for unhandled messages. For example:

* **`ClientToAgent`** - Errors on unhandled requests, ignores unhandled notifications
* **`ProxyToConductor`** - Forwards unhandled messages to the next component

You only need to register handlers for messages you want to intercept.

#### MatchMessage for implementing handlers

When implementing `JrMessageHandler` directly, `MatchMessage` provides ergonomic dispatch:

```rust theme={null}
impl JrMessageHandler for MyHandler {
    type Link = AgentToClient;

    async fn handle_message(
        &mut self,
        message: MessageCx,
        cx: JrConnectionCx<Self::Link>,
    ) -> Result<Handled<MessageCx>, Error> {
        MatchMessage::new(message)
            .if_request(async |req: InitializeRequest, request_cx| {
                request_cx.respond(InitializeResponse::new(req.protocol_version))
            })
            .if_request(async |req: PromptRequest, request_cx| {
                request_cx.respond(PromptResponse::new(StopReason::EndTurn))
            })
            .if_notification(async |notif: SessionNotification| {
                log::info!("Session update: {:?}", notif);
                Ok(())
            })
            .await
            .done()
    }
}
```

For proxies with multiple peers, `MatchMessageFrom` dispatches based on message source:

```rust theme={null}
MatchMessageFrom::new(message, &cx)
    .if_request_from(Client, async |req: PromptRequest, request_cx| {
        // Handle requests from the client
    })
    .if_notification_from(Agent, async |notif: SessionNotification| {
        // Handle notifications from the agent
    })
    .await
    .done()
```

### Error handling

Errors in handlers tear down the connection. If a handler returns an `Err`, the connection closes and all pending operations fail.

For request handlers, you can propagate error responses instead of tearing down the connection:

```rust theme={null}
.on_receive_request(async |req: ComputeRequest, request_cx, cx| {
    match process(&req) {
        Ok(result) => request_cx.respond(ComputeResponse { result }),
        Err(e) => request_cx.respond_err(JsonRpcError::new(
            ErrorCode::InvalidParams,
            format!("Failed to process: {}", e),
        )),
    }
}, acp::on_receive_request!())
```

### Writing proxies

#### Multiple peers

Simple link types like `ClientToAgent` have one remote peer. Proxy link types like `ProxyToConductor` have two: `Client` (predecessor) and `Agent` (successor).

With multiple peers, you must explicitly name which peer you're communicating with:

```rust theme={null}
ProxyToConductor::builder()
    .on_receive_notification_from(
        acp::Agent, // <-- Receive from the agent
        async |notif: SessionNotification, cx| {
            cx.send_notification_to(acp::Client, notif)?;
            //                      -----------
            //                   Send to the client
            Ok(())
        },
        acp::on_receive_notification!(),
    )
```

#### Default forwarding

For proxies, the default handling is typically `Forward` - unhandled messages pass through to the next component. You only need to register handlers for messages you want to intercept or modify.

#### Session builders for proxies

Proxies can add session-scoped handlers:

```rust theme={null}
cx.build_session_from(req)
    .on_receive_notification(async |notif: SessionNotification, cx| {
        // This handler only runs for this session
        log_notification(&notif);
        Ok(())
    }, acp::on_receive_notification!())
    .on_proxy_session_start(request_cx, async |_| Ok(()))
```

### Advanced: Defining custom link types

Link types define the relationship between peers. The SDK provides built-in types, but you can define your own:

```rust theme={null}
use acp::link::{JrLink, LinkDirection};

pub struct MyCustomLink;

impl JrLink for MyCustomLink {
    type ConnectsTo = OtherSideLink;

    fn direction() -> LinkDirection {
        LinkDirection::Outbound // We initiate the connection
    }

    fn default_request_handling() -> DefaultHandling {
        DefaultHandling::Error // Unknown requests return an error
    }

    fn default_notification_handling() -> DefaultHandling {
        DefaultHandling::Ignore // Unknown notifications are silently dropped
    }
}
```

## Shiny future

> How will things play out once this feature exists?

### Unified Rust ACP experience

The Rust ecosystem will have a single SDK for ACP development. Whether you're building a simple client, a proxy chain, or a programmatic orchestration framework like patchwork-rs, the same SDK handles all cases.

### Smooth transition from the current SDK

The new SDK is more ergonomic than the current trait-based approach, so migration should be straightforward for most users. The builder pattern with context parameters (`cx`) replaces the `AgentSideConnection` pattern, and the directional naming (`ClientToAgent` vs `AgentSideConnection`) makes code clearer.

We can provide migration guidance and potentially a thin compatibility layer for common patterns, but most users will find the new code simpler than the old.

### Potential crate reorganization

Currently, `agent-client-protocol` contains both generic JSON-RPC machinery (builder patterns, message handling, connection management) and ACP-specific types (link types, schema integration). In the future, it might be valuable to split the generic JSON-RPC layer into its own crate.

However, this is complicated by the trait implementations: the generic traits need to be implemented for ACP types currently defined in the schema crate. We'd need to carefully consider where type definitions live to avoid orphan rule issues. This reorganization isn't blocking for the initial adoption.

### Cross-language SDK alignment

The design principles here - builder patterns, context parameters, directional naming, component abstractions - aren't Rust-specific. They represent good SDK design that could inform TypeScript and other language SDKs.

This doesn't mean other SDKs should be ports of the Rust SDK. Each language has its own idioms. But the core ideas (explicit message ordering, composable components, context in callbacks) translate across languages.

### Foundation for protocol evolution

The builder pattern and component model make it easier to evolve the ACP protocol. New methods can be added without breaking existing code. New component types (beyond client/agent/proxy) can be introduced by implementing the Component trait.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

### Crate structure

The new SDK is organized into several crates with clear responsibilities:

* **`agent-client-protocol`** - Core SDK with builder patterns, link types, and component abstractions
* **`agent-client-protocol-tokio`** - Tokio runtime integration (spawn, timers, I/O)
* **`agent-client-protocol-rmcp`** - Bridge to the rmcp crate for MCP integration
* **`agent-client-protocol-conductor`** - Reference conductor implementation
* **`agent-client-protocol-derive`** - Derive macros for JSON-RPC traits
* **`agent-client-protocol-test`** - Test utilities and mock implementations
* **`agent-client-protocol-tee`** - Debugging proxy that logs all traffic
* **`agent-client-protocol-trace-viewer`** - Interactive sequence diagram viewer for trace files

### Current status

A working implementation exists in the [symposium-dev/symposium-acp](https://github.com/symposium-dev/symposium-acp) repository and is published on crates.io. It powers:

* The conductor (proxy chain orchestration)
* patchwork-rs (programmatic agent orchestration)
* Symposium (Rust development environment)

### Migration path

The transition involves importing the `sacp` implementation into this repository:

1. **Import `sacp` crates** into this repository with the new `agent-client-protocol-*` naming
2. **Release `agent-client-protocol` v1.0** with the new builder-based API
3. **Deprecate `sacp` crates** on crates.io, pointing users to the `agent-client-protocol` family
4. **Provide migration guidance** for users of the current v0.x SDK

Most users will find the migration straightforward - the builder pattern is more ergonomic than the trait-based approach, so the new code is often simpler than the old.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### What alternative approaches did you consider?

We first attempted to build on the existing SDK but due to the limitations decided to try an alternative approach.

### What about other language SDKs?

We would like to try and adapt these ideas to other languages. It would be good if the SDKs for all languages took the same general approach. Most of the concerns in this document are not Rust-specific, though as often happens, the limitations become more annoying in Rust because of the limits imposed by the ownership system.

### How does this relate to the Proxy Chains and MCP-over-ACP RFDs?

This expanded SDK design is motivated by working through the use cases enabled by [proxy chains](./proxy-chains) and [MCP-over-ACP](./mcp-over-acp).

### How well-tested is this design?

The design has been used for a wide range of projects but the majority were written by the SDK author, though Amazon's kiro-cli team and the Goose client adopted sacp for their use case with minimal difficulty. Before we finalize the design, it would be good to have more adopters to help ensure that it meets all common needs.

### Can I derive `JrRequest`/`JrNotification` on enums?

Not currently. The derive macros only support structs with a single method name. For enums that group related messages (e.g., all session-related requests), you would need to implement the traits manually.

This is a potential future enhancement - enum derives could dispatch to different methods per variant, which would be useful for `MessageCx<Req, Notif>` typed handlers. For now, use the untyped `MessageCx` with `MatchMessage` for this pattern.

### What changes are needed before stabilizing?

We are in the process of changing how response messages work to simplify the implementation of the conductor. Before stabilizing we should do a thorough review of the methods and look for candidates that can be removed or simplified.

The conductor is feature complete but the support for MCP-over-ACP needs a few minor improvements (in particular, it should detect when the agent only supports stdio bridging and not attempt to use HTTP, which it currently does not).

## Revision history

* Initial draft based on working implementation in symposium-acp repository.


# Closing active sessions
Source: https://agentclientprotocol.com/rfds/session-close



Author(s): [@SteffenDE](https://github.com/SteffenDE)

## Elevator pitch

> What are you proposing to change?

We propose adding the ability to close active sessions. This allows the agent to free up any memory
and threads/subprocesses associated with that session.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Today, if you start a session, it will remain active until the ACP process is terminated.
This means that if the agent implements sessions as separate processes, active users with
many sessions can end up with a lot of processes unnecessarily using up system memory.
Even if the agent does not spawn separate processes, memory used by large tool results or
similar could still accumulate over time.

The only way to free up that memory is to terminate the whole ACP process, which will stop
all sessions and - if the agent does not support resuming sessions (load / resume / fork) -
lead to a bad user experience.

## What we propose to do about it

> What are you proposing to improve the situation?

Add a new `session/close` method. If supported, the agent **must** cancel any ongoing work
related to the session (treat it as if `session/cancel` was called) and then free up any resources
associated with the session.

## Shiny future

> How will things will play out once this feature exists?

Clients can track what sessions are actively used by a user and automatically close old sessions.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

We propose to add a new `"session/close"` method. Agents must declare this option is
available by returning `session: { close : {} }` in their capabilities. The object is reserved
to declare future capabilities.

Then the client would be able to close a specific session with:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/close",
  "params": {
    "sessionId": "sess_789xyz"
  }
}
```

Agents might reply with an error if the session is not active or does not exist.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

None so far.

### What alternative approaches did you consider, and why did you settle on this one?

It could be an agent specific custom method, since we mainly ran into problems with Claude Code, but
even for agents that don't spawn full subprocesses for sessions, cleaning up unneeded sessions still
seems like a good idea.

## Revision history

2026-03-09: Rename from session/stop to session/close
2026-02-24: Initial draft


# Session Config Options
Source: https://agentclientprotocol.com/rfds/session-config-options



Author(s): [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

Allow Agents to provide an arbitrary list of configuration selectors for a given session. Rather than only supporting modes or models, we can allow each Agent to more flexibly specify which configurations to allow the Client to offer the user.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Currently, we allow Agents to [specify a list of modes](https://agentclientprotocol.com/protocol/session-modes) they can run in. The state of the currently selected item is allowed to be modified by both the [Client](https://agentclientprotocol.com/protocol/session-modes#from-the-client) and the [Agent](https://agentclientprotocol.com/protocol/session-modes#from-the-agent).

The obvious next selector was a [model selector](https://github.com/agentclientprotocol/agent-client-protocol/pull/182). However, when implementing this, it became clear that even for our current agents, it is not just as simple as "which model do you want?", but also which variant of a given model in terms of thinking parameters that might be better to express as yet another selector.

Adding more hard-coded selector options would potentially lead the protocol to need to support many optional ones, or implementors would need to try to find the best existing selector to hack an option into if there wasn't an obvious fit. And if, a few months from now, no agents support something like a mode or reasoning selector, the protocol is left with leftover methods no one really uses, cluttering the interface.

Since this space is moving fast, we ideally would find a more flexible option with enough constraints to allow Clients and Agents to both reason about the options provided.

## What we propose to do about it

> What are you proposing to improve the situation?

Instead, we can allow Agents to provide configuration options in the `session/new` response that not only provide a list of options, but also a `key` of some kind that is a unique identifier for that selector.

Additionally, we can optionally allow an Agent to mark each option with a semantic category so that Clients can reliably distinguish broadly common option types (e.g. model selector vs session mode selector vs thought/reasoning level), without needing to infer meaning from the option `id` or `name`. This is intended for UX only (e.g. keyboard shortcuts, icons, preferred placement), and MUST NOT be required for correctness.

When the Client receives or sends an update to this selector, it would require both the selector key and the key for the new value.

To start, we could continue offering single-value selectors (dropdowns), but allow for the Agent to decide what those are for.

## Shiny future

> How will things will play out once this feature exists?

The Agent provides a list of available configuration options. The Agent cannot rely on the Client to set or even display these options, as it may not support it. So an Agent MUST always have a default configuration value for every option it provides, and MUST be able to run a turn without these configuration options being set.

The Client can render the options provided, send updated values to the Agent, and also display any changes the Agent made during the course of it's execution (for example, if it changes modes or models because of fallbacks or a change in strategy, so that the user can always see the current state).

Since we are moving to a world in which there are multiple configuration options, some of which may depend on each other, the Agent MUST provide the complete set of configuration options and their current values whenever a change is made. We would tradeoff some extra data being sent to the Client in order to help minimize the amount of state required to be managed by the Client. The Client would submit a new value, and receive back the full state of all configuration options that it can then replace it's current state with and render. So if changing a model means there are no thinking options, or a new option becomes available, or another value needs to change because the values of an option are different, the Agent will reflect this in its response by providing the entire new state (or an error if it is somehow an invalid selection).

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

To start, we can implement this based on the [Session Modes](https://agentclientprotocol.com/protocol/session-modes) api.

Something like an `InitializeResponse` that looks like:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "configOptions": [
      {
        "id": "mode", // this is the unique `key` for communication about which option is being used
        "name": "Session Mode", // Human-readable label for the option
        "description": "Optional description for the Client to display to the user."
        "category": "mode",
        "type": "select",
        "currentValue": "ask",
        "options": [
          {
            "value": "ask",
            "name": "Ask",
            "description": "Request permission before making any changes"
          },
          {
            "value": "code",
            "name": "Code",
            "description": "Write and modify code with full tool access"
          }
        ]
      },
      {
        "id": "models",
        "name": "Model",
        "category": "model",
        "type": "select",
        "currentValue": "ask",
        "options": [
          {
            "value": "model-1",
            "name": "Model 1",
            "description": "The fastest model"
          },
          {
            "value": "model-2",
            "name": "Model 2",
            "description": "The most powerful model"
          }
        ]
      }
    ]
  }
}
```

### Option category (optional)

Each top-level config option MAY include an optional `category` field. This is intended to help Clients distinguish broadly common selectors and provide a consistent UX (for example, attaching keyboard shortcuts to the first option of a given category).

In addition to `category`, Clients SHOULD use the ordering of the `configOptions` array as provided by the Agent as the primary way to establish priority and resolve ties. For example, if multiple options share the same `category`, a Client can prefer the first matching option in the list when assigning keyboard shortcuts or deciding which options to surface most prominently.

`category` is semantic metadata and MUST NOT be required for correctness. Clients MUST handle missing or unknown categories gracefully.

Category names beginning with `_` are free for custom use. Category names that do not begin with `_` are reserved for the ACP spec.

Proposed enum:

* `mode` - Session mode selector
* `model` - Model selector
* `thought_level` - Thought/reasoning level selector
* Any string beginning with `_` - Custom category (e.g., `_my_custom_category`)

When we introduce this, we could also allow for grouped options, in case there are logical sub-headers and groupings for the options in an individual selector.

```json theme={null}
{
  "id": "models",
  "name": "Model",
  "currentValue": "ask",
  "type": "select",
  "options": [
    {
      "group": "Provider A",
      "options": [
        {
          "value": "model-1",
          "name": "Model 1",
          "description": "The fastest model"
        }
      ]
    },
    {
      "group": "Provider B",
      "options": [
        {
          "value": "model-2",
          "name": "Model 2",
          "description": "The most powerful model"
        }
      ]
    }
  ]
}
```

We use a list of objects for all of these, to ensure consistent ordering of both the config options and the possible values across languages that may or may not preserve ordering.

For grouping options, it needs to be explored whether or not grouped and ungrouped options can be interspersed, or if we need to restrict to one mode or the other (likely the latter).

For updating the value from the client and agent, it would follow the same pattern as [session modes](https://agentclientprotocol.com/protocol/session-modes#from-the-client) but have an additional key.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_config_option",
  "params": {
    "sessionId": "sess_abc123def456",
    "configId": "mode",
    "value": "code"
  }
}
```

And the response to this request would return the full list of config options with current values.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "configOptions": [
      {
        "id": "mode",
        "name": "Session Mode",
        "type": "select",
        "currentValue": "ask",
        "options": [..]
      },
      {
        "id": "models",
        "name": "Model",
        "type": "select",
        "currentValue": "ask",
        "options": [..]
      }
    ]
  }
}
```

The notification would return the full list of config options with current values as well.

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "config_option_update",
      "configOptions": [
        {
          "id": "mode",
          "name": "Session Mode",
          "type": "select",
          "currentValue": "ask",
          "options": [..]
        },
        {
          "id": "models",
          "name": "Model",
          "type": "select",
          "currentValue": "ask",
          "options": [..]
        }
      ]
    }
  }
}
```

We would also likely move session modes to be `@deprecated` in favor of this approach. Until it is removed, we may want Agents to support both fields, and then the Client, if it uses the new config options, should only use the config options supplied and not the `modes` field to avoid duplication.

The config options would also take a `type` field to specify different forms of input for the Client to display. If a client receives an option it doesn't recognize, it should ignore it. Since the Agent is required to have a default value, it can gracefully degrade and ignore the option and the Agent should handle it regardless. The Client should also treat the list of options as prioritized by the Agent. So, if for some reason the Agent provides more options than the Client can reasonably display, the Client should show as many as possible, starting at the beginning of the list.

We will start with just supporting `select` for now, and expand to other types as needed.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### What alternative approaches did you consider, and why did you settle on this one?

As noted, the Zed team already looked into and implemented experimental support for a model selector.

However, this has already diverged from how the Codex CLI is modeling their model selector as of last week, so it seems reasonable to, as per a core design principle of the protocol, only limit the Agent implementations where necessary for the Client to render a faithful UX. Maximizing flexibility for the Agent as they iterate on the best way to model new paradigms seems key here, and it is unclear whether the Client benefits from knowing which type of selector this is.

We originally discussed internally having a design closer to this proposal, however walked it back thinking it would be helpful for the Client to know what was being selected. However, as we've now dealt with multiple Agent implementations, it is unclear if this has actually helped the Client, and allowing for more flexibility seems desirable.

### What about connection-level configuration options?

This RFD is only concerned with session-level configuration, for which it seems reasonable to require that the Agent can select a default value at all times and not require input from the client before continuing.

There seems to be another type of configuration option that is needed when first setting up an Agent (i.e. provider options, plugins, etc.) that are more persistent and may be required by an Agent prior to being able to create a session. These would need to be tackled somewhere closer to the initialization phase, or elsewhere and are out of scope for this RFD.

### What about multi-value selectors? or checkboxes? Or *insert favorite input option here*?

This is a question we should discuss of how much complexity we want to introduce for the first version, and how we want to express this to via Client capabilities to allow for more option types in the future.

## Revision history

* 2025-10-29: Initial draft
* 2026-01-09: Add option categories
* 2026-01-15: Allow for category extensions


# Session Delete
Source: https://agentclientprotocol.com/rfds/session-delete



Author(s): [@chazcb](https://github.com/chazcb)
Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

Add a capability-gated `session/delete` method so clients can remove sessions from `session/list`. This complements `session/list` by giving users control over which sessions appear in their session history.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

The [`session/list` RFD](/rfds/session-list) introduced the ability for clients to enumerate sessions. However, there's no standard way to remove sessions from this list. Without `session/delete`, users have no control over their session history—old sessions accumulate, and clients must implement non-standard deletion mechanisms or rely on agent-specific cleanup policies.

## What we propose to do about it

> What are you proposing to improve the situation?

Add a `session/delete` JSON-RPC method that is capability-gated. Agents advertise support via `sessionCapabilities.delete` in their initialization response.

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "sessionCapabilities": {
        "delete": {}
      }
    }
  }
}
```

### Method

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/delete",
  "params": {
    "sessionId": "sess_abc123def456"
  }
}
```

### Request Parameters

| Field       | Type        | Required | Description           |
| ----------- | ----------- | -------- | --------------------- |
| `sessionId` | `SessionId` | Yes      | The session to delete |

### Response

On success, returns an empty result:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {}
}
```

### Semantics

* **Capability-gated**: Agents MUST NOT accept `session/delete` calls unless they advertised `sessionCapabilities.delete` at initialization.
* **Removes from list**: The primary effect is that deleted sessions no longer appear in `session/list` results.
* **Implementation-defined storage behavior**: Agents may implement soft delete (mark as hidden) or hard delete (remove data). The protocol does not prescribe which.
* **Implementation-defined load behavior**: Agents may choose what happens when a client calls `session/load` on a deleted session—return the session anyway, return an error, or any other behavior. The protocol does not prescribe which.
* **Idempotent**: Deleting an already-deleted session (or a session that never existed) SHOULD succeed silently rather than error.

## Alternatives considered

### Automatic lifecycle policies only

Rely on agents to implement their own session retention policies (e.g., delete sessions older than 30 days) without exposing user control.

**Tradeoffs**: Users have no control over which sessions are kept. A session the user wants to keep might be deleted, or a session the user wants gone might persist.

### Add a `hidden` flag to sessions

Instead of delete, allow users to mark sessions as hidden. They'd still exist but not appear in `session/list` by default.

**Tradeoffs**: More complex—requires filter parameters on `session/list` to show/hide hidden sessions. For most use cases, delete is simpler and matches user expectations.

### Batch deletion

Support deleting multiple sessions in one call via a `sessionIds` array.

**Tradeoffs**: Could be added later as an extension. Single-session delete covers the common case and keeps the initial implementation simple.

## Shiny future

> How will things play out once this feature exists?

Users can manage their session history, and all ACP clients can offer this using the same protocol method rather than implementing their own mechanisms.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

1. **Schema**: Add `session/delete` method definition, `DeleteSessionRequest` and `DeleteSessionResponse` types.
2. **Capabilities**: Add `sessionCapabilities.delete` capability flag.
3. **Protocol**: Add `session/delete` to method tables.
4. **Docs**: Update session management docs to include deletion.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### Why not prescribe soft vs hard delete?

Different agents have different storage architectures and compliance requirements. Some may need to retain data for auditing; others may want to free storage immediately. The protocol focuses on the user-facing behavior (removed from list) and leaves storage decisions to implementers.

### Why not prescribe behavior for loading deleted sessions?

Similar reasoning—some agents may want to allow "undelete" by loading a soft-deleted session, others may want a clean error. The protocol provides the deletion mechanism; agents decide the semantics that fit their use case.

### Should delete require confirmation?

No. Confirmation UX is a client concern. The protocol provides the delete operation; clients can add confirmation dialogs, undo functionality, or other UX patterns as they see fit.

### What if the session is currently active?

Agents may reject deletion of active sessions or handle it however they choose. This is implementation-defined. A reasonable approach is to allow deletion—the session simply won't appear in future `session/list` calls.

### Why is this a separate RFD from session/list?

The [`session/list` RFD](/rfds/session-list#what-about-session-deletion) explicitly deferred deletion to keep scope focused. Now that `session/list` is established, `session/delete` is a natural complement.

## Revision history

* **2025-02-03**: Fixed capability example to use agent capability (initialize response)
* **2025-01-24**: Initial draft


# Forking of existing sessions
Source: https://agentclientprotocol.com/rfds/session-fork



* Author(s): [@josevalim](https://github.com/josevalim)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

We propose adding the ability to "fork" a new session based on an existing one.
This will allow us to use the current conversation as context to generate pull
request descriptions, summaries, etc. without polluting the user history.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Imagine we want to summarize the current conversation to use it in a future chat. If we send a message
asking for the summary, it will become part of its context, affecting future user interactions.
Therefore we want to be able to fork a session, issue additional messages, and then close the fork.

## What we propose to do about it

> What are you proposing to improve the situation?

To add a "session/fork" method.

## Shiny future

> How will things will play out once this feature exists?

We will be able to implement functionality that requires using the current chat
without polluting its history, ranging from summaries to potentially subagents.

I can also see this feature being extended in the future to support an optional
message ID, so the fork happens at a specific message, allowing clients to implement
functionality like editing previous messages and similar.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

We propose to add a new "session/fork" method. Agents must declare this option is
available by returning `session: { fork : {} }` in its capabilities. The object is reserved
to declare future capabilities, such as forking from a specific message, a tool call, or similar.

Then the client would be able to request a fork of the given session:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/fork",
  "params": {
    "sessionId": "sess_789xyz",
    "cwd": "...",
    "mcpServers": [...]
  }
}
```

The request expects the same options as `session/load`, such as `cwd` and `mcpServers`.

Similarly, the agent would respond with optional data such as config options, the same as `session/load`.

Agents may reply with an error if forking of that specific session or with the given options is not supported,
for example if the agent does not support forking with a different working directory than the initial session.

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

**Q: Should a new method be introduced or should "session/new" be expanded?**

They must be different because they will effectively require different options.
For example, "session/new" has options such as capabilities and MCP which are not
recommended to be set when forking, as the context being forked was built with other
tools, and forking may accept a messageId for checkpoints.

**Q: Should fork only accept the `sessionId` or also other options, similar to `session/load`?**

Initially, we proposed to only accept the `sessionId`, but this would make it more difficult to
allow forking of inactive sessions in agents like `claude-agent-acp`, as Claude does not retain the
configured MCP servers of a session. Limiting fork to only already active sessions would limit its usefulness.

Moreover, allowing to pass different options also allows features like dynamically adding MCP servers
to existing sessions to work by forking them with the new options, if the agent supports it. If it
does not, the client can still show an appropriate error message.

### What alternative approaches did you consider, and why did you settle on this one?

None. This proposal is inspired by the abilities exposed in Claude Agent SDK. It must be validated against other agents too.

## Revision history

* 2025-11-17: Mentioned capabilities format, updated FAQ.
* 2025-11-20: Added request format and updated capabilities format.
* 2025-12-10: Adjust fork options to align with `session/load`.


# Session Info Update
Source: https://agentclientprotocol.com/rfds/session-info-update



* Author(s): [@ignatov](https://github.com/ignatov)

## Elevator pitch

Add a `session_info_update` variant to the existing `SessionUpdate` notification type that allows agents to update session metadata (particularly title/name), enabling dynamic session identification in client UIs without requiring a new endpoint.

## Status quo

Currently, the ACP protocol provides session management through `session/new`, `session/load`, and `session/list` (unstable). The `session/list` endpoint returns `SessionInfo` objects that include an optional `title` field for displaying session names in client UIs.

However, there are several problems:

1. **No way to communicate title updates** - The `title` field in `SessionInfo` is static in the list response. Agents cannot dynamically update it as the session evolves.

2. **No mechanism for real-time metadata updates** - Unlike commands (`available_commands_update`) or modes (`current_mode_update`), there's no way for agents to:
   * Auto-generate titles after the first meaningful exchange
   * Update titles as conversation context shifts
   * Provide custom metadata that reflects session state

3. **Inconsistent with protocol patterns** - Other dynamic session properties use `session/update` notifications (commands, modes, plans), but metadata has no equivalent mechanism.

The current workaround is for clients to:

* Maintain their own title mapping (doesn't persist or sync)
* Only show static metadata from `session/list`
* Have no way to receive agent-generated titles in real-time

## What we propose to do about it

Add a new `session_info_update` variant to the existing `SessionUpdate` discriminated union that allows agents to notify clients about metadata changes. This update would:

1. **Follow the existing `SessionUpdate` pattern**:
   * Uses the same notification mechanism as `available_commands_update`, `current_mode_update`, etc.
   * Sent via `session/update` method
   * Agent-initiated, no request/response needed

2. **Align with `SessionInfo` structure**:
   * Contains the same fields as `SessionInfo` from `session/list`
   * All fields are optional (partial updates)
   * Enables incremental metadata updates
   * **Important**: `SessionInfoUpdate` must stay aligned with `SessionInfo` - when new fields are added to `SessionInfo`, they should also be added to `SessionInfoUpdate` as optional fields

3. **Support common use cases**:
   * Agent auto-generates title after first prompt
   * Agent updates title as conversation context shifts
   * Agent provides custom metadata for client features (tags, status, etc.)
   * User explicitly requests title change (agent responds with update notification)

4. **Integrate seamlessly**:
   * No new capability required (uses existing `session/update` mechanism)
   * Compatible with `session/list` - metadata should persist and be reflected in list responses
   * Works during active sessions

### Notification Structure

The agent sends a `session/update` notification with `sessionUpdate: "session_info_update"`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "session_info_update",
      "title": "Implement user authentication",
      "_meta": {
        "tags": ["feature", "auth"],
        "priority": "high"
      }
    }
  }
}
```

### SessionInfoUpdate Type

The update type mirrors `SessionInfo` but with all fields optional:

```typescript theme={null}
{
  sessionUpdate: "session_info_update",
  title?: string | null,           // Update or clear the title
  updatedAt?: string | null,        // ISO 8601 timestamp (usually agent sets this)
  _meta?: object | null             // Custom metadata (merged with existing)
}
```

**Note:** `sessionId` and `cwd` are NOT included since:

* `sessionId` is already in the notification's `params`
* `cwd` is immutable and set during `session/new`

### Examples

#### Update title and working directory metadata

After the user sends their first meaningful prompt, the agent can generate and send a title along with metadata about the working directory:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "session_info_update",
      "title": "Debug authentication timeout",
      "_meta": {
        "projectName": "api-server",
        "branch": "main"
      }
    }
  }
}
```

#### Update title as conversation evolves

As the conversation shifts focus:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "session_info_update",
      "title": "Debug authentication timeout → Add retry logic"
    }
  }
}
```

## Shiny future

Once this feature exists:

1. **Dynamic session identification** - Agents can:
   * Auto-generate meaningful titles from conversation content
   * Update titles as conversations evolve
   * Provide rich metadata for better organization

2. **Improved client UIs** - Clients can:
   * Show real-time title updates in session lists
   * Display session status, tags, or other metadata
   * Update UI immediately without polling `session/list`

3. **Consistent protocol patterns** - Session metadata updates work like other dynamic session properties (commands, modes), creating a unified model

4. **Bidirectional workflows** - Combined with a potential future request method:
   * User renames session → client sends request → agent acknowledges with `session_info_update` notification
   * Agent auto-generates title → sends `session_info_update` notification → client displays it

5. **Enhanced use cases**:
   * Session templates that auto-set titles and tags
   * Progress indicators via `_meta`
   * Integration with external tools via metadata
   * Rich session browsing and filtering

## Implementation details and plan

### Phase 1: Schema Changes

1. **Update `schema.unstable.json`**:
   * Add `SessionInfoUpdate` type definition
   * Add new variant to `SessionUpdate` oneOf array
   * Align fields with `SessionInfo` but make all optional

```json theme={null}
{
  "SessionInfoUpdate": {
    "description": "**UNSTABLE**\n\nThis capability is not part of the spec yet, and may be removed or changed at any point.\n\nUpdate to session metadata. All fields are optional to support partial updates.",
    "properties": {
      "_meta": {
        "description": "Extension point for implementations"
      },
      "title": {
        "description": "Human-readable title for the session",
        "type": ["string", "null"]
      },
      "updatedAt": {
        "description": "ISO 8601 timestamp of last activity",
        "type": ["string", "null"]
      }
    },
    "type": "object"
  }
}
```

Add to `SessionUpdate` oneOf:

```json theme={null}
{
  "allOf": [
    {
      "$ref": "#/$defs/SessionInfoUpdate"
    }
  ],
  "description": "**UNSTABLE**\n\nThis capability is not part of the spec yet, and may be removed or changed at any point.\n\nUpdate to session metadata",
  "properties": {
    "sessionUpdate": {
      "const": "session_info_update",
      "type": "string"
    }
  },
  "required": ["sessionUpdate"],
  "type": "object"
}
```

### Phase 2: Protocol Documentation

2. **Create documentation** in `/docs/protocol/session-metadata.mdx`:
   * Explain the notification mechanism
   * Provide examples of common patterns
   * Document merge semantics for `_meta`
   * Clarify relationship with `session/list`

3. **Update existing docs**:
   * Reference in `/docs/protocol/session-setup.mdx`
   * Add to `/docs/protocol/prompt-turn.mdx` session update section

### Phase 3: SDK Implementation

4. **Implement in Rust SDK**:
   * Add `SessionInfoUpdate` struct
   * Add variant to `SessionUpdate` enum
   * Update notification handling in agent and client traits
   * Add helper methods for common patterns

5. **Implement in TypeScript SDK** (if applicable):
   * Add TypeScript types
   * Update notification handlers
   * Add helper methods

### Phase 4: Example Implementation

6. **Update example agents**:
   * Demonstrate auto-generating title from first prompt
   * Show updating metadata during session
   * Example of using `_meta` for custom fields

### Compatibility Considerations

* **Fully backward compatible**: This adds a new notification variant to an existing mechanism
* **No breaking changes**: Existing agents and clients continue working
* **Graceful degradation**: Clients that don't handle this notification simply ignore it
* **No new capability needed**: Uses existing `session/update` infrastructure

### Design Decisions

**Why notification instead of request/response?**

* Consistent with existing `SessionUpdate` patterns (`available_commands_update`, `current_mode_update`)
* Agents initiate updates based on conversation state
* Simpler than bidirectional request/response
* Enables real-time updates without polling

**Why make all fields optional?**

* Allows partial updates (only update what changed)
* More efficient - don't resend unchanged data
* Flexible for different use cases
* Mirrors partial update patterns in other protocols

**Why not include `sessionId` and `cwd` in the update?**

* `sessionId` is already in the notification params
* `cwd` is immutable (set in `session/new`, never changes)
* Keeps update focused on mutable metadata

**How do `_meta` updates work?**

* **Merge semantics**: New `_meta` fields are merged with existing ones
* To clear a specific field: `"_meta": { "fieldName": null }`
* To clear all custom metadata: `"_meta": null`

### Security Considerations

* **No additional security concerns**: Uses existing session authentication
* **Input validation**:
  * Agents should validate title length (recommend 500 chars max)
  * Sanitize metadata to prevent injection
  * Validate `_meta` structure based on agent requirements
* **Resource limits**: Agents should limit update frequency and metadata size

## Frequently asked questions

### Why not create a new endpoint like `session/update-metadata`?

The notification pattern is more appropriate because:

1. **Consistency**: Other dynamic session properties (commands, modes) use notifications
2. **Agent-initiated**: Agents typically generate titles from conversation context
3. **Real-time**: No request/response overhead, updates flow naturally
4. **Simpler**: Reuses existing `session/update` infrastructure

### How does this work with `session/list`?

The updated metadata should persist and be reflected in subsequent `session/list` calls. The notification provides real-time updates to connected clients, while `session/list` provides the current state for discovery.

### Can clients trigger title updates?

This RFD covers agent-initiated updates. Client-initiated updates could work by:

1. Client sends a prompt asking to rename session
2. Agent updates its internal state
3. Agent sends `session_info_update` notification
4. Client receives and displays the update

A future RFD could add explicit request/response for this if needed.

### What if multiple updates are sent in quick succession?

Clients should apply updates incrementally in order. Each notification represents a delta, not a full replacement (except for fields explicitly set to `null`).

### Should `updatedAt` be automatically set by the agent?

Yes, typically the agent should update this timestamp when any session activity occurs, not just when metadata changes. However, including it in `session_info_update` allows agents to explicitly control it if needed.

### Do agents need a new capability for this?

No. All agents that support `session/update` notifications can send this variant. Clients that don't recognize it will ignore it (standard JSON-RPC behavior).

### How does this interact with `session/fork`?

When forking, the parent session's metadata could be copied (implementation choice). The forked session would have its own `sessionId` and could receive separate `session_info_update` notifications.

### What happens if title is too long?

This is an implementation choice. Agents MAY:

* Truncate long titles
* Reject updates (though this is a notification, so no error response)
* Set a reasonable limit (e.g., 500 characters)

Clients SHOULD handle long titles gracefully (truncate in UI, show tooltip, etc.).

### Can `_meta` have nested objects?

Yes, `_meta` is an arbitrary object. Agents define its structure. The merge semantics apply recursively - nested objects are merged, not replaced entirely.

### What alternative approaches did you consider, and why did you settle on this one?

Several alternatives were considered:

1. **Add a new request/response endpoint (`session/update-metadata`)** - This would be inconsistent with how other dynamic session properties (commands, modes) are handled. The notification pattern is more appropriate for agent-initiated updates.

2. **Add title parameter to `session/new`** - Only allows setting title at creation time, doesn't support dynamic updates as the conversation evolves.

3. **Client-side only metadata tracking** - Doesn't work across devices, can get out of sync, and duplicates storage. This is the current workaround and has significant limitations.

4. **Generic `session/update` request for all properties** - Could conflict with immutable properties (sessionId, cwd) and has unclear semantics about what can be updated.

The proposed notification-based approach:

* **Consistent** with existing protocol patterns
* **Flexible** for both agent-initiated and user-initiated updates
* **Simple** to implement and understand
* **Extensible** via `_meta` field

## Revision history

* **2025-11-28**: Initial draft proposal


# Session List
Source: https://agentclientprotocol.com/rfds/session-list



* Author(s): [@ahmedhesham6](https://github.com/ahmedhesham6)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

Add a `session/list` endpoint to the ACP protocol that allows clients to query and enumerate existing sessions from an agent, enabling session management features like session history, session switching, and session cleanup.

## Status quo

Currently, the ACP protocol provides session management through `session/new` and `session/load` endpoints. However, there is no way for clients to:

1. **Discover existing sessions** - Clients cannot query what sessions exist on an agent
2. **Display session history** - Users cannot see a list of their past conversations
3. **Manage multiple sessions** - Switching between sessions requires clients to track session IDs themselves
4. **Clean up old sessions** - No way to discover stale or abandoned sessions for cleanup

This creates several problems:

* **Poor user experience** - Users cannot browse their conversation history or resume previous sessions easily
* **Client-side complexity** - Each client must implement its own session tracking and persistence
* **Inconsistent behavior** - Different clients handle session management differently, leading to fragmented experiences

The current workaround is for clients to maintain their own session registry, but this:

* Requires persistent storage on the client side
* Can get out of sync if sessions are created/destroyed outside the client
* Doesn't work across different client instances or devices
* Cannot leverage agent-side session metadata or state

## What we propose to do about it

Add a new `session/list` JSON-RPC method to the protocol that returns metadata about sessions known to the agent. This endpoint would:

1. **Return a list of sessions** with essential metadata:
   * `sessionId` - Unique identifier
   * `cwd` - Working directory for the session
   * `title` - Optional human-readable title (could be auto-generated from first prompt)
   * `updatedAt` - Timestamp of last update to the session
   * `_meta` - Optional agent-specific metadata
2. **Support filtering and pagination**:
   * Filter by working directory
   * Agent provides an optional cursor for retrieving the next page of results
3. **Be an optional capability**:
   * Agents advertise `sessionCapabilities: { list: {} }` in initialization if they support this feature
   * Clients check for this capability before attempting to call `session/list`
   * Agents without persistent session storage don't need to implement this

### JSON-RPC Request

The client calls `session/list` with optional filtering and pagination parameters:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/list",
  "params": {
    "cwd": "/home/user/project",
    "cursor": "eyJwYWdlIjogMn0="
  }
}
```

#### Request Parameters

All parameters are optional:

* `cwd` (string) - Filter sessions by working directory
* `cursor` (string) - Opaque cursor token from a previous response's `nextCursor` field for cursor-based pagination

#### Minimal Request Example

A request with no filters returns all sessions with default sorting:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/list",
  "params": {}
}
```

### JSON-RPC Response

The agent responds with a list of sessions and cursor pagination metadata:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessions": [
      {
        "sessionId": "sess_abc123def456",
        "updatedAt": "2025-10-29T14:22:15Z",
        "cwd": "/home/user/project",
        "title": "Implement session list API",
        "_meta": {
          "messageCount": 12,
          "hasErrors": false
        }
      },
      {
        "sessionId": "sess_xyz789ghi012",
        "updatedAt": "2025-10-28T16:45:30Z",
        "cwd": "/home/user/another-project",
        "title": "Debug authentication flow"
      },
      {
        "sessionId": "sess_uvw345rst678",
        "updatedAt": "2025-10-27T15:30:00Z",
        "cwd": "/home/user/project"
      }
    ],
    "nextCursor": "eyJwYWdlIjogM30="
  }
}
```

#### Response Fields

**Response object:**

* `sessions` (array) - Array of session information objects
* `nextCursor` (string, optional) - Opaque cursor token. If present, pass this in the next request's `cursor` parameter to fetch the next page. If absent, there are no more results.

**SessionInfo object:**

* `sessionId` (string, required) - Unique identifier for the session
* `cwd` (string, required) - Working directory for the session
* `title` (string, optional) - Human-readable title (may be auto-generated from first prompt)
* `updatedAt` (string, optional) - ISO 8601 timestamp of last activity
* `_meta` (object, optional) - Agent-specific metadata (e.g., message count, error status, tags)

#### Empty Result Example

When no sessions match the criteria:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessions": []
  }
}
```

## Shiny future

Once this feature exists:

1. **Clients can build session browsers** - Users can view a list of all their conversations, sorted by recency or relevance
2. **Session switching becomes seamless** - Users can easily switch between ongoing conversations
3. **Better resource management** - Clients can identify and clean up old or inactive sessions
4. **Cross-device continuity** - Users could potentially access their sessions from different devices (if agent supports it)
5. **Improved UX patterns**:
   * "Recent conversations" sidebar
   * Search through past sessions
   * Archive/delete old sessions
   * Resume interrupted work easily

Agents that implement this feature gain:

* Better visibility into active sessions
* Opportunity to implement session lifecycle policies
* Foundation for future features like session sharing or collaboration

## Implementation details and plan

### Phase 1: Core Protocol Changes

1. **Update schema.json** to add:
   * `session/list` method definition
   * `ListSessionsRequest` and `ListSessionsResponse` types
   * `SessionInfo` type
   * `sessionCapabilities/list` capability flag

2. **Update protocol documentation** in `/docs/protocol/session-setup.mdx`:
   * Document the new endpoint
   * Explain when to use it vs. maintaining client-side session tracking
   * Provide examples of common use cases

### Phase 2: Reference Implementation

3. **Implement in Rust SDK** (`src/agent.rs` and `src/client.rs`):
   * Add `list_sessions` method to agent trait
   * Provide default implementation (empty list) for agents without persistence
   * Add client method to call `session/list`

4. **Add to TypeScript SDKs** (if applicable):
   * Update TypeScript types
   * Add client methods

### Phase 3: Example Implementation

5. **Create example agent** that demonstrates:
   * In-memory session registry
   * Automatic title generation from first prompt
   * Session lifecycle management (cleanup after N days)
   * Pagination and filtering

### Compatibility Considerations

* **Backward compatible**: Existing agents continue working without implementing this
* **Capability-based**: Clients check for `listSessions` capability before using
* **No breaking changes**: No modifications to existing endpoints

### Security Considerations

* **Session isolation**: Agents must ensure sessions are only listed for the authenticated client
* **Resource limits**: Agents should enforce reasonable page sizes internally to prevent abuse

## Frequently asked questions

### What alternative approaches did you consider, and why did you settle on this one?

Several alternatives were considered:

1. **Client-side session tracking only** - This is the current approach, but it has limitations:
   * Doesn't work across devices
   * Can get out of sync
   * Adds complexity to every client implementation

2. **Session events/notifications** - Push notifications when sessions are created/destroyed:
   * More complex to implement
   * Requires long-lived connections
   * Still requires client-side state management
   * Better suited as a future enhancement, not a replacement

3. **File-based session manifest** - Agent writes session list to a file that clients read:
   * Couples agent and client file system access
   * Doesn't work for remote agents
   * No standard format

The proposed RPC approach is:

* **Consistent with existing protocol design** - Uses same RPC patterns as other endpoints
* **Flexible** - Supports filtering, pagination, and agent-specific metadata
* **Optional** - Agents can opt-in based on their architecture
* **Simple** - Single request/response pattern, easy to implement and use

### Why not make this mandatory for all agents?

Many agents may not have persistent storage or multi-session capabilities. Making this optional:

* Allows simple, stateless agents to remain compliant
* Reduces implementation burden
* Lets agents evolve session management over time

### How does this interact with `session/load`?

`session/load` remains the mechanism to actually restore a session. `session/list` is for discovery only:

1. Client calls `session/list` to get available sessions
2. User selects a session
3. Client calls `session/load` with the chosen `sessionId`

Agents may support `session/list` without supporting `session/load` (e.g., for read-only session browsing).

### Should we include session content in the list response?

No, for several reasons:

* **Performance** - Full conversation history could be large
* **Privacy** - Listing sessions might be less sensitive than exposing full content
* **Separation of concerns** - Use `session/load` to get full session content

### What about session deletion?

Session deletion is intentionally left out of this RFD to keep scope focused. A future `session/delete` endpoint could be proposed separately. For now, agents can implement their own lifecycle policies.

### How should pagination work for large session lists?

We use cursor-based pagination:

* Request includes an optional `cursor`
* Response includes `nextCursor` when more results are available
* Clients should treat a missing `nextCursor` as the end of results
* Clients MUST treat cursors as opaque tokens: don't parse, modify, or persist them across sessions
* The cursor MUST be a string; never send a raw JSON object as the cursor
* Servers SHOULD provide stable cursors and handle invalid cursors gracefully

Good request example:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/list",
  "params": {
    "cwd": "/home/user/project",
    "createdAfter": "2025-10-20T00:00:00Z",
    "cursor": "eyJwYWdlIjogMn0=",
    "search": "auth"
  }
}
```

Corresponding response example:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessions": [
      /* ... */
    ],
    "nextCursor": "eyJwYWdlIjogM30="
  }
}
```

## Revision history

* **2025-10-29**: Initial draft proposal
* **2025-10-30**: Update to use `_meta` field for agent-specific metadata
* **2025-10-30**: Switch from offset-based to cursor-based pagination using continuation tokens
* **2025-10-30**: Rename `lastAccessedAt` to `updatedAt` for consistency
* **2025-10-30**: Remove `preview` field from SessionInfo (out of scope)
* **2025-10-30**: Remove session orphaning from problem statement
* **2025-10-30**: Replace `sortBy`/`sortOrder` with `search` parameter; remove `total` count from response
* **2025-10-31**: Update pagination: `continuationToken` → `cursor`, `nextContinuationToken` → `nextCursor`, remove `hasMore`
* **2025-11-11**: Remove `createdAt`, `updatedAt`, and `search` filters from the request parameters
* **2025-11-23**: Remove `limit` parameter from request; make `createdAt` and `updatedAt` optional in SessionInfo
* **2025-11-24**: Update capabilities schema, consolidate to single `updatedAt` timestamp


# Resuming of existing sessions
Source: https://agentclientprotocol.com/rfds/session-resume



* Author(s): [@josevalim](https://github.com/josevalim)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

We propose adding the ability to resume existing sessions. This is similar to "session/load",
except it does not return previous messages.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

While the spec provides a "session/load" command, not all coding agents implement it.
This means that, once you close your editor, browser, etc, you can't resume the conversation.

This is particularly a problem for agents that do not directly implement ACP and the
functionality is implemented via a wrapper. In such cases, they may provide the ability
to resume (without history), which we would like to hook into. Not only that, resuming
could be used as a mechanism for proxies and adapter libraries to emulate "session/load".

## What we propose to do about it

> What are you proposing to improve the situation?

Add a "session/resume" command and a capability `{ session: { resume: {} }`.

## Shiny future

> How will things will play out once this feature exists?

We will be able to resume existing conversations, providing a better user experience.

Not only that, if an agent does not implement "session/load" but it does implement
"session/resume", it is now possible to implement a proxy/adapter that intercepts
the agents messages and writes them to disk. Now when the client issues a
"session/load", the proxy/adapter converts it to a "session/resume", and then returns
the stored messages.

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### Should we introduce a new operation (session/resume) or add an option to (session/load)?

A separate method provides a few benefits:

* for clients that for whatever reason don't want the history, they can just resume

* for agents that can only supply resume, a proxy on top could provide load on top of it,
  but the agent is still clear on what it supports

* for agents who support both, it should be trivial to use the same resume functionality,
  they just either replay events or do not

### What alternative approaches did you consider, and why did you settle on this one?

The biggest question is if it makes sense to support both "session/load" and
"session/resume".

When we start a new session over ACP, we introduce custom MCP tools and configuration.
This means that, while we could use "session/load" to load our own chats, loading
third-party chats would likely lead to a flawed user experience, as our tools would
not be available. And depending on the ACP implementation, not even the capabilities
would be respected (as loading a third-party session would not include our capabilities
in its history, misleading the agent).

Therefore, if we assume "session/load" is for loading conversations started by the client
itself, "session/resume" is effectively a subset of "session/load", decoupled from storage
mechanics. If an agent implements "session/load", then it can be used directly, but if it
doesn't, a proxy or adapter can provide a reasonable fallback on top of "session/resume".
This argues "session/resume" is the basic primitive which "session/load" builds on top of.

## Revision history

* 2025-11-24: Update FAQ to mention session/resume vs session/load


# Session Usage and Context Status
Source: https://agentclientprotocol.com/rfds/session-usage



* Author(s): [@ahmedhesham6](https://github.com/ahmedhesham6)
* Champion: [@benbrandt](https://github.com/benbrandt)

## Elevator pitch

> What are you proposing to change?

Add standardized usage and context window tracking to the Agent Client Protocol, enabling agents to report token consumption, cost estimates, and context window utilization in a consistent way across implementations.

## Status quo

> How do things work today and what problems does this cause? Why would we change things?

Currently, the ACP protocol has no standardized way for agents to communicate:

1. **Token usage** - How many tokens were consumed in a turn or cumulatively
2. **Context window status** - How much of the model's context window is being used
3. **Cost information** - Estimated costs for API usage
4. **Prompt caching metrics** - Cache hits/misses for models that support caching

This creates several problems:

* **No visibility into resource consumption** - Clients can't show users how much of their context budget is being used
* **No cost transparency** - Users can't track spending or estimate costs before operations
* **No context management** - Clients can't warn users when approaching context limits or suggest compaction
* **Inconsistent implementations** - Each agent implements usage tracking differently (if at all)

Industry research shows common patterns across AI coding tools:

* LLM providers return cumulative token counts in API responses
* IDE extensions display context percentage prominently (e.g., radial progress showing "19%")
* Clients show absolute numbers on hover/detail (e.g., "31.4K of 200K tokens")
* Tools warn users at threshold percentages (75%, 90%, 95%)
* Auto-compaction features trigger when approaching context limits
* Cost tracking focuses on cumulative session totals rather than per-turn breakdowns

## What we propose to do about it

> What are you proposing to improve the situation?

We propose separating usage tracking into two distinct concerns:

1. **Token usage** - Reported in `PromptResponse` after each turn (per-turn data)
2. **Context window and cost** - Reported via `session/update` notifications with `sessionUpdate: "usage_update"` (session state)

This separation reflects how users consume this information:

* Token counts are tied to specific turns and useful immediately after a prompt
* Context window and cost are cumulative session state that agents push proactively when available

Agents send context updates at appropriate times:

* On `session/new` response (if agent can query usage immediately)
* On `session/load` / `session/resume` (for resumed/forked sessions)
* After each `session/prompt` response (when usage data becomes available)
* Anytime context window state changes significantly

This approach provides flexibility for different agent implementations:

* Agents that support getting current usage without a prompt can immediately send updates when creating, resuming, or forking chats
* Agents that only provide usage when actively prompting can send updates after sending a new prompt

### Token Usage in `PromptResponse`

Add a `usage` field to `PromptResponse` for token consumption tracking:

```json theme={null}
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123",
    "stopReason": "end_turn",
    "usage": {
      "total_tokens": 53000,
      "input_tokens": 35000,
      "output_tokens": 12000,
      "thought_tokens": 5000,
      "cached_read_tokens": 5000,
      "cached_write_tokens": 1000
    }
  }
}
```

#### Usage Fields

* `total_tokens` (number, required) - Sum of all token types across session
* `input_tokens` (number, required) - Total input tokens across all turns
* `output_tokens` (number, required) - Total output tokens across all turns
* `thought_tokens` (number, optional) - Total thought/reasoning tokens
* `cached_read_tokens` (number, optional) - Total cache read tokens
* `cached_write_tokens` (number, optional) - Total cache write tokens

### Context Window and Cost via `session/update`

Agents send context window and cost information via `session/update` notifications with `sessionUpdate: "usage_update"`:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "usage_update",
      "used": 53000,
      "size": 200000
    }
  }
}
```

#### Context Window Fields (required)

* `used` (number, required) - Tokens currently in context
* `size` (number, required) - Total context window size in tokens

Note: Clients can compute `remaining` as `size - used` and `percentage` as `used / size * 100` if needed.

#### Cost Fields (optional)

* `cost` (object, optional) - Cumulative session cost
  * `amount` (number, required) - Total cumulative cost for session
  * `currency` (string, required) - ISO 4217 currency code (e.g., "USD", "EUR")

Example with optional cost:

```json theme={null}
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123",
    "update": {
      "sessionUpdate": "usage_update",
      "used": 53000,
      "size": 200000,
      "cost": {
        "amount": 0.045,
        "currency": "USD"
      }
    }
  }
}
```

### Design Principles

1. **Separation of concerns** - Token usage is per-turn data, context window and cost are session state
2. **Agent-pushed notifications** - Agents proactively send context updates when data becomes available, following the same pattern as other dynamic session properties (`available_commands_update`, `current_mode_update`, `session_info_update`)
3. **Agent calculates, client can verify** - Agent knows its model best and provides calculations, but includes raw data for client verification
4. **Flexible cost reporting** - Cost is optional since not all agents track it. Support any currency, don't assume USD
5. **Prompt caching support** - Include cache read/write tokens for models that support it
6. **Optional but recommended** - Usage tracking is optional to maintain backward compatibility
7. **Flexible timing** - Agents send updates when they can: immediately for agents with on-demand APIs, or after prompts for agents that only provide usage during active prompting

## Shiny future

> How will things will play out once this feature exists?

**For Users:**

* **Visibility**: Users see real-time context window usage with percentage indicators
* **Cost awareness**: Users can track spending and check cumulative cost at any time
* **Better planning**: Users know when to start new sessions or compact context
* **Transparency**: Clear understanding of resource consumption

**For Client Implementations:**

* **Consistent UI**: All clients can show usage in a standard way (progress bars, percentages, warnings)
* **Smart warnings**: Clients can warn users at 75%, 90% context usage
* **Cost controls**: Clients can implement budget limits and alerts
* **Analytics**: Clients can track usage patterns and optimize
* **Reactive updates**: Clients receive context updates reactively via notifications, updating UI immediately when agents push new data
* **No polling needed**: Updates arrive automatically when agents have new information, eliminating the need for clients to poll

**For Agent Implementations:**

* **Standard reporting**: Clear contract for what to report and when
* **Flexibility**: Optional fields allow agents to report what they can calculate
* **Model diversity**: Works with any model (GPT, Claude, Llama, etc.)
* **Caching support**: First-class support for prompt caching

## Implementation details and plan

> Tell me more about your implementation. What is your detailed implementation plan?

1. **Update schema.json** to add:
   * `Usage` type with token fields
   * `Cost` type with `amount` and `currency` fields
   * `ContextUpdate` type with `used`, `size` (required) and optional `cost` field
   * Add optional `usage` field to `PromptResponse`
   * Add `UsageUpdate` variant to `SessionUpdate` oneOf array (with `sessionUpdate: "usage_update"`)

2. **Update protocol documentation**:
   * Document `usage` field in `/docs/protocol/prompt-turn.mdx`
   * Document `session/update` notification with `sessionUpdate: "usage_update"` variant
   * Add examples showing typical usage patterns and when agents send context updates

## Frequently asked questions

> What questions have arisen over the course of authoring this document or during subsequent discussions?

### Why separate token usage from context window and cost?

Different users care about different things at different times:

* **Token counts**: Relevant immediately after a turn completes to understand the breakdown
* **Context window remaining**: Relevant at any time, especially before issuing a large prompt. "Do I need to handoff or compact?"
* **Cumulative cost**: Session-level state that agents push when available

Separating them allows:

* Cleaner data model where per-turn data stays in turn responses
* Agents to push context updates proactively when data becomes available
* Clients to receive updates reactively without needing to poll

### Why is cost in session/update instead of PromptResponse?

Cost is cumulative session state, similar to context window:

* Users want to track total spending, not just per-turn costs
* Keeps `PromptResponse` focused on per-turn token breakdown
* Both cost and context window are session-level metrics that belong together
* Cost is optional since not all agents track it

### How do users know when to handoff or compact the context?

The context update notification provides everything needed:

* `used` and `size` give absolute numbers for precise tracking
* Clients can compute `remaining` as `size - used` and `percentage` as `used / size * 100`
* `size` lets clients understand the total budget

**Recommended client behavior:**

| Percentage | Action                                                           |
| ---------- | ---------------------------------------------------------------- |
| \< 75%     | Normal operation                                                 |
| 75-90%     | Yellow indicator, suggest "Context filling up"                   |
| 90-95%     | Orange indicator, recommend "Start new session or summarize"     |
| > 95%      | Red indicator, warn "Next prompt may fail - handoff recommended" |

Clients can also:

* Offer "Compact context" or "Summarize conversation" actions
* Auto-suggest starting a new session
* Implement automatic handoff when approaching limits

### Why not assume USD for cost?

Agents may bill in different currencies:

* European agents might bill in EUR
* Asian agents might bill in JPY or CNY
* Some agents might use credits or points
* Currency conversion rates change

Better to report actual billing currency and let clients convert if needed.

### What if the agent can't calculate some fields?

All fields except the basic token counts are optional. Agents report what they can calculate. Clients handle missing fields gracefully.

### How does this work with streaming responses?

* During streaming: Agents may send progressive context updates via `session/update` notifications as usage changes
* Final response: Include complete token usage in `PromptResponse`
* Context window and cost: Agents send `session/update` notifications with `sessionUpdate: "usage_update"` when data becomes available (after prompt completion, on session creation/resume, or when context state changes significantly)

### What about models without fixed context windows?

* Report effective context window size
* For models with dynamic windows, report current limit
* Update size if it changes
* Set to `null` if truly unlimited (rare)

### What about rate limits and quotas?

This RFD focuses on token usage and context windows. Rate limits and quotas are a separate concern that could be addressed in a future RFD. However, the cost tracking here helps users understand their usage against quota limits.

### Should cached tokens count toward context window?

Yes, cached tokens still occupy context window space. They're just cheaper to process. The context window usage should include all tokens (regular + cached).

### Why notification instead of request?

Using `session/update` notifications instead of a `session/status` request provides several benefits:

1. **Consistency**: Follows the same pattern as other dynamic session properties (`available_commands_update`, `current_mode_update`, `session_info_update`)
2. **Agent flexibility**: Agents can send updates when they have data available, whether that's immediately (for agents with on-demand APIs) or after prompts (for agents that only provide usage during active prompting)
3. **No polling**: Clients receive updates reactively without needing to poll
4. **Real-time updates**: Updates flow naturally as part of the session lifecycle

### What if the client connects mid-session?

When a client connects to an existing session (via `session/load` or `session/resume`), agents **SHOULD** send a context update notification if they have current usage data available. This ensures the client UI can immediately display accurate context window and cost information.

For agents that only provide usage during active prompting, the client UI may not show usage until after the first prompt is sent, which is acceptable given the agent's capabilities.

