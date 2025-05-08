import { createLogger, LogLevel, BaseLogMessage } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as redis from 'redis';

import { RedisCloudTransport } from './index.js';

// Create reusable mock objects
const createMultiMock = () => ({
  lPush: vi.fn().mockReturnThis(),
  lTrim: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
});

const createClientMock = () => {
  const multiMock = createMultiMock();
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    isOpen: true,
    multi: vi.fn().mockReturnValue(multiMock),
    quit: vi.fn().mockResolvedValue(undefined),
    lRange: vi.fn().mockResolvedValue([]),
    _multiMock: multiMock, // Store the multi mock for easy access
  };
};

// Mock the redis module
vi.mock('redis', () => {
  return {
    createClient: vi.fn(),
  };
});

describe('RedisCloudTransport', () => {
  const defaultOptions = {
    redisUrl: 'redis://localhost:6379',
    listName: 'test-logs',
    maxListLength: 1000,
    batchSize: 10,
    flushInterval: 1000,
    ttl: 172800, // 2 days
  };

  let transport: RedisCloudTransport;
  let clientMock: any;
  let multiMock: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Create a fresh client mock for each test
    clientMock = createClientMock();
    (redis.createClient as any).mockReturnValue(clientMock);
    multiMock = clientMock._multiMock;

    // Create a fresh transport instance for each test
    transport = new RedisCloudTransport(defaultOptions);
  });

  afterEach(() => {
    // Clean up after each test
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.useRealTimers();

    // Reset spies that might have been created
    vi.restoreAllMocks();
  });

  it('should initialize with correct options', () => {
    expect(transport.redisUrl).toBe(defaultOptions.redisUrl);
    expect(transport.listName).toBe(defaultOptions.listName);
    expect(transport.maxListLength).toBe(defaultOptions.maxListLength);
    expect(transport.batchSize).toBe(defaultOptions.batchSize);
    expect(transport.flushInterval).toBe(defaultOptions.flushInterval);
    expect(transport.ttl).toBe(defaultOptions.ttl);
    expect(transport.logBuffer).toEqual([]);
    expect(redis.createClient).toHaveBeenCalledWith({
      url: defaultOptions.redisUrl,
      socket: expect.any(Object),
    });
  });

  it('should throw error if redisUrl is not provided', () => {
    expect(() => new RedisCloudTransport({} as any)).toThrow('Redis URL is required');
  });

  it('should use default values when options are not provided', () => {
    const minimalTransport = new RedisCloudTransport({
      redisUrl: 'redis://localhost:6379',
    });

    expect(minimalTransport.listName).toBe('application-logs');
    expect(minimalTransport.maxListLength).toBe(10000);
    expect(minimalTransport.batchSize).toBe(100);
    expect(minimalTransport.flushInterval).toBe(10000);
    expect(minimalTransport.ttl).toBe(172800); // 2 days
  });

  it('should work with createLogger', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        redisCloud: transport,
      },
    });

    const testMessage = 'test info message';
    logger.info(testMessage);

    // Replace nextTick with explicit mock implementation
    const nextTickSpy = vi.spyOn(process, 'nextTick').mockImplementation(cb => {
      cb();
      return undefined as any;
    });

    // Trigger flush
    await transport._flush();

    // Verify the multi commands were called in sequence
    expect(clientMock.multi).toHaveBeenCalled();
    expect(multiMock.lPush).toHaveBeenCalledWith(defaultOptions.listName, expect.any(Array));
    expect(multiMock.exec).toHaveBeenCalled();

    // Clean up the spy
    nextTickSpy.mockRestore();
  });

  it('should handle multiple log messages', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        redisCloud: transport,
      },
    });

    const messages = ['message1', 'message2', 'message3'];
    messages.forEach(msg => logger.info(msg));

    // Replace nextTick with explicit mock implementation
    const nextTickSpy = vi.spyOn(process, 'nextTick').mockImplementation(cb => {
      cb();
      return undefined as any;
    });

    // Trigger flush
    await transport._flush();

    expect(multiMock.lPush).toHaveBeenCalledWith(defaultOptions.listName, expect.any(Array));

    // Clean up the spy
    nextTickSpy.mockRestore();
  });

  it('should connect to Redis if not connected during flush', async () => {
    // Set client to disconnected for this test only
    clientMock.isOpen = false;

    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        redisCloud: transport,
      },
    });

    logger.info('test message');

    // Replace nextTick with explicit mock implementation
    const nextTickSpy = vi.spyOn(process, 'nextTick').mockImplementation(cb => {
      cb();
      return undefined as any;
    });

    // Trigger flush
    await transport._flush();

    expect(clientMock.connect).toHaveBeenCalled();

    // Clean up the spy
    nextTickSpy.mockRestore();
  });

  it('should properly clean up resources on destroy', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const flushSpy = vi.spyOn(transport, '_flush').mockImplementation(() => Promise.resolve());

    // Set up logBuffer to test final flush
    transport.logBuffer = [{ msg: 'test message' }];

    // Use callback with a Promise wrapper to handle async destroy
    await new Promise<void>(resolve => {
      transport._destroy(new Error('test error'), () => {
        resolve();
      });
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(flushSpy).toHaveBeenCalled();
    expect(clientMock.quit).toHaveBeenCalled();
  });

  it('should handle errors in _transform', () => {
    // Create a fresh callback spy for this test
    const callback = vi.fn();

    // This should cause a JSON.parse error
    transport._transform('invalid json', 'utf8', callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should automatically flush on interval', async () => {
    const logger = createLogger({
      name: 'test-logger',
      level: LogLevel.INFO,
      transports: {
        redisCloud: transport,
      },
    });

    logger.info('test message');

    // Create a clean spy for this test
    const flushSpy = vi.spyOn(transport, '_flush').mockImplementation(() => Promise.resolve());

    // Advance timer by flush interval
    vi.advanceTimersByTime(defaultOptions.flushInterval);
    await Promise.resolve();

    expect(flushSpy).toHaveBeenCalled();
  });

  it('should flush when buffer reaches batch size', async () => {
    const flushSpy = vi.spyOn(transport, '_flush').mockImplementation(() => Promise.resolve());

    // Fill buffer up to batch size
    for (let i = 0; i < defaultOptions.batchSize; i++) {
      transport._transform(JSON.stringify({ msg: `test ${i}` }), 'utf8', () => {});
    }

    expect(flushSpy).toHaveBeenCalled();
  });

  describe('error handling', () => {
    it('should handle Redis errors during connection', async () => {
      // Set up mocks specific to this test
      clientMock.connect.mockRejectedValueOnce(new Error('Connection error'));
      clientMock.isOpen = false;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const logger = createLogger({
        name: 'test-logger',
        level: LogLevel.INFO,
        transports: {
          redisCloud: transport,
        },
      });

      logger.info('test message');

      // Replace nextTick with explicit mock implementation
      const nextTickSpy = vi.spyOn(process, 'nextTick').mockImplementation(cb => {
        cb();
        return undefined as any;
      });

      // Trigger flush
      await transport._flush();

      expect(consoleSpy).toHaveBeenCalledWith('Redis connection error:', expect.any(Error));

      // Clean up
      nextTickSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('getLogs and getLogsByRunId', () => {
    it('should return parsed logs from Redis', async () => {
      const mockLogs = [
        JSON.stringify({ msg: 'log1', time: Date.now(), runId: 'run1' }),
        JSON.stringify({ msg: 'log2', time: Date.now(), runId: 'run2' }),
      ];

      // Set up mock for this specific test
      clientMock.lRange.mockReset();
      clientMock.lRange.mockResolvedValueOnce(mockLogs);

      const logs = await transport.getLogs();

      expect(clientMock.lRange).toHaveBeenCalledWith(defaultOptions.listName, 0, -1);
      expect(logs).toHaveLength(2);
      expect(logs[0].msg).toBe('log1');
      expect(logs[1].msg).toBe('log2');
    });

    it('should handle invalid JSON in Redis logs', async () => {
      const mockLogs = [JSON.stringify({ msg: 'valid', runId: 'run1' }), 'invalid json'];

      // Set up mock specific to this test
      clientMock.lRange.mockReset();
      clientMock.lRange.mockResolvedValueOnce(mockLogs);

      const logs = await transport.getLogs();

      expect(logs).toHaveLength(2);
      expect(logs[0].msg).toBe('valid');
      expect(logs[1]).toBe('');
    });

    it('should filter logs by runId', async () => {
      const mockLogs = [
        { msg: 'log1', runId: 'run1' },
        { msg: 'log2', runId: 'run2' },
        { msg: 'log3', runId: 'run1' },
      ] as BaseLogMessage[];

      // Use direct mock implementation instead of spying
      const originalGetLogs = transport.getLogs;
      transport.getLogs = vi.fn().mockResolvedValueOnce(mockLogs);

      const logs = await transport.getLogsByRunId({ runId: 'run1' });

      expect(logs).toHaveLength(2);
      expect(logs[0].msg).toBe('log1');
      expect(logs[1].msg).toBe('log3');

      // Restore original method
      transport.getLogs = originalGetLogs;
    });

    it('should handle errors when getting logs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Set up mock specific to this test
      clientMock.lRange.mockReset();
      clientMock.lRange.mockRejectedValueOnce(new Error('Redis error'));

      const logs = await transport.getLogs();

      expect(consoleSpy).toHaveBeenCalledWith('Error getting logs from Redis:', expect.any(Error));
      expect(logs).toEqual([]);

      // Clean up
      consoleSpy.mockRestore();
    });

    it('should handle errors when getting logs by runId', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Use direct mock implementation
      const originalGetLogs = transport.getLogs;
      transport.getLogs = vi.fn().mockRejectedValueOnce(new Error('Redis error'));

      const logs = await transport.getLogsByRunId({ runId: 'run1' });

      expect(consoleSpy).toHaveBeenCalledWith('Error getting logs by runId from Redis:', expect.any(Error));
      expect(logs).toEqual([]);

      // Restore original method
      transport.getLogs = originalGetLogs;
    });
  });
});
