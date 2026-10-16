import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const model = process.env.FOUNDRY_MODEL;

if (!projectEndpoint || !agentName || !model) {
  throw new Error(
    "FOUNDRY_PROJECT_ENDPOINT, FOUNDRY_AGENT_NAME y FOUNDRY_MODEL deben estar configurados.",
  );
}

const projectClient = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());

try {
  const agent = await projectClient.agents.createVersion(agentName, {
    kind: "prompt",
    model,
    instructions: "Eres un asistente útil y conciso. Responde en español.",
  });

  console.log(`Agente creado: ${agent.name} (versión ${agent.version}).`);
} catch (error) {
  console.error("No se pudo crear el agente en Microsoft Foundry:", error);
  process.exitCode = 1;
}
