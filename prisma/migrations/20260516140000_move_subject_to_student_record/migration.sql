-- AlterTable
ALTER TABLE `StudentRecord` ADD COLUMN `subject` VARCHAR(191) NULL;

-- Copy existing student subject onto all of that student's records
UPDATE `StudentRecord` sr
INNER JOIN `Student` s ON sr.`studentId` = s.`id`
SET sr.`subject` = s.`subject`
WHERE s.`subject` IS NOT NULL;

-- AlterTable
ALTER TABLE `Student` DROP COLUMN `subject`;
