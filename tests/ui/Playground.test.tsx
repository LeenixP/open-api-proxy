// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Playground from '../../ui/src/pages/Playground';
import { apiClient } from '../../ui/src/api/client';

vi.mock('../../ui/src/api/client', () => ({
  apiClient: {
    getProviders: vi.fn(),
    getHealth: vi.fn(),
    getModels: vi.fn().mockResolvedValue({ data: [{ id: 'openai/gpt-4o' }, { id: 'anthropic/claude-sonnet' }] }),
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

// Mock navigator.clipboard for copy functionality
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('Playground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    render(<Playground />);
    expect(screen.getByText('API 测试')).toBeInTheDocument();
  });

  describe('Endpoint selector', () => {
    it('renders endpoint selector with 3 options', () => {
      const { container } = render(<Playground />);
      // Label is a sibling of select, no htmlFor/id, so query by DOM
      expect(screen.getByText('端点')).toBeInTheDocument();
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.options).toHaveLength(3);
      expect(select.options[0].textContent).toContain('/v1/chat/completions');
      expect(select.options[1].textContent).toContain('/v1/messages');
      expect(select.options[2].textContent).toContain('/v1/responses');
    });

    it('defaults to chat completions endpoint', () => {
      const { container } = render(<Playground />);
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('/v1/chat/completions');
    });

    it('allows changing endpoint', () => {
      const { container } = render(<Playground />);
      const select = container.querySelector('select') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '/v1/messages' } });
      expect(select.value).toBe('/v1/messages');
    });
  });

  describe('Model input', () => {
    it('renders model input with datalist', () => {
      render(<Playground />);
      const input = screen.getByPlaceholderText('例如: openai/gpt-4o');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('list', 'model-list');
    });

    it('renders datalist with fetched models', async () => {
      render(<Playground />);
      await waitFor(() => {
        const datalist = document.getElementById('model-list');
        expect(datalist).toBeInTheDocument();
        expect(datalist?.querySelectorAll('option')).toHaveLength(2);
      });
    });

    it('updates model state when typed into', () => {
      render(<Playground />);
      const input = screen.getByPlaceholderText('例如: openai/gpt-4o') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'openai/gpt-4o' } });
      expect(input.value).toBe('openai/gpt-4o');
    });
  });

  describe('Send button', () => {
    it('is disabled when no model or message is provided', () => {
      render(<Playground />);
      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is disabled when only model is filled', () => {
      render(<Playground />);
      const modelInput = screen.getByPlaceholderText('例如: openai/gpt-4o');
      fireEvent.change(modelInput, { target: { value: 'openai/gpt-4o' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is disabled when only message is filled', () => {
      render(<Playground />);
      const messageInput = screen.getByPlaceholderText('输入你的消息...');
      fireEvent.change(messageInput, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeDisabled();
    });

    it('is enabled when both model and message are filled', () => {
      render(<Playground />);
      const modelInput = screen.getByPlaceholderText('例如: openai/gpt-4o');
      const messageInput = screen.getByPlaceholderText('输入你的消息...');

      fireEvent.change(modelInput, { target: { value: 'openai/gpt-4o' } });
      fireEvent.change(messageInput, { target: { value: 'Hello, how are you?' } });

      const sendButton = screen.getByRole('button', { name: '发送' });
      expect(sendButton).toBeEnabled();
    });
  });

  describe('Stream checkbox', () => {
    it('is checked by default', () => {
      render(<Playground />);
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      expect(checkbox).toBeChecked();
    });

    it('can be toggled off', () => {
      render(<Playground />);
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('can be toggled on and off', () => {
      render(<Playground />);
      const checkbox = screen.getByLabelText('流式输出') as HTMLInputElement;
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('Response panel', () => {
    it('shows placeholder text initially', () => {
      render(<Playground />);
      expect(screen.getByText('响应将显示在这里...')).toBeInTheDocument();
    });

    it('has copy button (disabled when no response)', () => {
      render(<Playground />);
      const copyButton = screen.getByLabelText('复制响应');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toBeDisabled();
    });

    it('has clear button (disabled when no response)', () => {
      render(<Playground />);
      const clearButton = screen.getByLabelText('清空响应');
      expect(clearButton).toBeInTheDocument();
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Form controls', () => {
    it('renders system prompt textarea', () => {
      const { container } = render(<Playground />);
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      const textareas = container.querySelectorAll('textarea');
      expect(textareas.length).toBeGreaterThanOrEqual(2); // system + user message
    });

    it('renders user message textarea', () => {
      render(<Playground />);
      const textarea = screen.getByPlaceholderText('输入你的消息...');
      expect(textarea).toBeInTheDocument();
    });

    it('renders temperature slider', () => {
      const { container } = render(<Playground />);
      expect(screen.getByText(/Temperature: 0.7/)).toBeInTheDocument();
      const slider = container.querySelector('input[type="range"]');
      expect(slider).toBeInTheDocument();
    });

    it('renders max tokens input', () => {
      const { container } = render(<Playground />);
      expect(screen.getByText('Max Tokens')).toBeInTheDocument();
      const spinner = container.querySelector('input[type="number"]');
      expect(spinner).toBeInTheDocument();
    });
  });
});
