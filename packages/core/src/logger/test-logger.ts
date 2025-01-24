import { Logger } from './logger';

// Set up logging
Logger.defaults.pretty = true;

const logger = Logger.root.child({
  level: 'trace',
  name: 'app',
});

logger.info('Hello, world!');
