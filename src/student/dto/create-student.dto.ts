export interface CreateStudentDto {
  name: string;
  class: string;
  subject?: string;
  section?: string;

  absences?: boolean;
  abs?: boolean;

  late?: boolean;

  material?: string;

  behaviour?: string;
  behavior?: string;

  classwork?: string;
  homework?: string;
  participation?: string;

  date?: string;

  remarks?: string;
}
