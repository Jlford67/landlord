/*
  Warnings:

  - You are about to drop the `PropertyManagerAssignmentLegacy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PropertyManagerLegacy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PropertyManagerAssignmentLegacy";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PropertyManagerLegacy";
PRAGMA foreign_keys=on;
