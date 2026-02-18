import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FormStep } from './form-step.entity';

@Entity('form_fields')
export class FormField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FormStep, (step) => step.fields, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  step: FormStep;

  @Column()
  name: string;

  @Column()
  label: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'jsonb', nullable: true })
  info: any;

  @Column({ type: 'jsonb', nullable: true })
  values: any;

  @Column({ type: 'jsonb', nullable: true })
  rules: any;

  @Column({ type: 'jsonb', nullable: true, name: 'modal_for_info' })
  modalForInfo: any;

  @Column({ type: 'jsonb', nullable: true, name: 'modals_for_info' })
  modalsForInfo: any;

  @Column({ name: 'default_checked', default: false })
  default_checked: boolean;

  @Column({ default: false })
  disabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
