// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../../ui/src/pages/Dashboard';
import { apiClient } from '../../ui/src/api/client';

vi.mock('../../ui/src/api/client', () => ({
  apiClient: {
    getProviders: vi.fn(),
    getHealth: vi.fn(),
    getModels: vi.fn(),
    getPresets: vi.fn(),
    importPreset: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    checkUpdate: vi.fn(),
    executeUpdate: vi.fn(),
    getLogs: vi.fn(),
  },
}));

const mockProviders = {
  openai: { display_name: 'OpenAI', protocol: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'o3', 'o4-mini'] },
  anthropic: { display_name: 'Anthropic', protocol: 'anthropic', models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'] },
};

const mockHealth = {
  uptime: 3661,
  providers: {
    openai: { healthy: true, failures: 0, inCooldown: false },
    anthropic: { healthy: true, failures: 0, inCooldown: false },
  },
};

const mockModels = {
  data: [
    { id: 'gpt-4o' },
    { id: 'gpt-4o-mini' },
    { id: 'gpt-5' },
    { id: 'o3' },
    { id: 'o4-mini' },
    { id: 'claude-sonnet-4-20250514' },
    { id: 'claude-opus-4-20250514' },
  ],
};

const mockPresets = {
  openai: { display_name: 'OpenAI', protocol: 'openai', models: ['gpt-4o', 'gpt-4o-mini'] },
  anthropic: { display_name: 'Anthropic', protocol: 'anthropic', models: ['claude-sonnet-4-20250514'] },
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no providers (empty state)
    vi.mocked(apiClient.getProviders).mockResolvedValue({});
    vi.mocked(apiClient.getHealth).mockResolvedValue({ uptime: 0, providers: {} });
    vi.mocked(apiClient.getModels).mockResolvedValue({ data: [] });
    vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);
    vi.mocked(apiClient.importPreset).mockResolvedValue({ ok: true });
  });

  /* ------------------------------------------------------------------ */
  /* Loading state                                                       */
  /* ------------------------------------------------------------------ */
  describe('Loading state', () => {
    it('shows loading skeletons initially', () => {
      vi.mocked(apiClient.getProviders).mockImplementation(() => new Promise(() => {}));
      vi.mocked(apiClient.getHealth).mockImplementation(() => new Promise(() => {}));
      vi.mocked(apiClient.getModels).mockImplementation(() => new Promise(() => {}));

      render(<Dashboard />);

      expect(screen.getByText('仪表盘')).toBeInTheDocument();
      // Stat labels should NOT be visible during loading
      expect(screen.queryByText('厂商数')).not.toBeInTheDocument();
      expect(screen.queryByText('模型数')).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Section 1: Stats Bar (with data)                                    */
  /* ------------------------------------------------------------------ */
  describe('Stats bar', () => {
    it('renders all 4 stat cards with correct values', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('厂商数')).toBeInTheDocument();
      });

      expect(screen.getByText('模型数')).toBeInTheDocument();
      expect(screen.getByText('运行时间')).toBeInTheDocument();

      // Stat values
      expect(screen.getByText('2')).toBeInTheDocument(); // providers
      expect(screen.getByText('7')).toBeInTheDocument(); // models
      expect(screen.getByText('1h 1m')).toBeInTheDocument(); // uptime
      expect(screen.getByText('2/2')).toBeInTheDocument(); // healthy / total
    });

    it('shows healthy count when some providers are unhealthy', async () => {
      const unhealthyHealth = {
        uptime: 120,
        providers: {
          openai: { healthy: true, failures: 0, inCooldown: false },
          anthropic: { healthy: false, failures: 3, inCooldown: true },
        },
      };
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(unhealthyHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('1/2')).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* Section 2: Models Overview                                          */
  /* ------------------------------------------------------------------ */
  describe('Models overview', () => {
    it('shows section title and provider cards', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('模型总览')).toBeInTheDocument();
      });

      // Provider names
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();

      // Protocol badges
      expect(screen.getByText('openai')).toBeInTheDocument();
      expect(screen.getByText('anthropic')).toBeInTheDocument();

      // Model chips - check a few
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
      expect(screen.getByText('claude-opus-4-20250514')).toBeInTheDocument();
    });

    it('shows model count footer per provider', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('模型总览')).toBeInTheDocument();
      });

      expect(screen.getByText('5 个模型')).toBeInTheDocument(); // OpenAI
      expect(screen.getByText('2 个模型')).toBeInTheDocument(); // Anthropic
    });

    it('handles provider with no models', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue({
        empty: { display_name: 'Empty', protocol: 'openai', models: [] },
      });
      vi.mocked(apiClient.getHealth).mockResolvedValue({
        uptime: 10,
        providers: { empty: { healthy: true, failures: 0, inCooldown: false } },
      });
      vi.mocked(apiClient.getModels).mockResolvedValue({ data: [] });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Empty')).toBeInTheDocument();
      });

      expect(screen.getByText('暂无模型')).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Section 3: Quick Actions                                            */
  /* ------------------------------------------------------------------ */
  describe('Quick actions', () => {
    it('shows quick action buttons when providers exist', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('快捷操作')).toBeInTheDocument();
      });

      expect(screen.getByText('添加厂商')).toBeInTheDocument();
      expect(screen.getByText('API 测试')).toBeInTheDocument();
    });

    it('calls onNavigate when clicking action buttons', async () => {
      const onNavigate = vi.fn();
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('添加厂商')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('添加厂商'));
      expect(onNavigate).toHaveBeenCalledWith('providers');

      fireEvent.click(screen.getByText('API 测试'));
      expect(onNavigate).toHaveBeenCalledWith('playground');
    });

    it('does not show quick actions when no providers', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('欢迎使用 open-api-proxy！')).toBeInTheDocument();
      });

      expect(screen.queryByText('快捷操作')).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Empty State                                                         */
  /* ------------------------------------------------------------------ */
  describe('Empty state', () => {
    it('shows welcome message when no providers', async () => {
      vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('欢迎使用 open-api-proxy！')).toBeInTheDocument();
      });

      expect(screen.getByText('尚未配置任何 LLM 厂商。你可以从预设中快速导入，或手动添加。')).toBeInTheDocument();
      expect(screen.getByText('手动添加')).toBeInTheDocument();
    });

    it('shows popular presets list', async () => {
      vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);

      render(<Dashboard />);

      // Wait for preset cards to render (import buttons appear)
      await waitFor(() => {
        expect(screen.getAllByText('导入').length).toBeGreaterThan(0);
      });

      // Should show preset names
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);

      // Import buttons
      const importButtons = screen.getAllByText('导入');
      expect(importButtons.length).toBe(2);
    });

    it('imports a preset when import button is clicked', async () => {
      vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);
      vi.mocked(apiClient.importPreset).mockResolvedValue({ ok: true });

      render(<Dashboard />);

      // Wait for preset cards to render by waiting for an import button
      await waitFor(() => {
        expect(screen.getAllByText('导入').length).toBeGreaterThan(0);
      });

      const importButtons = screen.getAllByText('导入');
      fireEvent.click(importButtons[0]);

      await waitFor(() => {
        expect(apiClient.importPreset).toHaveBeenCalledWith('openai');
      });
    });

    it('shows "Imported" badge after successful import', async () => {
      vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);
      vi.mocked(apiClient.importPreset).mockResolvedValue({ ok: true });

      render(<Dashboard />);

      // Wait for preset cards to render by waiting for an import button
      await waitFor(() => {
        expect(screen.getAllByText('导入').length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getAllByText('导入')[0]);

      await waitFor(() => {
        expect(screen.getByText('已导入')).toBeInTheDocument();
      });
    });

    it('navigates to providers on manual add click', async () => {
      const onNavigate = vi.fn();
      vi.mocked(apiClient.getPresets).mockResolvedValue(mockPresets);

      render(<Dashboard onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('手动添加')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('手动添加'));
      expect(onNavigate).toHaveBeenCalledWith('providers');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Error handling                                                      */
  /* ------------------------------------------------------------------ */
  describe('Error handling', () => {
    it('shows error banner when API fails', async () => {
      vi.mocked(apiClient.getProviders).mockRejectedValue(new Error('Network error'));
      vi.mocked(apiClient.getHealth).mockRejectedValue(new Error('Network error'));
      vi.mocked(apiClient.getModels).mockRejectedValue(new Error('Network error'));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('can retry after error', async () => {
      vi.mocked(apiClient.getProviders).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(apiClient.getHealth).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(apiClient.getModels).mockRejectedValueOnce(new Error('Network error'));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Set up retry to succeed
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      fireEvent.click(screen.getByText('重试'));

      await waitFor(() => {
        expect(screen.getByText('厂商数')).toBeInTheDocument();
      });
    });
  });
});
