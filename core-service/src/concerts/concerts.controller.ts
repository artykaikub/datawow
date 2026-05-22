import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Concerts')
@ApiBearerAuth('JWT')
@Controller('concerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  /**
   * POST /concerts — Create a new concert (Admin only)
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a concert (Admin)', description: 'Creates a new concert listing with name, description, and total seats.' })
  @ApiResponse({ status: 201, description: 'Concert created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  create(
    @Body() dto: CreateConcertDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.concertsService.create(dto, user.id);
  }

  /**
   * GET /concerts — List all concerts with stats
   * NOTE: Both admin and user can access this.
   */
  @Get()
  @ApiOperation({ summary: 'List all concerts', description: 'Returns all concerts with reservation stats (reserved, cancelled, available seats). Cached in Redis (30s TTL).' })
  @ApiResponse({ status: 200, description: 'List of concerts with stats.' })
  findAll() {
    return this.concertsService.findAll();
  }

  /**
   * GET /concerts/:id — Get single concert
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single concert', description: 'Returns concert details by UUID.' })
  @ApiParam({ name: 'id', description: 'Concert UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: 'Concert details.' })
  @ApiResponse({ status: 404, description: 'Concert not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.concertsService.findOne(id);
  }

  /**
   * DELETE /concerts/:id — Delete a concert (Admin only)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a concert (Admin)', description: 'Deletes a concert and cascades to all its reservations.' })
  @ApiParam({ name: 'id', description: 'Concert UUID' })
  @ApiResponse({ status: 204, description: 'Concert deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  @ApiResponse({ status: 404, description: 'Concert not found.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.concertsService.remove(id, user.id);
  }
}
