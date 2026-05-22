import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteConcertDialog } from '@/components/admin/DeleteConcertDialog';

describe('DeleteConcertDialog', () => {
  const defaultProps = {
    concertName: 'Rock Concert',
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
  };

  it('should display concert name in the dialog', () => {
    render(<DeleteConcertDialog {...defaultProps} />);

    expect(screen.getByText('Delete Concert?')).toBeInTheDocument();
    expect(screen.getByText(/Rock Concert/)).toBeInTheDocument();
  });

  it('should show warning message about permanent deletion', () => {
    render(<DeleteConcertDialog {...defaultProps} />);

    expect(
      screen.getByText(/This action cannot be undone/)
    ).toBeInTheDocument();
  });

  it('should call onConfirm when "Yes, Delete" is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<DeleteConcertDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /Yes, Delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should call onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<DeleteConcertDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should disable buttons when isDeleting is true', () => {
    render(<DeleteConcertDialog {...defaultProps} isDeleting={true} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Deleting/i })).toBeDisabled();
  });

  it('should show "Deleting…" text when isDeleting', () => {
    render(<DeleteConcertDialog {...defaultProps} isDeleting={true} />);

    expect(screen.getByText('Deleting…')).toBeInTheDocument();
  });

  it('should not render dialog content when closed', () => {
    render(<DeleteConcertDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Delete Concert?')).not.toBeInTheDocument();
  });
});
