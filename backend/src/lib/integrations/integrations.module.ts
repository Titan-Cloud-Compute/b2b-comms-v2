import { Global, Module } from '@nestjs/common';
import { LiteLLMService } from './litellm.service';
import { MinioService } from './minio.service';
import { TwilioService } from './twilio.service';

@Global()
@Module({
  providers: [LiteLLMService, MinioService, TwilioService],
  exports: [LiteLLMService, MinioService, TwilioService],
})
export class IntegrationsModule {}
