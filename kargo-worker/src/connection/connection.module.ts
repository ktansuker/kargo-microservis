/* eslint-disable */
import { Module } from '@nestjs/common';
import { CargoConnectionService } from './cargo-connection.service';

@Module({
  providers: [CargoConnectionService],
  exports: [CargoConnectionService],
})
export class ConnectionModule {}