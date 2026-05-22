import { IsNotEmpty, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConcertDto {
  @ApiProperty({ example: 'Summer Music Festival', description: 'Concert name' })
  @IsString()
  @IsNotEmpty({ message: 'Concert name is required' })
  name: string;

  @ApiProperty({ example: 'An amazing outdoor concert experience', description: 'Concert description' })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({ example: 500, minimum: 1, description: 'Total available seats' })
  @IsInt({ message: 'Total seats must be an integer' })
  @Min(1, { message: 'Total seats must be at least 1' })
  @Max(100_000, { message: 'Total seats cannot exceed 100,000' })
  totalSeats: number;
}
