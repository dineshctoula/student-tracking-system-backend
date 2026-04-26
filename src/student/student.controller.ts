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
  // REUSABLE FILTER BUILDER
  // =========================
  private buildFilters(name?: string, className?: string, section?: string) {
    const filters: any[] = [];

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
      where: this.buildFilters(name, className, section),
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
  // EXPORT EXCEL (FILTERED OR FULL)
  // =========================
  @Get('export')
  async export(
    @Res() res,
    @Query('name') name?: string,
    @Query('class') className?: string,
    @Query('section') section?: string,
  ) {
    const students = await this.prisma.student.findMany({
      where: this.buildFilters(name, className, section),
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    const formattedDate = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // =========================
    // PAGE SETUP
    // =========================
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

    // =========================
    // TITLE
    // =========================
    sheet.mergeCells('A1:O1');
    const titleCell = sheet.getCell('A1');

    titleCell.value = `Student Report - ${formattedDate}`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    sheet.getRow(1).height = 28;

    // =========================
    // HEADERS
    // =========================
    const headers = [
      'S.N',
      'Name',
      'Subject',
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
      'Others',
    ];

    sheet.addRow(headers);

    // =========================
    // DATA ROWS
    // =========================
    students.forEach((s, index) => {
      sheet.addRow([
        index + 1,
        s.name,
        s.subject || '',
        s.class || '',
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
        s.others || '',
      ]);
    });

    // =========================
    // COLUMN WIDTH
    // =========================
    sheet.columns = [
      { width: 6 },
      { width: 18 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 7 },
      { width: 7 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 15 },
      { width: 20 },
    ];

    // =========================
    // FREEZE HEADER
    // =========================
    sheet.views = [
      {
        state: 'frozen',
        ySplit: 3,
      },
    ];

    // =========================
    // PRINT SETTINGS
    // =========================
    sheet.pageSetup.printTitlesRow = '3:3';
    sheet.pageSetup.printArea = `A1:O${students.length + 3}`;

    // =========================
    // RESPONSE
    // =========================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=students.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}