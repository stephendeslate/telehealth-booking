import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { AvailabilityService } from './availability.service';
import { ProvidersController, InvitationsController } from './providers.controller';

@Module({
  controllers: [ProvidersController, InvitationsController],
  providers: [ProvidersService, AvailabilityService],
  exports: [ProvidersService, AvailabilityService],
})
export class ProvidersModule {}
