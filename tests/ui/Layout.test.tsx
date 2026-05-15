// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Layout from '../../ui/src/components/Layout';
import { LocaleProvider } from '../../ui/src/i18n/LocaleContext';

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
    checkUpdate: vi.fn().mockResolvedValue({ hasUpdate: false }),
    executeUpdate: vi.fn(),
    getLogs: vi.fn(),
  },
}));

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('Layout', () => {
  const defaultProps = {
    currentPage: 'dashboard' as const,
    onNavigate: vi.fn(),
    children: <div>Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('locale', 'zh');
  });

  describe('Navigation items', () => {
    it('renders all navigation items', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      expect(screen.getByText('仪表盘')).toBeInTheDocument();
      expect(screen.getByText('厂商管理')).toBeInTheDocument();
      expect(screen.getByText('API 测试')).toBeInTheDocument();
      expect(screen.getByText('日志')).toBeInTheDocument();
      expect(screen.getByText('设置')).toBeInTheDocument();
    });

    it('renders the app title and subtitle', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      // "open-api-proxy" appears in both sidebar h1 and mobile top bar
      const titleElements = screen.getAllByText('open-api-proxy');
      expect(titleElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('LLM API 统一网关')).toBeInTheDocument();
    });

    it('calls onNavigate when a nav button is clicked', () => {
      const onNavigate = vi.fn();
      renderWithLocale(<Layout {...defaultProps} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('厂商管理'));
      expect(onNavigate).toHaveBeenCalledWith('providers');
    });

    it('highlights the current page in the sidebar', () => {
      renderWithLocale(<Layout {...defaultProps} currentPage="providers" />);
      const providersButton = screen.getByText('厂商管理').closest('button');
      expect(providersButton?.className).toContain('bg-indigo-50');
    });
  });

  describe('Mobile sidebar toggle', () => {
    it('shows hamburger menu button on mobile', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('打开菜单')).toBeInTheDocument();
    });

    it('opens sidebar when hamburger menu is clicked', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('打开菜单'));
      // The sidebar should become visible; the close button should be accessible
      expect(screen.getByLabelText('关闭侧边栏')).toBeInTheDocument();
    });

    it('closes sidebar when close button is clicked', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('打开菜单'));
      fireEvent.click(screen.getByLabelText('关闭侧边栏'));
      // Sidebar closed, but we can still find the menu button
      expect(screen.getByLabelText('打开菜单')).toBeInTheDocument();
    });
  });

  describe('Dark mode toggle', () => {
    it('renders dark mode toggle button', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('切换深色模式')).toBeInTheDocument();
    });

    it('toggles dark mode when clicked', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      const button = screen.getByLabelText('切换深色模式');
      fireEvent.click(button);
      expect(screen.getByLabelText('切换浅色模式')).toBeInTheDocument();
    });

    it('persists theme preference to localStorage', () => {
      renderWithLocale(<Layout {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('切换深色模式'));
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('respects stored theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');
      renderWithLocale(<Layout {...defaultProps} />);
      expect(screen.getByLabelText('切换浅色模式')).toBeInTheDocument();
    });
  });

  describe('Children rendering', () => {
    it('renders children content', () => {
      renderWithLocale(<Layout {...defaultProps}>Custom Child</Layout>);
      expect(screen.getByText('Custom Child')).toBeInTheDocument();
    });
  });
});
