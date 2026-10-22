/**
 * Linkly AI Memory plugin for OpenCode
 *
 * Gives OpenCode long-term memory backed by Linkly AI notes. Memories are notes
 * tagged #记忆 (override with LINKLY_MEMORY_TAG). Whenever the user sends a
 * message the plugin lists them through the linkly CLI, and every model call
 * of that turn gets them in its system prompt, together with rules for saving
 * new memories with the linkly_ai_memory_save tool the plugin registers.
 *
 * Requirements:
 * - OpenCode 2.x
 * - Linkly AI Desktop running and the `linkly` CLI on PATH
 *
 * Install: opencode plugin add github:LinklyAI/opencode-linkly-ai-memory
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Plugin } from "@opencode/plugin";

const TAG = process.env.LINKLY_MEMORY_TAG || "记忆";
const CLI = process.env.LINKLY_CLI || "linkly";
const APP_NAME = "OpenCode";
const TOOL = "linkly_ai_memory_save";
const TIMEOUT_MS = 3000;
// Memories past this many characters are listed by title only, to keep the prompt bounded.
const MAX_CHARS = 12000;

interface Memory {
	noteId: string;
	version: string;
	path?: string;
	/** Undefined when the note file couldn't be read. */
	body?: string;
}

function runCli(args: string[], input = ""): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = execFile(
			CLI,
			[...args, "--json", "--client", "opencode"],
			{ timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LINKLY_NO_SKILLS_HINT: "1" } },
			(error, stdout) => {
				if (!error) return resolve(stdout);
				// With --json the CLI reports failures as {"status":"error","message":…} on stdout.
				let message = error.message;
				try {
					message = JSON.parse(stdout).message ?? message;
				} catch {}
				reject(new Error(message));
			},
		);
		child.stdin?.end(input);
	});
}

/** Note files start with YAML front matter; the body after it is the memory. */
function noteBody(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

async function loadMemories(): Promise<Memory[]> {
	const list = JSON.parse(
		await runCli(["list", "--scope", "notes", "--tags", TAG, "--sort", "oldest", "--no-snippet", "--limit", "200"]),
	);
	const items: any[] = list.items ?? [];
	// Read the note files directly: unlike `linkly read`, this works before Desktop has indexed them and never cuts a note off.
	return Promise.all(
		items.map(async (item) => ({
			noteId: item.note_id,
			version: item.version,
			path: item.path,
			body: item.path ? await readFile(item.path, "utf8").then(noteBody, () => undefined) : undefined,
		})),
	);
}

function hasTag(body: string): boolean {
	const tag = TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|\\s)#${tag}(?=\\s|$)`).test(body);
}

function renderSection(memories: Memory[]): string {
	let used = 0;
	const entries = memories.map((memory, index) => {
		const header = `### Memory ${index + 1} (note_id: ${memory.noteId}, version: ${memory.version})`;
		if (memory.body === undefined || used + memory.body.length > MAX_CHARS) {
			const title = memory.body ? `${memory.body.split("\n", 1)[0]} ` : "";
			const where = memory.path ? `read the file ${memory.path}` : "it couldn't be read";
			return `${header}\n${title}(not loaded; ${where})`;
		}
		used += memory.body.length;
		return `${header}\n${memory.body}`;
	});

	return `You have long-term memory that persists across sessions. It is stored as notes in the user's Linkly AI app, tagged #${TAG}, and the current memories are listed below. Treat them as the user's standing preferences: apply every relevant memory to your work without being asked, unless the user says otherwise in this conversation.

## When to save
- Save a memory when the user states a lasting preference, corrects how you work, or asks you to remember something, even if they never say "remember".
- Don't save one-off task details, things you can read from the code or files, or secrets.

## How to save
- Use the ${TOOL} tool. It tags the note #${TAG} for you.
- One topic per note. First line: a short title. Then the rule, plus one line on why if the user gave a reason.
- Note bodies accept only paragraphs, line breaks, bold, strikethrough and ordered/unordered lists. Headings, italics, inline code, code blocks, links and tables are rejected, so write identifiers as plain words.
- If a memory below already covers the topic, update it instead of creating a duplicate: pass the note_id and version from its header as note_id and base_version, with the full new body.
- After saving, tell the user in one short sentence what you remembered.

## Current memories

${entries.length > 0 ? entries.join("\n\n") : "(none yet)"}`;
}

export default {
	id: "linkly-ai-memory",
	async setup(ctx) {
		let memories: Memory[] | undefined;
		let error: string | undefined;
		let attempted = false;
		let warned = false;

		const refresh = async () => {
			attempted = true;
			try {
				memories = await loadMemories();
				error = undefined;
			} catch (cause) {
				// Keep the last good snapshot; the Desktop may be briefly unreachable.
				error = cause instanceof Error ? cause.message : String(cause);
			}
		};

		// Once per user message, not before every model call.
		await ctx.session.hook("prompt", refresh);

		await ctx.session.hook("context", async (event) => {
			if (!attempted) await refresh();
			if (memories !== undefined) {
				event.system.push({ type: "text", text: renderSection(memories) });
			} else if (error !== undefined && !warned) {
				// Server plugins can't show a notice in the UI, so the model passes it on.
				warned = true;
				event.system.push({
					type: "text",
					text: `Linkly AI memory is unavailable: ${error}. Before anything else in your reply, tell the user in one short sentence that their Linkly AI memories could not be loaded, quoting this reason.`,
				});
			}
		});

		await ctx.tool.transform((editor) => {
			editor.add({
				name: TOOL,
				description: `Save one long-term memory as a note in the user's Linkly AI app, or update an existing one. Omit note_id to create a new memory; to update one, pass the note_id and version from its header as note_id and base_version. The note is tagged #${TAG} automatically.`,
				input: {
					type: "object",
					properties: {
						content: {
							type: "string",
							description:
								"Full note body. First line: a short title. Then the rule, plus one line on why if the user gave a reason. Only paragraphs, line breaks, bold, strikethrough and lists.",
						},
						note_id: { type: ["string", "null"], description: "note_id of the memory to update. Omit to create a new memory." },
						base_version: { type: ["string", "null"], description: "version of the memory to update, from its header. Required with note_id." },
					},
					required: ["content"],
					additionalProperties: false,
				},
				options: { codemode: false },
				execute: async (input) => {
					const { content, note_id, base_version } = input as { content: string; note_id?: string | null; base_version?: string | null };
					if (note_id && !base_version) throw new Error("base_version is required to update a memory");
					const body = hasTag(content) ? content.trim() : `${content.trim()}\n\n#${TAG}`;
					const mode = note_id ? ["--mode", "edit", "--note-id", note_id, "--base-version", base_version as string] : ["--mode", "create"];
					const output = await runCli(["note-save", ...mode, "--content", "-", "--app-name", APP_NAME], body);
					// Later calls in this turn see the new note, including the version an edit needs.
					await refresh();
					return { content: `Saved to Linkly AI. ${output.trim()}` };
				},
			});
		});
	},
} satisfies Plugin.Plugin;
