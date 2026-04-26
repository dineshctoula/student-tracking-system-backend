export class UpdateStudentDto {
  name?: string;
  class?: string;
  subject?: string;   // ✅ NEW
  section?: string;

  behavior?: string;
  remarks?: string;
  others?: string;    // ✅ NEW
}