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
  openai: { display_name: 'OpenAI', protocol: 'openai', models: ['gpt-4o', 'gpt-4o-mini'] },
  anthropic: { display_name: 'Anthropic', protocol: 'anthropic', models: ['claude-sonnet-4-20250514'] },
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
    { id: 'claude-sonnet-4-20250514' },
  ],
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading skeletons initially', () => {
      vi.mocked(apiClient.getProviders).mockImplementation(() => new Promise(() => {}));
      vi.mocked(apiClient.getHealth).mockImplementation(() => new Promise(() => {}));
      vi.mocked(apiClient.getModels).mockImplementation(() => new Promise(() => {}));

      render(<Dashboard />);

      // Title should always be visible
      expect(screen.getByText('仪表盘')).toBeInTheDocument();

      // Stat labels should NOT be visible during loading (skeletons shown instead)
      expect(screen.queryByText('厂商数')).not.toBeInTheDocument();
      expect(screen.queryByText('模型数')).not.toBeInTheDocument();
      expect(screen.queryByText('运行时间')).not.toBeInTheDocument();
    });
  });

  describe('Data rendering', () => {
    it('renders stat cards after data loads', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('厂商数')).toBeInTheDocument();
      });

      expect(screen.getByText('模型数')).toBeInTheDocument();
      expect(screen.getByText('运行时间')).toBeInTheDocument();

      // Check stat values
      expect(screen.getByText('2')).toBeInTheDocument(); // providers count
      expect(screen.getByText('3')).toBeInTheDocument(); // models count
      expect(screen.getByText('1h 1m')).toBeInTheDocument(); // uptime

      // Verify API calls were made
      expect(apiClient.getProviders).toHaveBeenCalled();
      expect(apiClient.getHealth).toHaveBeenCalled();
      expect(apiClient.getModels).toHaveBeenCalled();
    });

    it('shows provider summary section', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('厂商状态')).toBeInTheDocument();
      });

      // Provider names should be visible in the summary
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
    });
  });

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

    it('retry button triggers reload and shows data', async () => {
      vi.mocked(apiClient.getProviders).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(apiClient.getHealth).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(apiClient.getModels).mockRejectedValueOnce(new Error('Network error'));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Setup mocks for retry to succeed
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.getHealth).mockResolvedValue(mockHealth);
      vi.mocked(apiClient.getModels).mockResolvedValue(mockModels);

      const retryButton = screen.getByText('重试');
      fireEvent.click(retryButton);

      // After retry, data should load
      await waitFor(() => {
        expect(screen.getByText('厂商数')).toBeInTheDocument();
      });
    });
  });
});
