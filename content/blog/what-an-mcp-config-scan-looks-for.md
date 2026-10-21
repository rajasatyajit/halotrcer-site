---
title: What an MCP config scan looks for
description: An outline of a post on the risks hiding in MCP client configuration files, and what sievant scan checks for in each MCP server entry, and why.
draft: true
---

## The question

Every MCP server an AI client launches is configured in a file on a developer's machine. Those files collect credentials, broad filesystem access and servers fetched from the internet, and nobody reviews them. This post will walk through what a configuration scan should look for, rule by rule.

## Planned sections

- **Where the configuration lives:** the files Claude Desktop, Claude Code, Cursor, VS Code and Windsurf read, and why project files matter as much as user files.
- **Credentials in plain text:** recognisable tokens, secret-named variables, passwords and capability URLs, and how to move them out of the file.
- **Too much access:** servers given the filesystem root or a whole home directory, and container or runtime flags that remove isolation.
- **Supply chain:** unpinned packages, moving tags, and servers fetched from a repository or launched by a downloaded script.
- **Remote servers:** no credential, or plain HTTP.
- **Tool descriptions that read like instructions:** why inspecting tools means starting the servers, and why that is never the default.
- **From findings to a fix:** what to change first, and how to stop a regression in CI.

## Sources to draw on

- [Is your MCP setup leaking?](https://sievant.halotrcer.com/scan) and the [scan and wrap guide](https://sievant.halotrcer.com/docs/scan-and-wrap).
- [Sievant's threat model](https://sievant.halotrcer.com/docs/threat-model).

## Not in this post

No scan results from anyone's machine and no counts of how common each finding is. Examples will come from the simulated demo configuration in Sievant's tests, labelled as such.
