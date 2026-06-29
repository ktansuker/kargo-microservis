/* eslint-disable */
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  
  // Worker projemizin ayakta olup olmadığını test etmek için basit bir uç
  @Get()
  healthCheck(): string {
    return 'Kargo Worker (Job) başarıyla çalışıyor ve kuyruğu dinliyor!';
  }
}