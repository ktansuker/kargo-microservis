/* eslint-disable */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  transactionId!: string;

  @Column()
  cargoProviderCode!: string;

  @Column()
  consignmentNo!: string;

  @Column({ default: 'Bekliyor' })
  status!: string; // Bekliyor, Başarılı, Hatalı

  @Column({ type: 'text', nullable: true })
  errorMessage?: string; // nullable olduğu için soru işareti koyabiliriz

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}