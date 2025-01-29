export interface ISyncConfig {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  schedule: string;
  sourceConfig: {
    [key: string]: any;
  };
  targetConfig: {
    spaceId: string;
    parentPageId?: string;
    updateExisting?: boolean;
  };
  credentials?: {
    [key: string]: string;
  };
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISyncProviderConfig {
  name: string;
  configSchema: {
    [key: string]: {
      type: string;
      required: boolean;
      description: string;
    };
  };
  credentialsSchema: {
    [key: string]: {
      type: string;
      required: boolean;
      description: string;
    };
  };
}