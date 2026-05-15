export interface ProviderHealth {
  healthy: boolean;
  failures: number;
  inCooldown: boolean;
}

export interface PresetItem {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: string;
  website?: string;
  models: string[];
}
