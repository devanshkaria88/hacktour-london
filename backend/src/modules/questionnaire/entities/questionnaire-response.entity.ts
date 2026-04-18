import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { CheckinEntity } from '../../checkins/entities/checkin.entity';

export type QuestionnaireInstrumentDb = 'phq9' | 'gad7';

/**
 * One self-report answer captured during a voice check-in. Multiple rows
 * per check-in (we ask ~4 questions per session, drawn from PHQ-9 + GAD-7).
 *
 *   • `score` is the raw 0-3 PHQ/GAD response level.
 *   • `rawAnswer` is the verbatim user reply, kept for audit / re-scoring.
 *   • `instrument` lets us aggregate per-tool totals over a 14-day window.
 */
@Entity({ name: 'questionnaire_responses' })
@Index(['userId', 'askedAt'])
@Index(['userId', 'questionId', 'askedAt'])
export class QuestionnaireResponseEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'uuid', name: 'checkin_id', nullable: true })
  checkinId!: string | null;

  @ManyToOne(() => CheckinEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'checkin_id' })
  checkin!: CheckinEntity | null;

  /** PHQ-9 / GAD-7 item id, e.g. `phq9.3` or `gad7.5`. */
  @Column({ type: 'varchar', length: 32, name: 'question_id' })
  questionId!: string;

  @Column({ type: 'varchar', length: 8 })
  instrument!: QuestionnaireInstrumentDb;

  @Column({ type: 'smallint' })
  score!: number;

  @Column({ type: 'text', name: 'raw_answer', nullable: true })
  rawAnswer!: string | null;

  @Column({ type: 'timestamptz', name: 'asked_at' })
  askedAt!: Date;
}
