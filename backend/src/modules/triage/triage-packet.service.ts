import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { TriageService } from './triage.service';
import { DivergenceComposite } from './entities/triage-event.entity';
import { TrajectoryPointDto } from '../trajectory/dto/trajectory-point.dto';
import { TriageEventDto } from './dto/triage-event.dto';

@Injectable()
export class TriagePacketService {
  constructor(private readonly triageService: TriageService) {}

  async renderPacket(userId: string, eventId: string): Promise<Buffer> {
    const event = await this.triageService.getEventDto(userId, eventId);
    return this.buildPdf(event);
  }

  private buildPdf(event: TriageEventDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 48,
        info: {
          Title: 'Second Voice triage packet',
          Author: 'Second Voice',
          Subject: 'Voice biomarker divergence summary',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.renderHeader(doc);
      this.renderEventSummary(doc, event);
      this.renderChart(doc, event);
      this.renderDimensionBreakdown(doc, event);
      this.renderInterpretation(doc, event);
      this.renderDisclaimer(doc);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#0f172a')
      .text('Second Voice triage packet', { align: 'left' });
    doc
      .moveDown(0.25)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#475569')
      .text(
        'A clinician-facing summary of a personal-baseline divergence detected from voice biomarkers.',
      );
    doc
      .moveTo(48, doc.y + 6)
      .lineTo(547, doc.y + 6)
      .strokeColor('#cbd5f5')
      .lineWidth(0.75)
      .stroke();
    doc.moveDown(1.2);
  }

  private renderEventSummary(
    doc: PDFKit.PDFDocument,
    event: TriageEventDto,
  ): void {
    const compositeLabel =
      event.composite === DivergenceComposite.PHQ9
        ? 'PHQ-9 (depression)'
        : 'GAD-7 (anxiety)';
    const triggeredAt = new Date(event.triggeredAt).toLocaleString('en-GB', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#0f172a')
      .text('Event summary');

    doc.moveDown(0.5).font('Helvetica').fontSize(10).fillColor('#1e293b');

    const rows: Array<[string, string]> = [
      ['Triggered at', triggeredAt],
      ['Composite', compositeLabel],
      ['Personal baseline mean', event.baselineMean.toFixed(3)],
      ['Personal baseline stddev', event.baselineStddev.toFixed(3)],
      ['Observed seven-day rolling avg', event.observedValue.toFixed(3)],
      [
        'Standard deviations from baseline',
        ((event.observedValue - event.baselineMean) / event.baselineStddev).toFixed(2),
      ],
    ];

    rows.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value);
    });

    doc.moveDown(0.7);
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('#334155')
      .text(event.triggerReason, { align: 'left' });
    doc.moveDown(0.8);
  }

  private renderChart(
    doc: PDFKit.PDFDocument,
    event: TriageEventDto,
  ): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#0f172a')
      .text('Trajectory');
    doc.moveDown(0.4);

    const points = event.trajectory;
    if (points.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('No trajectory data is available for this user yet.');
      return;
    }

    const chartLeft = 60;
    const chartTop = doc.y + 8;
    const chartWidth = 480;
    const chartHeight = 180;
    const chartRight = chartLeft + chartWidth;
    const chartBottom = chartTop + chartHeight;

    doc
      .lineWidth(0.5)
      .strokeColor('#cbd5f5')
      .rect(chartLeft, chartTop, chartWidth, chartHeight)
      .stroke();

    [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
      const y = chartBottom - tick * chartHeight;
      doc
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(chartLeft, y)
        .lineTo(chartRight, y)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(tick.toFixed(2), chartLeft - 28, y - 4, { width: 24, align: 'right' });
    });

    const xStep =
      points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;

    const drawSeries = (
      accessor: (p: TrajectoryPointDto) => number | null,
      colour: string,
    ) => {
      doc.strokeColor(colour).lineWidth(1.4);
      let started = false;
      points.forEach((point, idx) => {
        const value = accessor(point);
        if (typeof value !== 'number') return;
        const x = chartLeft + idx * xStep;
        const y = chartBottom - Math.max(0, Math.min(1, value)) * chartHeight;
        if (!started) {
          doc.moveTo(x, y);
          started = true;
        } else {
          doc.lineTo(x, y);
        }
      });
      doc.stroke();
    };

    drawSeries((p) => p.phq9Composite, '#1d4ed8');
    drawSeries((p) => p.gad7Composite, '#0d9488');

    points.forEach((point, idx) => {
      if (!point.triggeredDivergence) return;
      const value =
        event.composite === DivergenceComposite.PHQ9
          ? point.phq9Composite
          : point.gad7Composite;
      if (typeof value !== 'number') return;
      const x = chartLeft + idx * xStep;
      const y = chartBottom - Math.max(0, Math.min(1, value)) * chartHeight;
      doc
        .fillColor('#dc2626')
        .circle(x, y, 3.2)
        .fill();
    });

    doc.y = chartBottom + 16;

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#1d4ed8')
      .text('PHQ-9 composite', chartLeft, doc.y, { continued: true })
      .fillColor('#475569')
      .text('   ')
      .fillColor('#0d9488')
      .text('GAD-7 composite', { continued: true })
      .fillColor('#475569')
      .text('   ')
      .fillColor('#dc2626')
      .text('Divergence event');

    doc.moveDown(1);
  }

  /**
   * Per-dimension biomarker breakdown for the triggering check-in. Renders
   * the 8 + 7 + 5 Apollo/Helios scores as small bars so the clinician can
   * see *which* facets drove the composite shift, not just the aggregate.
   */
  private renderDimensionBreakdown(
    doc: PDFKit.PDFDocument,
    event: TriageEventDto,
  ): void {
    const triggeringPoint = event.trajectory.find(
      (p) => p.checkinId === event.triggeringCheckinId,
    );
    const biomarkers =
      triggeringPoint?.biomarkers ??
      event.trajectory[event.trajectory.length - 1]?.biomarkers ??
      null;
    if (!biomarkers) return;

    if (doc.y > 640) doc.addPage();

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#0f172a')
      .text('Per-dimension biomarker breakdown');

    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        'Apollo (depression + anxiety) and Helios (wellness) facet scores ' +
          'on the triggering check-in. All values are 0-1; higher means more ' +
          'evidence for that facet in the voice signal.',
        { align: 'left' },
      );
    doc.moveDown(0.6);

    type Group = {
      title: string;
      colour: string;
      rows: Array<{ label: string; value: number | null }>;
    };

    const groups: Group[] = [
      {
        title: 'Apollo · depression (PHQ-9 aligned)',
        colour: '#1d4ed8',
        rows: [
          { label: 'Anhedonia', value: biomarkers.anhedonia },
          { label: 'Low mood', value: biomarkers.lowMood },
          { label: 'Sleep issues', value: biomarkers.sleepIssues },
          { label: 'Low energy', value: biomarkers.lowEnergy },
          { label: 'Appetite', value: biomarkers.appetite },
          { label: 'Worthlessness', value: biomarkers.worthlessness },
          { label: 'Concentration', value: biomarkers.concentration },
          { label: 'Psychomotor', value: biomarkers.psychomotor },
        ],
      },
      {
        title: 'Apollo · anxiety (GAD-7 aligned)',
        colour: '#7c3aed',
        rows: [
          { label: 'Nervousness', value: biomarkers.nervousness },
          {
            label: 'Uncontrollable worry',
            value: biomarkers.uncontrollableWorry,
          },
          { label: 'Excessive worry', value: biomarkers.excessiveWorry },
          { label: 'Trouble relaxing', value: biomarkers.troubleRelaxing },
          { label: 'Restlessness', value: biomarkers.restlessness },
          { label: 'Irritability', value: biomarkers.irritability },
          { label: 'Dread', value: biomarkers.dread },
        ],
      },
      {
        title: 'Helios · wellness',
        colour: '#ea580c',
        rows: [
          { label: 'Distress', value: biomarkers.distress },
          { label: 'Stress', value: biomarkers.stress },
          { label: 'Burnout', value: biomarkers.burnout },
          { label: 'Fatigue', value: biomarkers.fatigue },
          { label: 'Low self-esteem', value: biomarkers.lowSelfEsteem },
        ],
      },
    ];

    const colWidth = 165;
    const colGap = 12;
    const startX = 48;
    const startY = doc.y;
    // Track the DEEPEST column across the whole row of columns. Using
    // `doc.y` for this fails because `text(s, x, y, ...)` resets the cursor
    // to the new (x, y) on every column header, so by the time the loop
    // ends doc.y reflects the *last* column rendered — which is often the
    // shortest (Helios has 5 rows vs depression's 8). We then end up
    // starting "Plain-language interpretation" partway up the deepest
    // column and the text overlaps the bar rows. Use an explicit max var.
    let deepestY = startY;

    groups.forEach((group, colIdx) => {
      const x = startX + colIdx * (colWidth + colGap);
      let y = startY;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(group.colour)
        .text(group.title, x, y, { width: colWidth });
      y = doc.y + 4;

      group.rows.forEach((row) => {
        const value = typeof row.value === 'number' ? row.value : null;
        const labelText = row.label;
        const valueText = value != null ? value.toFixed(2) : '—';

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#1e293b')
          .text(labelText, x, y, { width: colWidth - 28, lineBreak: false });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(value != null ? group.colour : '#94a3b8')
          .text(valueText, x + colWidth - 24, y, {
            width: 24,
            align: 'right',
          });

        const barTop = y + 11;
        const barWidth = colWidth;
        doc
          .roundedRect(x, barTop, barWidth, 3, 1.5)
          .fillColor('#e2e8f0')
          .fill();
        if (value != null) {
          const filled = Math.max(0, Math.min(1, value)) * barWidth;
          doc
            .roundedRect(x, barTop, filled, 3, 1.5)
            .fillColor(group.colour)
            .fill();
        }
        y = barTop + 9;
      });

      if (y > deepestY) deepestY = y;
    });

    // CRITICAL: PDFKit keeps the text cursor's x at wherever the last
    // `text(s, x, y, ...)` call left it. The final call in the column loop
    // parks x at the right edge of the third column (~543pt) with a
    // 24pt-wide writing box. If we don't reset, every subsequent
    // `doc.text()` in the document inherits that — so a paragraph wraps
    // one character per line. Reset both x and y to a sane page-margin
    // origin (and to the bottom of the DEEPEST column) before handing off
    // to the next section.
    doc.x = doc.page.margins.left;
    doc.y = deepestY + 12;
    doc.moveDown(0.4);
  }

  private renderInterpretation(
    doc: PDFKit.PDFDocument,
    event: TriageEventDto,
  ): void {
    const compositeName =
      event.composite === DivergenceComposite.PHQ9
        ? 'depression-aligned'
        : 'anxiety-aligned';

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#0f172a')
      .text('Plain-language interpretation');

    doc
      .moveDown(0.4)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#1e293b')
      .text(
        `This patient has been recording a 60-second voice check-in once per day. ` +
          `Voice features ${compositeName} on the Apollo dimension set have moved ` +
          `meaningfully above the patient's own established baseline over the past ` +
          `seven days. The change exceeds two standard deviations of the patient's ` +
          `personal stable baseline, the threshold the system uses to flag a ` +
          `clinically interesting divergence.`,
        { align: 'justify' },
      );

    doc
      .moveDown(0.5)
      .text(
        'A divergence event suggests the patient may benefit from a re-prioritisation ' +
          'review on the NHS mental health waiting list, or from a brief check-in ' +
          'conversation with their GP. This packet is intended to support that ' +
          'conversation, not replace it.',
        { align: 'justify' },
      );

    doc.moveDown(0.8);
  }

  private renderDisclaimer(doc: PDFKit.PDFDocument): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#7c2d12')
      .text('Important');

    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#7c2d12')
      .text(
        'Voice biomarkers are a screening signal, not a diagnosis. A divergence event ' +
          'is a suggestion to the clinician, not an assertion against the clinician. ' +
          'The patient owns their data and generated this packet at their own request.',
        { align: 'justify' },
      );
  }
}
