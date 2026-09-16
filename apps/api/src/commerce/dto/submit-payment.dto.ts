import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@peytakilid/shared-types';

export class SubmitPaymentDto {
  @IsString()
  orderId!: string;

  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @IsIn(Object.values(PaymentMethod))
  method!: PaymentMethod;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  reference?: string | null;
}
