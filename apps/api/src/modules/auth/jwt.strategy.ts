import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtKeyPair } from './jwt-keys';
import type { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: getJwtKeyPair().publicKey,
      algorithms: ['RS256'],
      issuer: 'medconnect',
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
