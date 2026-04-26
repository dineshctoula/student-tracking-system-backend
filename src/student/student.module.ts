import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StudentController],
})
export class StudentModule {}