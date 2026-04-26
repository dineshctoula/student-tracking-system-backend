import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  Res,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Controller('students')
export class StudentController {
  constructor(private prisma: PrismaService) {}

  // =========================
  // CREATE STUDENT
  // =========================
  @Post()
  create(@Body() data: CreateStudentDto) {
    return this.prisma.student.create({ data });
  }

  // =========================
  // GET ALL STUDENTS
  // =========================
  @Get()
  findAll() {
    return this.prisma.student.findMany();
  }

  // =========================
  // SEARCH STUDENT
  // =========================
  @Get('search')
  search(
    @Query('name') name?: string,
    @Query('class') className?: string,
    @Query('section') section?: string,
  ) {
    return this.prisma.student.findMany({
      where: {
        AND: [
          name
            ? { name: { contains: name, mode: 'insensitive' } }
            : {},
          className ? { class: className } : {},
          section ? { section } : {},
        ],
      },
    });
  }

  // =========================
  // UPDATE STUDENT
  // =========================
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateStudentDto) {
    return this.prisma.student.update({
      where: { id: Number(id) },
      data,
    });
  }

  // =========================
  // DELETE STUDENT
  // =========================
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.student.delete({
      where: { id: Number(id) },
    });
  }

  // =========================
  // EXPORT EXCEL (DATE + DAY + SECTION FIXED)
  // =========================
  @Get('export')
async export(@Res() res) {
  const students = await this.prisma.student.findMany();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  const now = new Date();

  const formattedDate = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // =========================
  // 🖨️ A4 PRINT PERFECT SETUP
  // =========================
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',

    // 🔥 MOST IMPORTANT FIX
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

  // =========================
  // 🧾 TITLE ROW (CENTER PERFECT)
  // =========================
  sheet.mergeCells('A1:M1');
  const titleCell = sheet.getCell('A1');

  titleCell.value = `Student Report - ${formattedDate}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };

  sheet.getRow(1).height = 28;

  // =========================
  // 📊 HEADER ROW
  // =========================
  const headers = [
    'S.N',
    'Name',
    'Class',
    'Section',
    'Abs',
    'Late',
    'Materials',
    'Classwork',
    'Homework',
    'Behavior',
    'Participation',
    'Remarks',
    'Action',
  ];

  const headerRow = sheet.getRow(3);
  headerRow.values = headers;

  headerRow.height = 22; // 🔥 IMPORTANT FOR PRINT ALIGNMENT

  headerRow.font = { bold: true };
  headerRow.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };

    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // =========================
  // 📌 DATA ROWS (WITH S.N)
  // =========================
  students.forEach((s, index) => {
    sheet.addRow([
      index + 1,
      s.name,
      s.class,
      s.section || '',
      s.abs ? 'Yes' : 'No',
      s.late ? 'Yes' : 'No',
      s.materials || '',
      s.classwork || '',
      s.homework || '',
      s.behavior || '',
      s.participation || '',
      s.remarks || '',
      s.action || '',
    ]);
  });

  // =========================
  // 📏 COLUMN WIDTH (PRINT OPTIMIZED)
  // =========================
  sheet.columns = [
    { width: 6 },   // S.N
    { width: 18 },  // Name
    { width: 10 },  // Class
    { width: 10 },  // Section
    { width: 7 },   // Abs
    { width: 7 },   // Late
    { width: 15 },  // Materials
    { width: 15 },  // Classwork
    { width: 15 },  // Homework
    { width: 15 },  // Behavior
    { width: 15 },  // Participation
    { width: 20 },  // Remarks
    { width: 15 },  // Action
  ];

  // =========================
  // 🔒 FREEZE HEADER
  // =========================
  sheet.views = [
    {
      state: 'frozen',
      ySplit: 3,
    },
  ];

  // =========================
  // 🖨️ PRINT FIX (VERY IMPORTANT)
  // =========================
  sheet.pageSetup.printTitlesRow = '3:3';

  sheet.pageSetup.printArea = 'A1:M' + (students.length + 3);

  // =========================
  // 📥 DOWNLOAD
  // =========================
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=students-A4-print-ready.xlsx',
  );

  await workbook.xlsx.write(res);
  res.end();
}
}