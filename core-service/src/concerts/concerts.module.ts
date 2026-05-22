import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from '../entities/concert.entity';
import { Reservation } from '../entities/reservation.entity';
import { ConcertsService } from './concerts.service';
import { ConcertsController } from './concerts.controller';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, Reservation]),
    KafkaModule,
  ],
  controllers: [ConcertsController],
  providers: [ConcertsService],
  exports: [ConcertsService],
})
export class ConcertsModule {}
