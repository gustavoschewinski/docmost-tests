import api from "@/lib/api-client";
import { ISyncConfig } from "../types/sync.types";
import { GitHubSyncProvider } from "../providers/github-provider";

const providers = {
  github: new GitHubSyncProvider(),
};

export async function createSyncConfig(config: Partial<ISyncConfig>): Promise<ISyncConfig> {
  const req = await api.post<ISyncConfig>("/sync/create", config);
  return req.data;
}

export async function updateSyncConfig(config: Partial<ISyncConfig>): Promise<ISyncConfig> {
  const req = await api.post<ISyncConfig>("/sync/update", config);
  return req.data;
}

export async function deleteSyncConfig(id: string): Promise<void> {
  await api.post("/sync/delete", { id });
}

export async function listSyncConfigs(): Promise<ISyncConfig[]> {
  const req = await api.get<ISyncConfig[]>("/sync/list");
  return req.data;
}

export async function runSync(configId: string): Promise<void> {
  const req = await api.post<ISyncConfig>("/sync/run", { configId });
  const config = req.data;
  
  const provider = providers[config.provider];
  if (!provider) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  await provider.sync(config);
}