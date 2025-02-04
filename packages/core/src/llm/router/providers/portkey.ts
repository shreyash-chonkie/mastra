import { createPortkey } from '@portkey-ai/vercel-provider';
import { ModelRouter } from '../router';

export class Portkey extends ModelRouter {
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
