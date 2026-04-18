import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CheckinEntity } from '../../checkins/entities/checkin.entity';
import { TriageEventEntity } from '../../triage/entities/triage-event.entity';

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Index('UQ_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120, name: 'display_name' })
  displayName!: string;

  @OneToMany(() => CheckinEntity, (checkin) => checkin.user)
  checkins!: CheckinEntity[];

  @OneToMany(() => TriageEventEntity, (event) => event.user)
  triageEvents!: TriageEventEntity[];
}
