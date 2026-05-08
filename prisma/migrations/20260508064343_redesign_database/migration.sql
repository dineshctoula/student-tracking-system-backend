/*
  Warnings:

  - You are about to drop the column `abs` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `action` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `behavior` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `classwork` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `homework` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `late` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `materials` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `others` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `participation` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "abs",
DROP COLUMN "action",
DROP COLUMN "behavior",
DROP COLUMN "classwork",
DROP COLUMN "homework",
DROP COLUMN "late",
DROP COLUMN "materials",
DROP COLUMN "others",
DROP COLUMN "participation",
DROP COLUMN "remarks";

-- CreateTable
CREATE TABLE "StudentRecord" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "abs" BOOLEAN NOT NULL DEFAULT false,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "materials" TEXT,
    "classwork" TEXT,
    "homework" TEXT,
    "behavior" TEXT,
    "participation" TEXT,
    "remarks" TEXT,
    "action" TEXT,
    "others" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
