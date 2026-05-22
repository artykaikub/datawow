import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { PendingCleanupService } from './pending-cleanup.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Concert]), KafkaModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, PendingCleanupService],
})
export class ReservationsModule {}
