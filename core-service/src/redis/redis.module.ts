import { Module, Global } from '@nestjs/common';
import { SeatCounterService } from './seat-counter.service';

@Global()
@Module({
  providers: [SeatCounterService],
  exports: [SeatCounterService],
})
export class RedisModule {}
