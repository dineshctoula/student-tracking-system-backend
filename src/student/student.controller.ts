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
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';

import type { CreateStudentDto } from './dto/create-student.dto';
import type { CreateStudentRecordDto } from './dto/create-student-record.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';
import { StudentService } from './student.service';

@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(@Body() data: CreateStudentDto) {
    return this.studentService.create(data);
  }

  @Post(':id/records')
  addRecord(@Param('id') id: string, @Body() data: CreateStudentRecordDto) {
    return this.studentService.addRecord(Number(id), data);
  }

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.studentService.findAll(from, to);
  }

  @Get('search')
  search(
    @Query('name') name?: string,
    @Query('class') className?: string,
    @Query('section') section?: string,
  ) {
    return this.studentService.search(name, className, section);
  }

  @Get('export')
  async exportAll(
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { buffer, stem } = await this.studentService.exportAllSpreadsheets(
      from,
      to,
    );
    this.sendXlsxAttachment(res, buffer, stem);
  }

  @Get(':id/export')
  async export(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { buffer, stem } = await this.studentService.exportSpreadsheet(
      id,
      from,
      to,
    );
    this.sendXlsxAttachment(res, buffer, stem);
  }

  private sendXlsxAttachment(res: Response, buffer: Buffer, stem: string) {
    const filename = `${stem}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateStudentDto) {
    return this.studentService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentService.remove(Number(id));
  }
}
