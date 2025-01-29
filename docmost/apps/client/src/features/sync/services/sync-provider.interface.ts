import { ISyncConfig } from '../types/sync.types';

export interface ISyncProvider {
  name: string;
  validateConfig(config: ISyncConfig): Promise<boolean>;
  sync(config: ISyncConfig): Promise<void>;
}