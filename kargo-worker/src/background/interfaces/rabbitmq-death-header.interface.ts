/* eslint-disable */
export interface RabbitMqDeathHeader {
  count: number;
  reason: string;
  queue: string;
  exchange: string;
  'routing-keys': string[];
}