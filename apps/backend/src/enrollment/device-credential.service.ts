import crypto from 'node:crypto';
import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DeviceTokenPayload {
  sub: string;
  deviceId: string;
  organizationId: string;
  branchId: string;
  agentInstanceId: string;
  iat: number;
  type: 'device';
}

@Injectable()
export class DeviceCredentialService {
  private readonly secret: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.secret =
      this.configService?.get<string>('DEVICE_TOKEN_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.DEVICE_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      'pharma-signal-default-device-credential-secret-key-32-chars-min';
  }

  /**
   * Generates a signed HS256 device token containing the canonical server-side
   * device identity, organization, branch, and agentInstanceId.
   */
  generateDeviceToken(payload: Omit<DeviceTokenPayload, 'iat' | 'type'>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const fullPayload: DeviceTokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      type: 'device'
    };

    const base64UrlHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64UrlPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${base64UrlHeader}.${base64UrlPayload}`)
      .digest('base64url');

    return `${base64UrlHeader}.${base64UrlPayload}.${signature}`;
  }

  /**
   * Verifies the signature and format of a device token using constant-time comparison.
   * Returns the decoded token payload claims.
   */
  verifyDeviceToken(token: string): DeviceTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Invalid device token format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid device token format');
    }

    const [headerB64, payloadB64, signature] = parts;
    if (!headerB64 || !payloadB64 || !signature) {
      throw new UnauthorizedException('Invalid device token format');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedSigBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      throw new UnauthorizedException('Invalid device token signature');
    }

    try {
      const payload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8')
      ) as DeviceTokenPayload;

      if (
        payload.type !== 'device' ||
        !payload.deviceId ||
        !payload.organizationId ||
        !payload.branchId
      ) {
        throw new UnauthorizedException('Invalid device token claims');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid device token payload');
    }
  }
}
