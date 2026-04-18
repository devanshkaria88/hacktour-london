import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { CheckinEntity } from '../../checkins/entities/checkin.entity';

export enum DivergenceComposite {
  PHQ9 = 'phq9',
  GAD7 = 'gad7',
}

@Entity({ name: 'triage_events' })
@Index(['userId', 'triggeredAt'])
export class TriageEventEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.triageEvents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'timestamptz', name: 'triggered_at' })
  triggeredAt!: Date;

  @Column({ type: 'text', name: 'trigger_reason' })
  triggerReason!: string;

  @Column({
    type: 'enum',
    enum: DivergenceComposite,
    name: 'composite',
  })
  composite!: DivergenceComposite;

  @Column({ type: 'uuid', name: 'triggering_checkin_id' })
  triggeringCheckinId!: string;

  @ManyToOne(() => CheckinEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'triggering_checkin_id' })
  triggeringCheckin!: CheckinEntity;

  @Column({ type: 'float', name: 'baseline_mean' })
  baselineMean!: number;

  @Column({ type: 'float', name: 'baseline_stddev' })
  baselineStddev!: number;

  @Column({ type: 'float', name: 'observed_value' })
  observedValue!: number;
}
