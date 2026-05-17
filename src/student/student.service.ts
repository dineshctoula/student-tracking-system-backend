import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import {
  formatBsDate,
  formatBsDateForDisplay,
  formatBsDateLong,
  parseDateInputEndOfDay,
  parseDateInputStartOfDay,
} from '../common/nepali-date.util';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { CreateStudentRecordDto } from './dto/create-student-record.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  private buildFilters(name?: string, className?: string, section?: string) {
    const filters: Prisma.StudentWhereInput[] = [];

    if (name) {
      filters.push({
        name: { contains: name },
      });
    }

    if (className) {
      filters.push({ class: className });
    }

    if (section) {
      filters.push({ section });
    }

    return filters.length ? { AND: filters } : {};
  }

  private startOfDayFromQuery(value: string): Date {
    try {
      return parseDateInputStartOfDay(value);
    } catch {
      throw new BadRequestException(`Invalid from/to date: ${value.trim()}`);
    }
  }

  private endOfDayFromQuery(value: string): Date {
    try {
      return parseDateInputEndOfDay(value);
    } catch {
      throw new BadRequestException(`Invalid from/to date: ${value.trim()}`);
    }
  }

  private enrichRecord<
    T extends { recordDate: Date; createdAt: Date },
  >(record: T) {
    return {
      ...record,
      recordDate: formatBsDateForDisplay(record.recordDate),
      createdAt: formatBsDateForDisplay(record.createdAt),
    };
  }

  private enrichStudent<
    T extends { createdAt: Date; records?: { recordDate: Date; createdAt: Date }[] },
  >(student: T) {
    return {
      ...student,
      createdAt: formatBsDateForDisplay(student.createdAt),
      ...(student.records
        ? { records: student.records.map((r) => this.enrichRecord(r)) }
        : {}),
    };
  }

  private buildRecordDateFilter(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    const fromTrim = from?.trim();
    const toTrim = to?.trim();
    if (!fromTrim && !toTrim) {
      return undefined;
    }
    const filter: Prisma.DateTimeFilter = {};
    if (fromTrim) {
      filter.gte = this.startOfDayFromQuery(fromTrim);
    }
    if (toTrim) {
      filter.lte = this.endOfDayFromQuery(toTrim);
    }
    if (filter.gte && filter.lte && filter.gte > filter.lte) {
      throw new BadRequestException(
        'Query "from" must be on or before "to" (same calendar day is allowed).',
      );
    }
    return filter;
  }

  private async findManyStudentsWithRecords(
    where: Prisma.StudentWhereInput = {},
    recordDate?: Prisma.DateTimeFilter,
  ) {
    const students = await this.prisma.student.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    if (students.length === 0) {
      return [];
    }

    const ids = students.map((s) => s.id);

    const records = await this.prisma.studentRecord.findMany({
      where: {
        studentId: { in: ids },
        ...(recordDate ? { recordDate } : {}),
      },
      orderBy: [{ recordDate: 'desc' }, { id: 'desc' }],
    });

    const recordsByStudentId = new Map<
      number,
      (typeof records)[number][]
    >();

    for (const r of records) {
      const list = recordsByStudentId.get(r.studentId);
      if (list) {
        list.push(r);
      } else {
        recordsByStudentId.set(r.studentId, [r]);
      }
    }

    return students.map((s) =>
      this.enrichStudent({
        ...s,
        records: recordsByStudentId.get(s.id) ?? [],
      }),
    );
  }

  private parseBodyDate(value: string | undefined): Date | undefined {
    if (value === undefined || value === '') return undefined;
    try {
      return parseDateInputStartOfDay(value);
    } catch {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
  }

  private recordCreateData(
    studentId: number,
    data: CreateStudentRecordDto,
  ): Prisma.StudentRecordUncheckedCreateInput {
    const {
      subject,
      absences,
      abs,
      late,
      material,
      behaviour,
      behavior,
      classwork,
      homework,
      participation,
      date,
      remarks,
    } = data;

    const behaviorText = behaviour ?? behavior ?? null;

    return {
      studentId,
      subject: subject ?? null,
      abs: absences ?? abs ?? false,
      late: late ?? false,
      materials: material ?? null,
      behavior: behaviorText,
      classwork: classwork ?? null,
      homework: homework ?? null,
      participation: participation ?? null,
      remarks: remarks ?? null,
      ...(date !== undefined && date !== ''
        ? { recordDate: this.parseBodyDate(date)! }
        : {}),
    };
  }

  create(data: CreateStudentDto) {
    const {
      name,
      class: studentClass,
      subject,
      section,
      absences,
      abs,
      late,
      material,
      behaviour,
      behavior,
      classwork,
      homework,
      participation,
      date,
      remarks,
    } = data;

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          name,
          class: studentClass,
          section: section ?? null,
        },
      });

      await tx.studentRecord.create({
        data: this.recordCreateData(student.id, {
          subject,
          absences,
          abs,
          late,
          material,
          behaviour,
          behavior,
          classwork,
          homework,
          participation,
          date,
          remarks,
        }),
      });

      const created = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: {
          records: { orderBy: { recordDate: 'desc' } },
        },
      });
      return this.enrichStudent(created);
    });
  }

  async addRecord(studentId: number, data: CreateStudentRecordDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    await this.prisma.studentRecord.create({
      data: this.recordCreateData(studentId, data),
    });

    const updated = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: {
        records: { orderBy: { recordDate: 'desc' } },
      },
    });
    return this.enrichStudent(updated);
  }

  findAll(from?: string, to?: string) {
    const recordDate = this.buildRecordDateFilter(from, to);
    return this.findManyStudentsWithRecords({}, recordDate);
  }

  async search(name?: string, className?: string, section?: string) {
    const students = await this.prisma.student.findMany({
      where: this.buildFilters(name, className, section),
    });
    return students.map((s) => this.enrichStudent(s));
  }

  update(studentId: number, data: UpdateStudentDto) {
    const {
      name,
      class: studentClass,
      subject,
      section,
      absences,
      abs,
      late,
      material,
      behaviour,
      behavior,
      classwork,
      homework,
      participation,
      date,
      remarks,
    } = data;

    const hasStudentField =
      name !== undefined ||
      studentClass !== undefined ||
      section !== undefined;

    const hasRecordField =
      subject !== undefined ||
      absences !== undefined ||
      abs !== undefined ||
      late !== undefined ||
      material !== undefined ||
      behaviour !== undefined ||
      behavior !== undefined ||
      classwork !== undefined ||
      homework !== undefined ||
      participation !== undefined ||
      date !== undefined ||
      remarks !== undefined;

    return this.prisma.$transaction(async (tx) => {
      if (hasStudentField) {
        await tx.student.update({
          where: { id: studentId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(studentClass !== undefined ? { class: studentClass } : {}),
            ...(section !== undefined ? { section } : {}),
          },
        });
      }

      if (hasRecordField) {
        const latest = await tx.studentRecord.findFirst({
          where: { studentId },
          orderBy: [{ recordDate: 'desc' }, { id: 'desc' }],
        });

        if (latest) {
          const recordUpdate: Prisma.StudentRecordUncheckedUpdateInput = {};
          if (subject !== undefined) recordUpdate.subject = subject;
          if (absences !== undefined) recordUpdate.abs = absences;
          else if (abs !== undefined) recordUpdate.abs = abs;
          if (late !== undefined) recordUpdate.late = late;
          if (material !== undefined) recordUpdate.materials = material;
          if (behaviour !== undefined || behavior !== undefined) {
            recordUpdate.behavior = behaviour ?? behavior ?? null;
          }
          if (classwork !== undefined) recordUpdate.classwork = classwork;
          if (homework !== undefined) recordUpdate.homework = homework;
          if (participation !== undefined) {
            recordUpdate.participation = participation;
          }
          if (remarks !== undefined) recordUpdate.remarks = remarks;
          if (date !== undefined) {
            recordUpdate.recordDate = this.parseBodyDate(date)!;
          }

          await tx.studentRecord.update({
            where: { id: latest.id },
            data: recordUpdate,
          });
        } else {
          await tx.studentRecord.create({
            data: {
              studentId,
              subject: subject ?? null,
              abs: absences ?? abs ?? false,
              late: late ?? false,
              materials: material ?? null,
              behavior: behaviour ?? behavior ?? null,
              classwork: classwork ?? null,
              homework: homework ?? null,
              participation: participation ?? null,
              remarks: remarks ?? null,
              ...(date !== undefined && date !== ''
                ? { recordDate: this.parseBodyDate(date)! }
                : {}),
            },
          });
        }
      }

      const updated = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        include: {
          records: { orderBy: { recordDate: 'desc' } },
        },
      });
      return this.enrichStudent(updated);
    });
  }

  private sanitizeExportFilenamePart(value: string): string {
    return (
      value
        .trim()
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 80) || 'student'
    );
  }

  private buildExportStem(
    studentName: string,
    from?: string,
    to?: string,
  ): string {
    const namePart = this.sanitizeExportFilenamePart(studentName);
    const fromPart = from?.trim().slice(0, 10) ?? '';
    const toPart = to?.trim().slice(0, 10) ?? '';

    if (fromPart && toPart) {
      return `${namePart}_${fromPart}_to_${toPart}`;
    }
    if (fromPart) {
      return `${namePart}_from_${fromPart}`;
    }
    if (toPart) {
      return `${namePart}_to_${toPart}`;
    }
    return namePart;
  }

  private buildAllExportStem(from?: string, to?: string): string {
    const fromPart = from?.trim().slice(0, 10) ?? '';
    const toPart = to?.trim().slice(0, 10) ?? '';

    if (fromPart && toPart) {
      return `all_students_${fromPart}_to_${toPart}`;
    }
    if (fromPart) {
      return `all_students_from_${fromPart}`;
    }
    if (toPart) {
      return `all_students_to_${toPart}`;
    }
    return 'all_students';
  }

  private buildExportReportTitle(
    studentLabel: string,
    from?: string,
    to?: string,
  ): string {
    const formattedDate = formatBsDateLong(new Date());
    const fromPart = from?.trim().slice(0, 10) ?? '';
    const toPart = to?.trim().slice(0, 10) ?? '';

    if (fromPart && toPart) {
      return `Student Report - ${studentLabel} (${fromPart} to ${toPart}) - ${formattedDate}`;
    }
    if (fromPart) {
      return `Student Report - ${studentLabel} (from ${fromPart}) - ${formattedDate}`;
    }
    if (toPart) {
      return `Student Report - ${studentLabel} (to ${toPart}) - ${formattedDate}`;
    }
    return `Student Report - ${studentLabel} - ${formattedDate}`;
  }

  private collectExportDataRows<
    T extends {
      name: string;
      class: string;
      section: string | null;
      records: {
        recordDate: Date;
        subject: string | null;
        abs: boolean;
        late: boolean;
        materials: string | null;
        classwork: string | null;
        homework: string | null;
        behavior: string | null;
        participation: string | null;
        remarks: string | null;
      }[];
    },
  >(students: T[]): { student: T; record: T['records'][number] | null }[] {
    const dataRows: { student: T; record: T['records'][number] | null }[] = [];
    for (const student of students) {
      if (student.records.length === 0) {
        dataRows.push({ student, record: null });
      } else {
        for (const record of student.records) {
          dataRows.push({ student, record });
        }
      }
    }
    return dataRows;
  }

  private async buildXlsxBuffer(
    reportTitle: string,
    dataRows: {
      student: {
        name: string;
        class: string;
        section: string | null;
      };
      record: {
        recordDate: Date;
        subject: string | null;
        abs: boolean;
        late: boolean;
        materials: string | null;
        classwork: string | null;
        homework: string | null;
        behavior: string | null;
        participation: string | null;
        remarks: string | null;
      } | null;
    }[],
    options: { includeStudentName: boolean },
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    const headers = options.includeStudentName
      ? [
          'Name',
          'S.N',
          'Class',
          'Section',
          'Subject',
          'Date',
          'Abs',
          'Late',
          'Materials',
          'Classwork',
          'Homework',
          'Behavior',
          'Participation',
          'Remarks',
        ]
      : [
          'S.N',
          'Class',
          'Section',
          'Subject',
          'Date',
          'Abs',
          'Late',
          'Materials',
          'Classwork',
          'Homework',
          'Behavior',
          'Participation',
          'Remarks',
        ];

    const lastColLetter = String.fromCharCode(
      'A'.charCodeAt(0) + headers.length - 1,
    );

    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    };

    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheet.getRow(1).height = 28;
    sheet.addRow(headers);

    const yesNo = (value: boolean | null | undefined) =>
      value === true ? 'Yes' : 'No';

    dataRows.forEach(({ student, record }, index) => {
      const row = options.includeStudentName
        ? [
            student.name,
            index + 1,
            student.class || '',
            student.section || '',
            record?.subject || '',
            formatBsDate(record?.recordDate ?? null),
            yesNo(record?.abs),
            yesNo(record?.late),
            record?.materials || '',
            record?.classwork || '',
            record?.homework || '',
            record?.behavior || '',
            record?.participation || '',
            record?.remarks || '',
          ]
        : [
            index + 1,
            student.class || '',
            student.section || '',
            record?.subject || '',
            formatBsDate(record?.recordDate ?? null),
            yesNo(record?.abs),
            yesNo(record?.late),
            record?.materials || '',
            record?.classwork || '',
            record?.homework || '',
            record?.behavior || '',
            record?.participation || '',
            record?.remarks || '',
          ];
      sheet.addRow(row);
    });

    sheet.columns = options.includeStudentName
      ? [
          { width: 18 },
          { width: 6 },
          { width: 10 },
          { width: 8 },
          { width: 14 },
          { width: 12 },
          { width: 6 },
          { width: 6 },
          { width: 16 },
          { width: 16 },
          { width: 14 },
          { width: 14 },
          { width: 16 },
          { width: 22 },
        ]
      : [
          { width: 6 },
          { width: 10 },
          { width: 8 },
          { width: 14 },
          { width: 12 },
          { width: 6 },
          { width: 6 },
          { width: 16 },
          { width: 16 },
          { width: 14 },
          { width: 14 },
          { width: 16 },
          { width: 22 },
        ];

    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    sheet.pageSetup.printTitlesRow = '3:3';
    sheet.pageSetup.printArea = `A1:${lastColLetter}${2 + dataRows.length}`;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async remove(studentId: number) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!existing) {
        throw new NotFoundException(`Student ${studentId} not found`);
      }
      await tx.studentRecord.deleteMany({ where: { studentId } });
      return tx.student.delete({ where: { id: studentId } });
    });
    return this.enrichStudent(deleted);
  }

  async exportSpreadsheet(
    userId: number,
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; stem: string }> {
    const recordDate = this.buildRecordDateFilter(from, to);
    const students = await this.findManyStudentsWithRecords(
      { id: userId },
      recordDate,
    );

    if (students.length === 0) {
      throw new NotFoundException(`Student with userId ${userId} not found`);
    }

    const student = students[0];
    const dataRows = this.collectExportDataRows(students);
    const reportTitle = this.buildExportReportTitle(student.name, from, to);
    const buffer = await this.buildXlsxBuffer(reportTitle, dataRows, {
      includeStudentName: false,
    });
    const stem = this.buildExportStem(student.name, from, to);
    return { buffer, stem };
  }

  async exportAllSpreadsheets(
    from?: string,
    to?: string,
  ): Promise<{ buffer: Buffer; stem: string }> {
    const recordDate = this.buildRecordDateFilter(from, to);
    const students = await this.findManyStudentsWithRecords({}, recordDate);

    if (students.length === 0) {
      throw new NotFoundException('No students found');
    }

    const dataRows = this.collectExportDataRows(students);
    const reportTitle = this.buildExportReportTitle('All Students', from, to);
    const buffer = await this.buildXlsxBuffer(reportTitle, dataRows, {
      includeStudentName: true,
    });
    const stem = this.buildAllExportStem(from, to);
    return { buffer, stem };
  }
}
