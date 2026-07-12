import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { enrollments } from "../db/schema.js";

/**
 * Returns true if the user is enrolled in the given course.
 * Moderators skip this check at the route level — call requireEnrolled only for students.
 */
export async function isEnrolled(
  db: DB,
  userId: string,
  courseId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return !!row;
}

/**
 * Returns all course IDs the user is enrolled in.
 * Used to filter the feed to only enrolled courses.
 */
export async function getEnrolledCourseIds(
  db: DB,
  userId: string
): Promise<string[]> {
  const rows = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(eq(enrollments.userId, userId));
  return rows.map((r) => r.courseId);
}
