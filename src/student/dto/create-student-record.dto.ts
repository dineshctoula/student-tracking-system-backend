import type { CreateStudentDto } from './create-student.dto';

export type CreateStudentRecordDto = Pick<
  CreateStudentDto,
  | 'subject'
  | 'absences'
  | 'abs'
  | 'late'
  | 'material'
  | 'behaviour'
  | 'behavior'
  | 'classwork'
  | 'homework'
  | 'participation'
  | 'date'
  | 'remarks'
>;
