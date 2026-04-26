export class CreateStudentDto {
  name: string;
  class: string;
  subject?: string;   // ✅ NEW
  section?: string;

  behavior?: string;
  remarks?: string;
  others?: string;    // ✅ NEW
}