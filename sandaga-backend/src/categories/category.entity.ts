import { Column, Entity, OneToMany, ManyToOne, Tree, TreeChildren, TreeParent } from 'typeorm';
import { CoreEntity } from '../common/entities/base.entity';
import { Listing } from '../listings/listing.entity';
import { FormStep } from '../forms/entities/form-step.entity';

export type CategoryExtraField = 'surface' | 'rooms' | 'year' | 'mileage';
export type CategoryExtraFieldsPayload = CategoryExtraField[] | Record<string, unknown>;

@Entity({ name: 'categories' })
@Tree('closure-table')
export class Category extends CoreEntity {
  @Column({ unique: true })
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ nullable: true })
  color?: string;

  @Column({ nullable: true })
  gradient?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  extraFields!: CategoryExtraFieldsPayload;

  @OneToMany(() => Listing, listing => listing.category)
  listings!: Listing[];

  @OneToMany(() => FormStep, step => step.category)
  steps: FormStep[];

  @TreeChildren()
  children!: Category[];

  @TreeParent()
  parent!: Category;
}
