import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserConcertCard, type UserConcert } from '@/components/user/UserConcertCard';

const baseConcert: UserConcert = {
  id: 'c-1',
  name: 'Rock Festival',
  description: 'Amazing rock concert',
  totalSeats: 500,
  availableSeats: 300,
  isReserved: false,
};

describe('UserConcertCard', () => {
  it('should render concert name and description', () => {
    render(
      <UserConcertCard
        concert={baseConcert}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Rock Festival')).toBeInTheDocument();
    expect(screen.getByText('Amazing rock concert')).toBeInTheDocument();
  });

  it('should display available and total seat counts', () => {
    render(
      <UserConcertCard
        concert={baseConcert}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('/ 500')).toBeInTheDocument();
  });

  it('should show Reserve button when not reserved', () => {
    render(
      <UserConcertCard
        concert={baseConcert}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Reserve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('should show Cancel button when reserved', () => {
    render(
      <UserConcertCard
        concert={{ ...baseConcert, isReserved: true }}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reserve' })).not.toBeInTheDocument();
  });

  it('should call onReserve when Reserve button is clicked', async () => {
    const user = userEvent.setup();
    const onReserve = vi.fn();

    render(
      <UserConcertCard
        concert={baseConcert}
        onReserve={onReserve}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Reserve' }));
    expect(onReserve).toHaveBeenCalledWith(baseConcert);
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <UserConcertCard
        concert={{ ...baseConcert, isReserved: true }}
        onReserve={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledWith({ ...baseConcert, isReserved: true });
  });

  it('should disable button when isActionLoading is true', () => {
    render(
      <UserConcertCard
        concert={baseConcert}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
        isActionLoading={true}
      />
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Should not show "Reserve" text during loading
    expect(btn).not.toHaveTextContent('Reserve');
  });

  it('should format large seat numbers with commas', () => {
    render(
      <UserConcertCard
        concert={{ ...baseConcert, totalSeats: 10000, availableSeats: 5000 }}
        onReserve={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('/ 10,000')).toBeInTheDocument();
  });
});
