// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Playground from '../../ui/src/pages/Playground';
import { apiClient } from '../../ui/src/api/client';
import { LocaleProvider } from '../../ui/src/i18n/LocaleContext';

vi.mock('../../ui/src/api/client', () => ({
  apiClient: {
    getProviders: vi.fn().mockResolvedValue({
      openai: { display_name: 'OpenAI', protocol: 'openai', models: ['gpt-4o', 'gpt-4o-mini'], base_url: 'https://api.openai.com/v1' },
      anthropic: { display_name: 'Anthropic', protocol: 'anthropic', models: ['claude-sonnet'], base_url: 'https://api.anthropic.com' },
    }),
    getHealth: vi.fn(),
    getModels: vi.fn().mockResolvedValue({ data: [{ id: 'openai/gpt-4o' }, { id: 'anthropic/claude-sonnet' }] }),
    getConfig: vi.fn().mockResolvedValue({ conversions: {} }),
    updateConfig: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    checkUpdate: vi.fn(),
    executeUpdate: vi.fn(),
    getLogs: vi.fn(),
  },
}));

// Mock navigator.clipboard for copy functionality
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

// Helper to render and wait for async state to settle
async function renderPlayground() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = renderWithLocale(<Playground />);
  });
  // Wait for getModels useEffect to settle
  await waitFor(() => {
    expect(screen.getByText('API 测试')).toBeInTheDocument();
  });
  return result!;
}

describe('Playground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('locale', 'zh');
  });

  it('renders the page title', async () => {
    await renderPlayground();
    expect(screen.getByText('API 测试')).toBeInTheDocument();
  });

  describe('Endpoint selector', () => {
    it('renders endpoint selector with 3 options', async () => {
      await renderPlayground();
      expect(screen.getByText('端点')).toBeInTheDocument();
      // Find the endpoint select (first select on the page)
      const selects = screen.getAllByRole('combobox');
      const endpointSelect = selects[0];
      expect(endpointSelect).toBeInTheDocument();
      const options = endpointSelect.querySelectorAll('option');
      expect(options).toHaveLength(3);
      expect(options[0].textContent).toContain('/v1/chat/completions');
      expect(options[1].textContent).toContain('/v1/messages');
      expect(options[2].textContent).toContain('/v1/responses');
    });

    it('defaults to chat completions endpoint', async () => {
      await renderPlayground();
      const selects = screen.getAllByRole('combobox');
      const endpointSelect = selects[0] as HTMLSelectElement;
      expect(endpointSelect.value).toBe('/v1/chat/completions');
    });

    it('allows changing endpoint', async () => {
      await renderPlayground();
      const selects = screen.getAllByRole('combobox');
      const endpointSelect = selects[0] as HTMLSelectElement;
      fireEvent.change(endpointSelect, { target: { value: '/v1/messages' } });
      expect(endpointSelect.value).toBe('/v1/messages');
    });
  });

  describe('Provider and Model selection', () => {
    it('renders provider dropdown', async () => {
      await renderPlayground();
      // The provider select has the placeholder option "选择厂商..."
      const selects = screen.getAllByRole('combobox');
      // selects[0] = endpoint, selects[1] = provider, selects[2] = model (if visible)
      const providerSelect = selects[1] as HTMLSelectElement;
      expect(providerSelect).toBeInTheDocument();
      // Should have placeholder + 2 providers
      expect(providerSelect.options.length).toBeGreaterThanOrEqual(3);
    });

    it('shows model dropdown after selecting a provider', async () => {
      await renderPlayground();
      const selects = screen.getAllByRole('combobox');
      const providerSelect = selects[1] as HTMLSelectElement;

      // Select openai provider
      fireEvent.change(providerSelect, { target: { value: 'openai' } });

      // Model dropdown should now appear
      await waitFor(() => {
        const updatedSelects = screen.getAllByRole('combobox');
        // endpoint + provider + model dropdown = at least 3
        expect(updatedSelects.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('auto-selects first model when provider is chosen', async () => {
      await renderPlayground();
      const selects = screen.getAllByRole('combobox');
      const providerSelect = selects[1] as HTMLSelectElement;

      fireEvent.change(providerSelect, { target: { value: 'openai' } });

      // The model input should be populated with openai/gpt-4o
      await waitFor(() => {
        const modelInput = screen.getByPlaceholderText('例如: openai/gpt-4o') as HTMLInputElement;
        expect(modelInput.value).toBe('openai/gpt-4o');
      });
    });
  });

  describe('Model input', () => {
    it('renders model input with datalist', async () => {
      await renderPlayground();
      const input = screen.getByPlaceholderText('例如: openai/gpt-4o');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('list', 'model-list');
    });

    it('renders datalist with fetched models', async () => {
      await renderPlayground();
      await waitFor(() => {
        const datalist = document.getElementById('model-list');
        expect(datalist).toBeInTheDocument();
        expect(datalist?.querySelectorAll('option')).toHaveLength(2);
      });
    });

    it('updates model state when typed into', async () => {
      await renderPlayground();
      const input = screen.getByPlaceholderText('例如: openai/gpt-4o') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'openai/gpt-4o' } });
      expect(input.value).toBe('openai/gpt-4o');
    });
  });

  describe('Send button', () => {
    it('is disabled when no model or message is provided', async () => {
      await renderPlayground();
      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is disabled when only model is filled', async () => {
      await renderPlayground();
      const modelInput = screen.getByPlaceholderText('例如: openai/gpt-4o');
      fireEvent.change(modelInput, { target: { value: 'openai/gpt-4o' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is disabled when only message is filled', async () => {
      await renderPlayground();
      const messageInput = screen.getByPlaceholderText('输入你的消息...');
      fireEvent.change(messageInput, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is enabled when both model and message are filled', async () => {
      await renderPlayground();
      const modelInput = screen.getByPlaceholderText('例如: openai/gpt-4o');
      const messageInput = screen.getByPlaceholderText('输入你的消息...');

      fireEvent.change(modelInput, { target: { value: 'openai/gpt-4o' } });
      fireEvent.change(messageInput, { target: { value: 'Hello, how are you?' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeEnabled();
    });
  });

  describe('Stream checkbox', () => {
    it('is checked by default', async () => {
      await renderPlayground();
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      expect(checkbox).toBeChecked();
    });

    it('can be toggled off', async () => {
      await renderPlayground();
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('can be toggled on and off', async () => {
      await renderPlayground();
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('Response panel', () => {
    it('shows placeholder text initially', async () => {
      await renderPlayground();
      expect(screen.getByText('响应将显示在这里...')).toBeInTheDocument();
    });

    it('has copy button (disabled when no response)', async () => {
      await renderPlayground();
      const copyButton = screen.getByLabelText('复制响应');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toBeDisabled();
    });

    it('has clear button (disabled when no response)', async () => {
      await renderPlayground();
      const clearButton = screen.getByLabelText('清空响应');
      expect(clearButton).toBeInTheDocument();
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Form controls', () => {
    it('renders system prompt textarea', async () => {
      const { container } = await renderPlayground();
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      const textareas = container.querySelectorAll('textarea');
      expect(textareas.length).toBeGreaterThanOrEqual(2); // system + user message
    });

    it('renders user message textarea', async () => {
      await renderPlayground();
      const textarea = screen.getByPlaceholderText('输入你的消息...');
      expect(textarea).toBeInTheDocument();
    });

    it('renders temperature slider', async () => {
      const { container } = await renderPlayground();
      expect(screen.getByText(/Temperature: 0.7/)).toBeInTheDocument();
      const slider = container.querySelector('input[type="range"]');
      expect(slider).toBeInTheDocument();
    });

    it('renders max tokens input', async () => {
      const { container } = await renderPlayground();
      expect(screen.getByText('Max Tokens')).toBeInTheDocument();
      const spinner = container.querySelector('input[type="number"]');
      expect(spinner).toBeInTheDocument();
    });
  });
});
