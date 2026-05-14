// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Providers from '../../ui/src/pages/Providers';
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

// Mock window.alert for duplicate model warning
window.alert = vi.fn();

const mockProviders = {
  openai: { display_name: 'OpenAI', protocol: 'openai', models: ['gpt-4o', 'gpt-4o-mini'], base_url: 'https://api.openai.com/v1' },
  anthropic: { display_name: 'Anthropic', protocol: 'anthropic', models: ['claude-sonnet-4-20250514'], base_url: 'https://api.anthropic.com' },
};

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('shows empty state when no providers', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue({});

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('暂无厂商，点击"添加厂商"开始')).toBeInTheDocument();
      });
    });
  });

  describe('Provider list', () => {
    it('shows provider list in table', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      // "openai" and "anthropic" appear as both key column text and protocol badges
      const openaiElements = screen.getAllByText('openai');
      expect(openaiElements.length).toBeGreaterThanOrEqual(1);
      const anthropicElements = screen.getAllByText('anthropic');
      expect(anthropicElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows protocol badges', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);

      render(<Providers />);

      await waitFor(() => {
        const protocolElements = screen.getAllByText('openai');
        expect(protocolElements.length).toBeGreaterThan(0);
      });
    });

    it('shows model counts in the table', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // openai has 2 models
        expect(screen.getByText('1')).toBeInTheDocument(); // anthropic has 1 model
      });
    });
  });

  describe('Add provider', () => {
    it('opens modal when add button is clicked', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue({});

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('暂无厂商，点击"添加厂商"开始')).toBeInTheDocument();
      });

      const addButton = screen.getByText('添加厂商');
      fireEvent.click(addButton);

      // ProviderEditor modal should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('新建厂商')).toBeInTheDocument();
    });

    it('closes modal when cancel is clicked', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue({});

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('暂无厂商，点击"添加厂商"开始')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('添加厂商'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('creates a provider on save', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue({});
      vi.mocked(apiClient.createProvider).mockResolvedValue({});

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('暂无厂商，点击"添加厂商"开始')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('添加厂商'));

      // Fill in required fields
      const keyInput = screen.getByPlaceholderText('例如: openai, deepseek');
      fireEvent.change(keyInput, { target: { value: 'test-provider' } });

      const baseUrlInput = screen.getByPlaceholderText('https://api.openai.com/v1');
      fireEvent.change(baseUrlInput, { target: { value: 'https://api.test.com' } });

      const apiKeyInput = screen.getByPlaceholderText('sk-... 或 ${ENV_VAR}');
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test' } });

      // Add a model via the model input
      const modelInput = screen.getByPlaceholderText('输入模型名，回车添加');
      fireEvent.change(modelInput, { target: { value: 'test-model' } });
      fireEvent.keyDown(modelInput, { key: 'Enter', code: 'Enter' });

      // Save
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(apiClient.createProvider).toHaveBeenCalledWith(
          'test-provider',
          expect.objectContaining({
            display_name: '',
            base_url: 'https://api.test.com',
            api_key: 'sk-test',
            models: ['test-model'],
          })
        );
      });
    });
  });

  describe('Delete confirmation', () => {
    it('shows delete confirmation when trash button is clicked', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      // Click delete button for openai (aria-label)
      const deleteButton = screen.getByLabelText('删除 openai');
      fireEvent.click(deleteButton);

      // Confirmation dialog should appear
      expect(screen.getByText(/确定要删除厂商 "openai" 吗/)).toBeInTheDocument();
      expect(screen.getByText('删除')).toBeInTheDocument();
    });

    it('cancels delete when cancel is clicked', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('删除 openai'));
      expect(screen.getByText(/确定要删除厂商 "openai" 吗/)).toBeInTheDocument();

      // Click the first cancel button (in the dialog)
      const cancelButtons = screen.getAllByText('取消');
      fireEvent.click(cancelButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText(/确定要删除厂商 "openai" 吗/)).not.toBeInTheDocument();
      });
    });

    it('executes delete when confirm is clicked', async () => {
      vi.mocked(apiClient.getProviders).mockResolvedValue(mockProviders);
      vi.mocked(apiClient.deleteProvider).mockResolvedValue({});

      render(<Providers />);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('删除 openai'));

      // Click confirm delete button
      const deleteButtons = screen.getAllByText('删除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(apiClient.deleteProvider).toHaveBeenCalledWith('openai');
      });
    });
  });

  describe('Loading state', () => {
    it('shows loading skeleton while fetching', () => {
      vi.mocked(apiClient.getProviders).mockImplementation(() => new Promise(() => {}));

      render(<Providers />);

      // Title should be visible
      expect(screen.getByText('厂商管理')).toBeInTheDocument();

      // The table should not be rendered yet (loading skeletons instead)
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
