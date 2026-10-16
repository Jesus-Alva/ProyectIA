import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";
import express from "express";
import path from "node:path";

export function createApp(openai, agentName) {
  const agentReference = {
    body: {
      agent: {
        name: agentName,
        type: "agent_reference",
      },
    },
  };

  const app = express();
  const publicDirectory = path.join(import.meta.dirname, "public");

  app.use(express.json({ limit: "16kb" }));
  app.use(express.static(publicDirectory));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/chat", async (request, response) => {
    const { message, conversation_id: conversationId } = request.body ?? {};

    if (
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.length > 2000
    ) {
      response.status(422).json({
        error: "El mensaje debe contener entre 1 y 2000 caracteres.",
      });
      return;
    }

    if (
      conversationId !== undefined &&
      conversationId !== null &&
      (typeof conversationId !== "string" || conversationId.trim().length === 0)
    ) {
      response.status(422).json({ error: "El identificador de conversación no es válido." });
      return;
    }

    try {
      const conversation =
        conversationId ?? (await openai.conversations.create()).id;
      const result = await openai.responses.create(
        { conversation, input: message.trim() },
        agentReference,
      );

      if (typeof result.output_text !== "string" || result.output_text.length === 0) {
        throw new Error("Foundry returned an empty response.");
      }

      response.json({
        reply: result.output_text,
        conversation_id: conversation,
      });
    } catch (error) {
      console.error("Foundry chat request failed:", error);
      response.status(502).json({
        error: "No se pudo obtener una respuesta en este momento. Inténtalo de nuevo.",
      });
    }
  });

  return app;
}

if (import.meta.main) {
  const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const agentName = process.env.FOUNDRY_AGENT_NAME;

  if (!projectEndpoint || !agentName) {
    throw new Error("FOUNDRY_PROJECT_ENDPOINT y FOUNDRY_AGENT_NAME deben estar configurados.");
  }

  const projectClient = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());
  const openai = projectClient.getOpenAIClient();
  const app = createApp(openai, agentName);
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}.`);
  });
}
