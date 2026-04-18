import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';
import {
  AnalysisResultDto,
  BiomarkersDto,
} from './dto/analysis-result.dto';
import {
  APOLLO_ANXIETY_DIMENSIONS,
  APOLLO_DEPRESSION_DIMENSIONS,
  HELIOS_WELLNESS_DIMENSIONS,
} from '../../common/constants';

@Injectable()
export class VoiceServiceClient {
  private readonly logger = new Logger(VoiceServiceClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('VOICE_SERVICE_URL') ?? '';
    this.enabled = Boolean(this.baseUrl);
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 90_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  async analyzeAudio(filePath: string): Promise<AnalysisResultDto> {
    if (!this.enabled) {
      this.logger.warn(
        'VOICE_SERVICE_URL is not configured; returning stubbed analysis.',
      );
      return this.stub();
    }

    try {
      const form = new FormData();
      const stats = statSync(filePath);
      form.append('audio', createReadStream(filePath), {
        filename: basename(filePath),
        knownLength: stats.size,
      });

      const response = await this.http.post<AnalysisResultDto>(
        '/analyze',
        form,
        {
          headers: form.getHeaders(),
        },
      );

      return this.normalise(response.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown voice service error';
      this.logger.error(`Voice service call failed: ${message}`);
      return { transcript: null, biomarkers: null };
    }
  }

  /**
   * Deterministic stub used when the Python sidecar is unreachable. Returns a
   * mildly elevated reading so the divergence detector has something to react
   * to during local development.
   */
  private stub(): AnalysisResultDto {
    const baseline = 0.55;
    const jitter = (seed: number) =>
      Math.max(0, Math.min(1, baseline + (Math.sin(seed) + 1) * 0.1));

    const biomarkers = {} as Record<string, number | null>;
    [
      ...APOLLO_DEPRESSION_DIMENSIONS,
      ...APOLLO_ANXIETY_DIMENSIONS,
      ...HELIOS_WELLNESS_DIMENSIONS,
    ].forEach((key, idx) => {
      biomarkers[key] = jitter(idx + 1);
    });

    return {
      transcript:
        '[stubbed transcript] The user spoke for approximately one minute about their week.',
      biomarkers: biomarkers as unknown as BiomarkersDto,
    };
  }

  /**
   * Coerces a permissive sidecar response into the exact DTO shape, filling
   * absent dimensions with null so the persistence layer never sees undefined.
   */
  private normalise(raw: AnalysisResultDto): AnalysisResultDto {
    const incoming = (raw.biomarkers ?? {}) as Record<string, unknown>;
    const biomarkers = {} as Record<string, number | null>;
    [
      ...APOLLO_DEPRESSION_DIMENSIONS,
      ...APOLLO_ANXIETY_DIMENSIONS,
      ...HELIOS_WELLNESS_DIMENSIONS,
    ].forEach((key) => {
      const value = incoming[key];
      biomarkers[key] =
        typeof value === 'number' && Number.isFinite(value) ? value : null;
    });

    return {
      transcript:
        typeof raw.transcript === 'string' && raw.transcript.length > 0
          ? raw.transcript
          : null,
      biomarkers: biomarkers as unknown as BiomarkersDto,
    };
  }
}
