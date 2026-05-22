import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Concert } from './concert.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('reservations')
@Index('IDX_reservations_concert_status', ['concertId', 'status'])
@Index('IDX_reservations_user', ['userId'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'concert_id' })
  concertId: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({ name: 'rejected_reason', type: 'varchar', nullable: true })
  rejectedReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** B-L2: Track when status transitions occur (e.g. PENDING → RESERVED) */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.reservations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Concert, (c) => c.reservations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;
}
