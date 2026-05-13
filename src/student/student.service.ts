import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';

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
        name: { contains: name, mode: 'insensitive' },
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
    const s = value.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d, 0, 0, 0, 0);
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== mo ||
        dt.getDate() !== d
      ) {
        throw new BadRequestException(`Invalid from/to date: ${s}`);
      }
      return dt;
    }
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException(`Invalid from/to date: ${s}`);
    }
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private endOfDayFromQuery(value: string): Date {
    const s = value.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d, 23, 59, 59, 999);
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== mo ||
        dt.getDate() !== d
      ) {
        throw new BadRequestException(`Invalid from/to date: ${s}`);
      }
      return dt;
    }
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) {
      throw new BadRequestException(`Invalid from/to date: ${s}`);
    }
    dt.setHours(23, 59, 59, 999);
    return dt;
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

    return students.map((s) => ({
      ...s,
      records: recordsByStudentId.get(s.id) ?? [],
    }));
  }

  private recordCreateData(
    studentId: number,
    data: CreateStudentRecordDto,
  ): Prisma.StudentRecordUncheckedCreateInput {
    const {
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
      abs: absences ?? abs ?? false,
      late: late ?? false,
      materials: material ?? null,
      behavior: behaviorText,
      classwork: classwork ?? null,
      homework: homework ?? null,
      participation: participation ?? null,
      remarks: remarks ?? null,
      ...(date ? { recordDate: new Date(date) } : {}),
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
          subject: subject ?? null,
        },
      });

      await tx.studentRecord.create({
        data: this.recordCreateData(student.id, {
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

      return tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: {
          records: { orderBy: { recordDate: 'desc' } },
        },
      });
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

    return this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: {
        records: { orderBy: { recordDate: 'desc' } },
      },
    });
  }

  findAll(from?: string, to?: string) {
    const recordDate = this.buildRecordDateFilter(from, to);
    return this.findManyStudentsWithRecords({}, recordDate);
  }

  search(name?: string, className?: string, section?: string) {
    return this.prisma.student.findMany({
      where: this.buildFilters(name, className, section),
    });
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
      subject !== undefined ||
      section !== undefined;

    const hasRecordField =
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
            ...(subject !== undefined ? { subject } : {}),
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
          if (date !== undefined) recordUpdate.recordDate = new Date(date);

          await tx.studentRecord.update({
            where: { id: latest.id },
            data: recordUpdate,
          });
        } else {
          await tx.studentRecord.create({
            data: {
              studentId,
              abs: absences ?? abs ?? false,
              late: late ?? false,
              materials: material ?? null,
              behavior: behaviour ?? behavior ?? null,
              classwork: classwork ?? null,
              homework: homework ?? null,
              participation: participation ?? null,
              remarks: remarks ?? null,
              ...(date ? { recordDate: new Date(date) } : {}),
            },
          });
        }
      }

      return tx.student.findUniqueOrThrow({
        where: { id: studentId },
        include: {
          records: { orderBy: { recordDate: 'desc' } },
        },
      });
    });
  }

  remove(studentId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!existing) {
        throw new NotFoundException(`Student ${studentId} not found`);
      }
      await tx.studentRecord.deleteMany({ where: { studentId } });
      return tx.student.delete({ where: { id: studentId } });
    });
  }

  async exportSpreadsheet(
    userId: number,
    from?: string,
    to?: string,
  ): Promise<Buffer> {
    const recordDate = this.buildRecordDateFilter(from, to);
    const students = await this.findManyStudentsWithRecords(
      { id: userId },
      recordDate,
    );

    if (students.length === 0) {
      throw new NotFoundException(`Student with userId ${userId} not found`);
    }

    const s = students[0];

    type Row = (typeof students)[number];
    type Rec = Row['records'][number];

    const dataRows: { student: Row; record: Rec | null }[] = [];
    if (s.records.length === 0) {
      dataRows.push({ student: s, record: null });
    } else {
      for (const r of s.records) {
        dataRows.push({ student: s, record: r });
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    const formattedDate = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

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

    const headers = [
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

    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell('A1');

    titleCell.value = `Student Report - ${formattedDate}`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    sheet.getRow(1).height = 28;

    sheet.addRow(headers);

    const dateOnly = (d: Date | null | undefined) => {
      if (d == null) return '';
      const x = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(x.getTime())) return '';
      const y = x.getFullYear();
      const m = String(x.getMonth() + 1).padStart(2, '0');
      const day = String(x.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const yesNo = (value: boolean | null | undefined) =>
      value === true ? 'Yes' : 'No';

    dataRows.forEach(({ student: s, record: r }, index) => {
      sheet.addRow([
        index + 1,
        s.class || '',
        s.section || '',
        s.subject || '',
        dateOnly(r?.recordDate ?? null),
        yesNo(r?.abs),
        yesNo(r?.late),
        r?.materials || '',
        r?.classwork || '',
        r?.homework || '',
        r?.behavior || '',
        r?.participation || '',
        r?.remarks || '',
      ]);
    });

    sheet.columns = [
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

    sheet.views = [
      {
        state: 'frozen',
        ySplit: 3,
      },
    ];

    sheet.pageSetup.printTitlesRow = '3:3';
    sheet.pageSetup.printArea = `A1:${lastColLetter}${2 + dataRows.length}`;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
