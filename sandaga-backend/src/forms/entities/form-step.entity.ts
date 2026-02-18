import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/category.entity';
import { FormField } from './form-field.entity';

@Entity('form_steps')
export class FormStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, (category) => category.steps, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  category: Category;

  @Column()
  name: string;

  @Column()
  label: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'jsonb', nullable: true })
  info: any;

  @Column({ nullable: true })
  flow?: string;

  @OneToMany(() => FormField, (field) => field.step)
  fields: FormField[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
