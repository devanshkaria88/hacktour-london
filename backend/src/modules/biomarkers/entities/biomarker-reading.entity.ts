import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CheckinEntity } from '../../checkins/entities/checkin.entity';

@Entity({ name: 'biomarker_readings' })
export class BiomarkerReadingEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'checkin_id', unique: true })
  checkinId!: string;

  @OneToOne(() => CheckinEntity, (checkin) => checkin.biomarkerReading, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'checkin_id' })
  checkin!: CheckinEntity;

  // --- Apollo depression dimensions (PHQ-9 aligned) ---
  @Column({ type: 'float', nullable: true })
  anhedonia!: number | null;

  @Column({ type: 'float', name: 'low_mood', nullable: true })
  lowMood!: number | null;

  @Column({ type: 'float', name: 'sleep_issues', nullable: true })
  sleepIssues!: number | null;

  @Column({ type: 'float', name: 'low_energy', nullable: true })
  lowEnergy!: number | null;

  @Column({ type: 'float', nullable: true })
  appetite!: number | null;

  @Column({ type: 'float', nullable: true })
  worthlessness!: number | null;

  @Column({ type: 'float', nullable: true })
  concentration!: number | null;

  @Column({ type: 'float', nullable: true })
  psychomotor!: number | null;

  // --- Apollo anxiety dimensions (GAD-7 aligned) ---
  @Column({ type: 'float', nullable: true })
  nervousness!: number | null;

  @Column({ type: 'float', name: 'uncontrollable_worry', nullable: true })
  uncontrollableWorry!: number | null;

  @Column({ type: 'float', name: 'excessive_worry', nullable: true })
  excessiveWorry!: number | null;

  @Column({ type: 'float', name: 'trouble_relaxing', nullable: true })
  troubleRelaxing!: number | null;

  @Column({ type: 'float', nullable: true })
  restlessness!: number | null;

  @Column({ type: 'float', nullable: true })
  irritability!: number | null;

  @Column({ type: 'float', nullable: true })
  dread!: number | null;

  // --- Helios wellness dimensions ---
  @Column({ type: 'float', nullable: true })
  distress!: number | null;

  @Column({ type: 'float', nullable: true })
  stress!: number | null;

  @Column({ type: 'float', nullable: true })
  burnout!: number | null;

  @Column({ type: 'float', nullable: true })
  fatigue!: number | null;

  @Column({ type: 'float', name: 'low_self_esteem', nullable: true })
  lowSelfEsteem!: number | null;

  // --- Composites computed at insert time ---
  @Column({ type: 'float', name: 'phq9_composite', nullable: true })
  phq9Composite!: number | null;

  @Column({ type: 'float', name: 'gad7_composite', nullable: true })
  gad7Composite!: number | null;
}
