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

  @Get(':id/export')
  async export(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const buffer = await this.studentService.exportSpreadsheet(id, from, to);

    const fromPart = from?.trim().slice(0, 10) ?? '';
    const toPart = to?.trim().slice(0, 10) ?? '';
    let filename = `student-${id}-records.xlsx`;
    if (fromPart && toPart) {
      filename = `student-${id}-records-${fromPart}_to_${toPart}.xlsx`;
    } else if (fromPart) {
      filename = `student-${id}-records-from-${fromPart}.xlsx`;
    } else if (toPart) {
      filename = `student-${id}-records-to-${toPart}.xlsx`;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

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
