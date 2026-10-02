import { Injectable, Logger } from '@nestjs/common';
import twilio, { Twilio, validateRequest } from 'twilio';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { isUnconfigured, resolveConfig } from '../config';
import { ServiceUnconfiguredError } from '../../common/errors/service-unconfigured.error';

const SERVICE = 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger('TwilioService');
  private cachedClient: Twilio | null = null;
  private cachedSignature = '';

  constructor(private readonly prisma: PrismaService) {}

  private async getCredentials(): Promise<{
    sid: string;
    token: string;
    from: string;
  }> {
    const sid = await resolveConfig(this.prisma, 'TWILIO_ACCOUNT_SID');
    const token = await resolveConfig(this.prisma, 'TWILIO_AUTH_TOKEN');
    const from = await resolveConfig(this.prisma, 'TWILIO_WHATSAPP_FROM');
    if (isUnconfigured(sid) || isUnconfigured(token) || isUnconfigured(from)) {
      throw new ServiceUnconfiguredError(
        SERVICE,
        'Twilio account SID / auth token / WhatsApp sender are not configured.',
      );
    }
    return { sid: sid!, token: token!, from: from! };
  }

  private async client(): Promise<{ client: Twilio; from: string; token: string }> {
    const { sid, token, from } = await this.getCredentials();
    const signature = `${sid}|${token}`;
    if (this.cachedClient && this.cachedSignature === signature) {
      return { client: this.cachedClient, from, token };
    }
    const client = twilio(sid, token);
    this.cachedClient = client;
    this.cachedSignature = signature;
    return { client, from, token };
  }

  /** Sends a WhatsApp message via Twilio's WhatsApp Business endpoint. */
  async sendWhatsApp(args: {
    to: string;
    body: string;
  }): Promise<{ messageSid: string }> {
    const { client, from } = await this.client();
    const message = await client.messages.create({
      body: args.body,
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to: args.to.startsWith('whatsapp:') ? args.to : `whatsapp:${args.to}`,
    });
    return { messageSid: message.sid };
  }

  /**
   * Verifies the X-Twilio-Signature on an inbound webhook request.
   *
   * Twilio computes the signature over the full URL plus the sorted body
   * params; if the request was rewritten by a proxy, set TWILIO_WEBHOOK_URL
   * to the canonical public URL.
   */
  async verifyWebhookSignature(req: Request): Promise<boolean> {
    const { token } = await this.client();
    const signature = req.header('x-twilio-signature') ?? '';
    const url =
      (await resolveConfig(this.prisma, 'TWILIO_WEBHOOK_URL')) ??
      `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const body = (req.body ?? {}) as Record<string, string>;
    try {
      return validateRequest(token, signature, url, body);
    } catch (err) {
      this.logger.warn(`Twilio signature validation threw: ${(err as Error).message}`);
      return false;
    }
  }
}
