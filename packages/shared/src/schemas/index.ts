import { z } from "zod";

// ─── Roles ───────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["student", "moderator"]);
export type Role = z.infer<typeof RoleSchema>;

// ─── Users ───────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  role: RoleSchema,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// ─── Courses ─────────────────────────────────────────────────────────────────

export const CourseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
});
export type Course = z.infer<typeof CourseSchema>;

// ─── Posts ───────────────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  body: z.string().min(1, "Body is required").max(10_000, "Body too long"),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const PostSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  title: z.string(),
  body: z.string(),
  isRemoved: z.boolean(),
  savesCount: z.number().int().nonnegative(),
  likesCount: z.number().int().nonnegative(),
  hasSaved: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Post = z.infer<typeof PostSchema>;

export const PostListResponseSchema = z.object({
  posts: z.array(PostSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type PostListResponse = z.infer<typeof PostListResponseSchema>;

// ─── Saves ───────────────────────────────────────────────────────────────────

export const SaveToggleResponseSchema = z.object({
  saved: z.boolean(),
  savesCount: z.number().int().nonnegative(),
});
export type SaveToggleResponse = z.infer<typeof SaveToggleResponseSchema>;

export const SavedPostsResponseSchema = z.object({
  posts: z.array(PostSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});
export type SavedPostsResponse = z.infer<typeof SavedPostsResponseSchema>;

// ─── Pagination ──────────────────────────────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PostsQuerySchema = PaginationQuerySchema.extend({
  courseId: z.string().uuid().optional(),
});
export type PostsQuery = z.infer<typeof PostsQuerySchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const AuthTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: RoleSchema,
  name: z.string(),
  iat: z.number().int(),
});
export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;

// ─── API Error ───────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
