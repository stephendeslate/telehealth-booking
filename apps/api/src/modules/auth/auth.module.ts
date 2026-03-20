import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { getJwtKeyPair } from './jwt-keys';
import { JobsModule } from '../../jobs/jobs.module';

@Module({
  imports: [
    JobsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      privateKey: getJwtKeyPair().privateKey,
      publicKey: getJwtKeyPair().publicKey,
      signOptions: {
        algorithm: 'RS256',
        issuer: 'medconnect',
      },
      verifyOptions: {
        algorithms: ['RS256'],
        issuer: 'medconnect',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
