import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaService } from './kafka.service';
import { ReservationProcessorService } from './reservation-processor.service';
import { Reservation } from '../entities/reservation.entity';
import { Concert } from '../entities/concert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Concert])],
  providers: [KafkaService, ReservationProcessorService],
  exports: [KafkaService],
})
export class KafkaModule {}
