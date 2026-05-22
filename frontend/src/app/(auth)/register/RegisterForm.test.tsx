import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '@/app/(auth)/register/RegisterForm';

// Mock AuthProvider
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    setAuth: vi.fn(),
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

// Mock API
vi.mock('@/api', () => ({
  api: {
    register: vi.fn(),
  },
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all form fields', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('should show validation errors on empty submit', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('should show password length error', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('should show password complexity error', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'alllowercase');
    await user.type(screen.getByLabelText('Confirm Password'), 'alllowercase');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Must contain uppercase, lowercase, and number')).toBeInTheDocument();
  });

  it('should show password mismatch error', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.type(screen.getByLabelText('Password'), 'TestPass123');
    await user.type(screen.getByLabelText('Confirm Password'), 'DifferentPass123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('should have link to login page', () => {
    render(<RegisterForm />);

    const link = screen.getByRole('link', { name: 'Login' });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('should show API error on registration failure', async () => {
    const { api } = await import('@/api');
    const { AxiosError, AxiosHeaders } = await import('axios');
    (api.register as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AxiosError('fail', '409', undefined, undefined, {
        data: { message: 'Email already exists' },
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full Name'), 'Test User');
    await user.type(screen.getByLabelText('Email'), 'dup@test.com');
    await user.type(screen.getByLabelText('Password'), 'TestPass123');
    await user.type(screen.getByLabelText('Confirm Password'), 'TestPass123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Email already exists')).toBeInTheDocument();
  });
});
