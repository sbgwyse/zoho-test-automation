// custom-report.ts

import type {
  Reporter,
  FullConfig,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';

import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';


interface StepRecord {
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}

interface AttachmentRecord {
  name: string;
  filePath: string;
}

interface ReportMeta {
  formTitle: string;
  websiteUrl: string;
  sourceType: string;
  sourceId: string;
  subject: string;
  description: string;
}

interface TestRecord {
  title: string;
  status: string;
  durationMs: number;
  steps: StepRecord[];
  attachments: AttachmentRecord[];
  reportMeta?: ReportMeta;
}


export default class CustomReport implements Reporter {

  private records: TestRecord[] = [];


  onTestEnd(test: TestCase, result: TestResult) {

    const steps: StepRecord[] = result.steps
      .filter(s => s.category === 'test.step')
      .map(s => ({
        title: s.title,
        status: s.error ? 'failed' : 'passed',
        durationMs: s.duration,
        error: s.error?.message,
      }));

    const attachments: AttachmentRecord[] = result.attachments
      .filter(a => a.contentType.startsWith('image/') && a.path)
      .map(a => ({
        name: a.name,
        filePath: a.path!,
      }));

    let reportMeta: ReportMeta | undefined;

    const metaAttachment = result.attachments.find(a => a.name === 'report-meta');

    if (metaAttachment?.body) {
      try {
        reportMeta = JSON.parse(metaAttachment.body.toString('utf-8'));
      } catch {
        // ignore malformed meta
      }
    }

    this.records.push({
      title: test.title,
      status: result.status,
      durationMs: result.duration,
      steps,
      attachments,
      reportMeta,
    });

  }


  async onEnd(result: FullResult) {

    if (this.records.length === 0) return;

    const outDir = 'test-results';

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const date = new Date();

    const fileDate = [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('-');

    // BUG FIX: previously generatePDF() was called twice before
    // generateExcel() — each report is now generated exactly once.
    await this.generatePDF(this.records, date, outDir, fileDate);
    await this.generateExcel(this.records, date, outDir, fileDate);
  }


  private generatePDF(
    records: TestRecord[],
    date: Date,
    outDir: string,
    fileDate: string
  ): Promise<void> {

    return new Promise((resolve, reject) => {

      const filePath = path.join(outDir, `report-${fileDate}.pdf`);
      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(18).text('Automation Test Report', { align: 'center' });
      doc.fontSize(10).fillColor('gray').text(date.toString(), { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(1.5);

      records.forEach((record, idx) => {

        if (idx > 0) doc.addPage();

        const meta = record.reportMeta;

        doc.fontSize(14).text(meta?.formTitle || record.title, { underline: true });

        if (meta) {
          doc.fontSize(9).fillColor('gray');
          doc.text(`Website: ${meta.websiteUrl}`);
          doc.text(`Source: ${meta.sourceType} #${meta.sourceId}`);
          doc.text(`Subject: ${meta.subject}`);
          doc.fillColor('black');
        }

        doc.moveDown(0.4);

        doc.fontSize(11)
          .fillColor(record.status === 'passed' ? 'green' : 'red')
          .text(`Status: ${record.status.toUpperCase()}`);

        doc.fillColor('black')
          .fontSize(10)
          .text(`Duration: ${(record.durationMs / 1000).toFixed(2)}s`);

        doc.moveDown(0.5);

        doc.fontSize(12).text('Steps:', { underline: true });

        record.steps.forEach(step => {

          const color = step.status === 'passed' ? 'green' : step.status === 'failed' ? 'red' : 'gray';

          doc.fontSize(10).fillColor(color)
            .text(`[${step.status.toUpperCase()}] ${step.title} (${(step.durationMs / 1000).toFixed(2)}s)`);

          if (step.error) {
            doc.fontSize(9).fillColor('red').text(step.error, { indent: 12 });
          }

        });

        doc.fillColor('black');

        if (record.attachments.length) {

          doc.moveDown(0.5);
          doc.fontSize(12).text('Screenshots:', { underline: true });

          record.attachments.forEach(att => {
            try {
              doc.moveDown(0.3);
              doc.fontSize(9).text(att.name);
              doc.image(att.filePath, { fit: [480, 300] });
            } catch {
              doc.fontSize(9).fillColor('red').text(`(could not embed ${att.name})`);
              doc.fillColor('black');
            }
          });

        }

      });

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', reject);

    });

  }


  private async generateExcel(
    records: TestRecord[],
    date: Date,
    outDir: string,
    fileDate: string
  ): Promise<void> {

    const filePath = path.join(outDir, `report-${fileDate}.xlsx`);
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Summary');

    summarySheet.columns = [
      { header: 'Test', key: 'title', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Duration (s)', key: 'duration', width: 14 },
      { header: 'Subject', key: 'subject', width: 30 },
      { header: 'Website', key: 'website', width: 30 },
    ];

    summarySheet.getRow(1).font = { bold: true };

    records.forEach(r => {
      summarySheet.addRow({
        title: r.title,
        status: r.status,
        duration: (r.durationMs / 1000).toFixed(2),
        subject: r.reportMeta?.subject || '',
        website: r.reportMeta?.websiteUrl || '',
      });
    });

    const stepsSheet = workbook.addWorksheet('Steps');

    stepsSheet.columns = [
      { header: 'Test', key: 'test', width: 40 },
      { header: 'Step', key: 'step', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Duration (s)', key: 'duration', width: 14 },
      { header: 'Error', key: 'error', width: 50 },
    ];

    stepsSheet.getRow(1).font = { bold: true };

    records.forEach(r => {
      r.steps.forEach(s => {
        stepsSheet.addRow({
          test: r.title,
          step: s.title,
          status: s.status,
          duration: (s.durationMs / 1000).toFixed(2),
          error: s.error || '',
        });
      });
    });

    await workbook.xlsx.writeFile(filePath);

  }

}