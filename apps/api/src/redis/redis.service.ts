import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { appEnv } from '../env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(appEnv.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async ping(): Promise<string> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    return this.client.ping();
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
