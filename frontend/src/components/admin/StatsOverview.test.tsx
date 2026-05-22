import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsOverview } from '@/components/admin/StatsOverview';

describe('StatsOverview', () => {
  it('should render all three stat cards', () => {
    render(<StatsOverview totalSeats={1000} reserved={300} cancelled={50} />);

    expect(screen.getByText('Total of seats')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('should display correct values', () => {
    render(<StatsOverview totalSeats={1000} reserved={300} cancelled={50} />);

    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should have proper aria labels for accessibility', () => {
    render(<StatsOverview totalSeats={500} reserved={100} cancelled={20} />);

    expect(screen.getByRole('group', { name: 'Total of seats: 500' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Reserved: 100' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Cancelled: 20' })).toBeInTheDocument();
  });

  it('should handle zero values', () => {
    render(<StatsOverview totalSeats={0} reserved={0} cancelled={0} />);

    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3);
  });

  it('should format large numbers with commas', () => {
    render(<StatsOverview totalSeats={100000} reserved={50000} cancelled={10000} />);

    expect(screen.getByText('100,000')).toBeInTheDocument();
    expect(screen.getByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });
});
