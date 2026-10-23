# opencode-linkly-ai-memory

Long-term memory for [OpenCode](https://opencode.ai) 2.x, stored as notes in [Linkly AI](https://linkly.ai).

[中文说明](README.zh-CN.md)

Tell OpenCode a lasting preference once, such as "write code comments in English from now on", and it saves it as a Linkly AI note tagged `#记忆`. From then on these notes are part of OpenCode's system prompt in every session, so you don't have to repeat yourself. [pi-linkly-memory](https://github.com/LinklyAI/pi-linkly-memory) reads and writes the same notes, so Pi remembers them too.

## Quick start

Requirements:

- OpenCode 2.x. Check with `opencode --version`. The installer at `opencode.ai/install` still installs OpenCode 1; install 2.x with `curl -fsSL https://opencode.ai/v2/install | bash`
- [Linkly AI Desktop](https://linkly.ai) running, with the `linkly` CLI installed. In the Desktop app, open the **Agent usage** page and click **Install** in the **Linkly AI CLI** row under **Advanced**, or run `curl -sSL https://updater.linkly.ai/cli/install.sh | sh`

Then run:

```bash
opencode plugin add github:LinklyAI/opencode-linkly-ai-memory
```

Open `opencode` and state one of your habits. OpenCode saves it and tells you what it remembered. Start a new session and ask for something where the habit applies.

## How it works

- **Read**: each time you send a message, the plugin lists the notes tagged `#记忆` with the `linkly` CLI and reads them. Every model call of that turn gets them in the system prompt, along with rules for when and how to save. Edit a memory in Linkly AI and it applies from your next message.
- **Write**: the plugin adds a `linkly_ai_memory_save` tool that the model calls to save or update a memory. The tool runs `linkly note-save` and tags the note `#记忆`. When a memory on the same topic exists, the rules tell the model to update it instead of adding a new one.

## Managing memories

Memories are ordinary Linkly AI notes: read, edit, or delete them in the app. To see them in one place, create a library with a note filter on the `记忆` tag; notes with the tag are added to it automatically.

The plugin loads up to 200 memories and puts up to 12,000 characters of them in full into the prompt. The rest are listed by title with their file path, so the model can read them when it needs to.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `LINKLY_MEMORY_TAG` | `记忆` | Which tag marks a note as a memory |
| `LINKLY_CLI` | `~/.linkly/bin/linkly` if it exists, otherwise `linkly` on PATH | Command name or path of the Linkly AI CLI |

OpenCode 2.x runs plugins in its background service, so set these for the service, for example `opencode service set env LINKLY_MEMORY_TAG 工作记忆`, then restart it with `opencode service restart`.

## Update and uninstall

```bash
opencode plugin update github:LinklyAI/opencode-linkly-ai-memory
opencode plugin remove github:LinklyAI/opencode-linkly-ai-memory
```

Uninstalling the plugin doesn't delete your memory notes in Linkly AI.

## License

Apache-2.0
