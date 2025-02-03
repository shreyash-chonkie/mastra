import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

import { AISDK } from '../aisdk';

export class AmazonBedrock extends AISDK {
  constructor({
    name = 'amazon-titan-tg1-large',
    region = process.env.AWS_REGION || '',
    accessKeyId = process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken = process.env.AWS_SESSION_TOKEN || '',
  }: {
    name?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  }) {
    const amazon = createAmazonBedrock({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    super({ model: amazon(name) });
  }
}
