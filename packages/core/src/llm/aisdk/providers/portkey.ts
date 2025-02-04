import { createPortkey } from '@portkey-ai/vercel-provider';

import { AISDK } from '../aisdk';

export class Portkey extends AISDK {
    constructor({
        portkeyApiKey,
        portkeyConfig,
    }: {
        portkeyApiKey: string;
        portkeyConfig: {
            provider: string;
            api_key: string;
            override_params: {
                model: string;
            };
        };
    }) {
        const portkey = createPortkey({
            apiKey: portkeyApiKey,
            config: portkeyConfig,
        });

        super({ model: portkey.chatModel('') });
    }
}
