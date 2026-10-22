# opencode-linkly-ai-memory

给 [OpenCode](https://opencode.ai) 2.x 补上长期记忆，记忆存在 [Linkly AI](https://linkly.ai) 的笔记里。

跟 OpenCode 说一次长期的要求，比如「以后写代码，注释一律用英文」，它会存成一条带 `#记忆` 标签的 Linkly AI 笔记。之后每个会话，这些笔记都会放进 OpenCode 的系统提示词，不用你再提醒。[pi-linkly-memory](https://github.com/LinklyAI/pi-linkly-memory) 读写的是同一批笔记，用 Pi 时这些记忆也有效。

## 快速上手

准备：

- OpenCode 2.x，用 `opencode --version` 查看。`opencode.ai/install` 这个安装脚本装的还是 OpenCode 1，装 2.x 用 `curl -fsSL https://opencode.ai/v2/install | bash`
- [Linkly AI 桌面端](https://linkly.ai)开着，并装好命令行工具 `linkly`。在桌面端「Agent 使用」页的「高级」区，在「Linkly AI CLI」一行点「安装」；或者在终端运行 `curl -sSL https://updater.linkly.ai/cli/install.sh | sh`

然后运行：

```bash
opencode plugin add github:LinklyAI/opencode-linkly-ai-memory
```

打开 `opencode`，说一条你的习惯。OpenCode 会存下来，并告诉你记了什么。再开一个新会话，让它做一件用得上这条习惯的事。

## 原理

- **读**：你每发一条消息，插件就用 `linkly` 命令行列出带 `#记忆` 的笔记并读出来，这一轮每次调用模型，都把它们放进系统提示词，同时附上什么时候存、怎么存的规则。在 Linkly AI 里改了记忆，下一条消息就生效。
- **写**：插件给 OpenCode 加了一个工具 `linkly_ai_memory_save`，模型用它存记忆、改记忆。工具内部运行 `linkly note-save`，并给笔记打上 `#记忆`。规则要求已有同一件事的记忆时改那一条，不新建。

## 管理记忆

记忆就是普通的 Linkly AI 笔记，在应用里就能看、改、删。想把记忆放在一处看，可以建一个库，添加笔记筛选，按 `记忆` 标签筛选，带这个标签的笔记会自动加进来。

插件最多读 200 条记忆，全文最多放进 12000 个字符。放不下的只放标题和文件路径，模型需要时自己去读。

## 配置

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `LINKLY_MEMORY_TAG` | `记忆` | 哪个标签算记忆 |
| `LINKLY_CLI` | 有 `~/.linkly/bin/linkly` 就用它，否则用 PATH 里的 `linkly` | Linkly AI 命令行的命令名或路径 |

OpenCode 2.x 的插件跑在它的后台服务里，所以环境变量要设给后台服务，比如 `opencode service set env LINKLY_MEMORY_TAG 工作记忆`，再用 `opencode service restart` 重启服务。

## 更新和卸载

```bash
opencode plugin update github:LinklyAI/opencode-linkly-ai-memory
opencode plugin remove github:LinklyAI/opencode-linkly-ai-memory
```

卸载插件不会删除 Linkly AI 里的记忆笔记。

## 许可证

Apache-2.0
