import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
import { DomainError } from "./domain";
export const cookieName = "khlim_lab_session";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, hex] = hash.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function signIn(username: string, password: string) {
  const staff = await db.staff.findUnique({ where: { username } });
  if (!staff || !verifyPassword(password, staff.passwordHash))
    throw new DomainError("Incorrect lab username or password.", 401);
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: tokenHash(token),
      staffId: staff.id,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
  });
  return token;
}
export async function sessionStaff(token?: string) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    include: { staff: true },
  });
  return session &&
    session.expiresAt > new Date() &&
    session.staff.role === "EVENT_STAFF"
    ? session.staff
    : null;
}
export async function signOut(token?: string) {
  if (token) await db.session.deleteMany({ where: { id: tokenHash(token) } });
}
export async function authorizeStaff(id: string) {
  const staff = await db.staff.findUnique({ where: { id } });
  if (!staff || staff.role !== "EVENT_STAFF")
    throw new DomainError("Event staff authorization required.", 401);
  return staff;
}
