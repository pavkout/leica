// Recorded-response transport for tests: never calls Anthropic, never spends.

import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import type { Transport } from "./aiClient";

type Block = Message["content"][number];

export function fakeMessage(content: unknown[], stop: Message["stop_reason"] = "end_turn", usage: Partial<Message["usage"]> = {}): Message {
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: content as Block[],
    stop_reason: stop,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, ...usage },
  } as unknown as Message;
}

export const textBlock = (text: string) => ({ type: "text", text, citations: null });
export const reportBlock = (input: unknown) => ({ type: "tool_use", id: "toolu_fake", name: "report", input, caller: { type: "direct" } });

/** Replies in order; records every request it was sent. */
export function fakeTransport(replies: (Message | Error)[]): Transport & { sent: MessageCreateParamsNonStreaming[] } {
  const sent: MessageCreateParamsNonStreaming[] = [];
  const t = (async (_key: string, params: MessageCreateParamsNonStreaming) => {
    sent.push(structuredClone(params));
    const r = replies.shift();
    if (!r) throw new Error("fake transport: no reply left");
    if (r instanceof Error) throw r;
    return r;
  }) as Transport & { sent: MessageCreateParamsNonStreaming[] };
  t.sent = sent;
  return t;
}
