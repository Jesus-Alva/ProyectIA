import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";
import express from "express";
import path from "node:path";

export function normalizeProjectEndpoint(endpoint) {
  const endpointUrl = new URL(endpoint);
  const segments = endpointUrl.pathname.split("/").filter(Boolean);
  const agentRouteIndex = segments.findIndex(
    (segment, index) =>
      segment === "agents" &&
      index + 4 < segments.length &&
      segments[index + 2] === "endpoint" &&
      segments[index + 3] === "protocols" &&
      segments[index + 4] === "openai" &&
      (index + 5 === segments.length ||
        (index + 6 === segments.length &&
          ["responses", "conversations"].includes(segments[index + 5]))),
  );

  if (agentRouteIndex === -1) {
    return endpoint;
  }

  endpointUrl.pathname = `/${segments.slice(0, agentRouteIndex).join("/")}`;
  return endpointUrl.toString().replace(/\/$/, "");
}

export function createApp(openai) {
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
      const result = await openai.responses.create({
        conversation,
        input: message.trim(),
      });

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
  const configuredEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const agentName = process.env.FOUNDRY_AGENT_NAME;

  if (!configuredEndpoint || !agentName) {
    throw new Error("FOUNDRY_PROJECT_ENDPOINT y FOUNDRY_AGENT_NAME deben estar configurados.");
  }

  const projectEndpoint = normalizeProjectEndpoint(configuredEndpoint);
  if (projectEndpoint !== configuredEndpoint) {
    console.warn(
      "FOUNDRY_PROJECT_ENDPOINT incluía la ruta del agente; se usará la raíz del proyecto.",
    );
  }

  const projectClient = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());
  const openai = projectClient.getOpenAIClient({
    azureConfig: {
      allowPreview: true,
      agentName,
    },
  });
  const app = createApp(openai);
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}.`);
  });
}
