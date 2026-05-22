import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Reservations')
@ApiBearerAuth('JWT')
@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  /**
   * POST /reservations/:concertId — Reserve a seat (User only)
   * Rate limited: 5 attempts per 60 seconds to prevent abuse.
   */
  @Post(':concertId')
  @Roles(UserRole.USER)
  @Throttle({ short: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Reserve a seat (User)',
    description:
      'Reserves a seat for the authenticated user. ' +
      'With Kafka enabled: returns 202 Accepted (status: PENDING, processed async). ' +
      'Without Kafka: returns 201 Created (status: RESERVED, processed sync). ' +
      'Rate limited to 5 attempts per minute.',
  })
  @ApiParam({ name: 'concertId', description: 'Concert UUID' })
  @ApiResponse({ status: 201, description: 'Reservation created (sync mode).' })
  @ApiResponse({ status: 202, description: 'Reservation pending (Kafka async mode).' })
  @ApiResponse({ status: 400, description: 'No seats available.' })
  @ApiResponse({ status: 403, description: 'Forbidden — User role required.' })
  @ApiResponse({ status: 404, description: 'Concert not found.' })
  @ApiResponse({ status: 409, description: 'Already reserved or pending for this concert.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 req/min).' })
  reserve(
    @CurrentUser() user: { id: string },
    @Param('concertId', ParseUUIDPipe) concertId: string,
  ) {
    return this.reservationsService.reserve(user.id, concertId);
  }

  /**
   * DELETE /reservations/:concertId — Cancel a reservation (User only)
   */
  @Delete(':concertId')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Cancel a reservation (User)', description: 'Cancels an active reservation for the specified concert.' })
  @ApiParam({ name: 'concertId', description: 'Concert UUID' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden — User role required.' })
  @ApiResponse({ status: 404, description: 'No active reservation found.' })
  cancel(
    @CurrentUser() user: { id: string },
    @Param('concertId', ParseUUIDPipe) concertId: string,
  ) {
    return this.reservationsService.cancel(user.id, concertId);
  }

  /**
   * GET /reservations — Get all reservation history (Admin only)
   * Supports pagination (?page=1&limit=20) and filtering (?status=reserved&search=email)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'All reservation history (Admin)', description: 'Paginated reservation history with optional status filter and user search.' })
  @ApiResponse({ status: 200, description: 'Paginated reservation history.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  getAllHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.reservationsService.getAllHistory({
      page: Math.max(1, parseInt(page || '1', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20)),
      status: status || undefined,
      search: search || undefined,
    });
  }

  /**
   * GET /reservations/me — Get my reservation history (User only)
   */
  @Get('me')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'My reservation history (User)', description: 'Returns the authenticated user\'s reservation history with statuses (PENDING, RESERVED, REJECTED, CANCELLED).' })
  @ApiResponse({ status: 200, description: 'User reservation history.' })
  @ApiResponse({ status: 403, description: 'Forbidden — User role required.' })
  getMyHistory(@CurrentUser() user: { id: string }) {
    return this.reservationsService.getMyHistory(user.id);
  }
}
