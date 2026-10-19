import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp, normalizeProjectEndpoint } from "../server.js";

async function startServer(t, openai) {
  const server = createApp(openai).listen(0);
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  return `http://127.0.0.1:${server.address().port}`;
}

test("removes a dedicated agent route from the project endpoint", () => {
  assert.equal(
    normalizeProjectEndpoint(
      "https://example.test/api/projects/demo/agents/test-agent/endpoint/protocols/openai/responses",
    ),
    "https://example.test/api/projects/demo",
  );
});

test("keeps a project root endpoint unchanged", () => {
  const endpoint = "https://example.test/api/projects/demo";

  assert.equal(normalizeProjectEndpoint(endpoint), endpoint);
});

test("reuses a conversation id for follow-up messages", async (t) => {
  const calls = [];
  let conversationCreations = 0;
  const openai = {
    conversations: {
      create: async () => {
        conversationCreations += 1;
        return { id: "conversation-123" };
      },
    },
    responses: {
      create: async (request) => {
        calls.push(request);
        return { output_text: "Respuesta de prueba." };
      },
    },
  };
  const baseUrl = await startServer(t, openai);

  const firstResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Recuerda esta palabra: jacaranda." }),
  });
  const firstResult = await firstResponse.json();

  const followUpResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "¿Qué palabra te pedí recordar?",
      conversation_id: firstResult.conversation_id,
    }),
  });
  const followUpResult = await followUpResponse.json();

  assert.equal(firstResponse.status, 200);
  assert.equal(followUpResponse.status, 200);
  assert.equal(firstResult.conversation_id, "conversation-123");
  assert.equal(followUpResult.conversation_id, "conversation-123");
  assert.equal(conversationCreations, 1);
  assert.deepEqual(calls, [
    { conversation: "conversation-123", input: "Recuerda esta palabra: jacaranda." },
    { conversation: "conversation-123", input: "¿Qué palabra te pedí recordar?" },
  ]);
});

test("rejects an empty message with status 422", async (t) => {
  const openai = {
    conversations: {
      create: async () => {
        throw new Error("Should not create a conversation for an invalid message.");
      },
    },
    responses: {
      create: async () => {
        throw new Error("Should not send an invalid message to Foundry.");
      },
    },
  };
  const baseUrl = await startServer(t, openai);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "   " }),
  });

  assert.equal(response.status, 422);
});

test("rejects messages longer than 2000 characters with status 422", async (t) => {
  const openai = {
    conversations: {
      create: async () => {
        throw new Error("Should not create a conversation for an invalid message.");
      },
    },
    responses: {
      create: async () => {
        throw new Error("Should not send an invalid message to Foundry.");
      },
    },
  };
  const baseUrl = await startServer(t, openai);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(2001) }),
  });

  assert.equal(response.status, 422);
});
