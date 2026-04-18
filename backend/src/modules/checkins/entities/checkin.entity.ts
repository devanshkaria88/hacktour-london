import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { BiomarkerReadingEntity } from '../../biomarkers/entities/biomarker-reading.entity';

@Entity({ name: 'checkins' })
@Index(['userId', 'recordedAt'])
export class CheckinEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.checkins, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt!: Date;

  @Column({ type: 'text', nullable: true })
  transcript!: string | null;

  @Column({ type: 'integer', name: 'audio_duration_sec', default: 0 })
  audioDurationSec!: number;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'audio_storage_path',
    nullable: true,
  })
  audioStoragePath!: string | null;

  @Column({ type: 'integer', name: 'self_rating', nullable: true })
  selfRating!: number | null;

  @OneToOne(() => BiomarkerReadingEntity, (reading) => reading.checkin)
  biomarkerReading!: BiomarkerReadingEntity | null;
}
